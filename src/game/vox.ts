import { VoxelBuilder } from "./voxel";

/**
 * Leitura e escrita de arquivos `.vox` do MagicaVoxel, o editor de voxels gratuito. Assim um modelo
 * pode ser desenhado à mão no editor e entrar no jogo no lugar do modelo gerado por código, e um
 * modelo do jogo pode ser exportado para servir de ponto de partida.
 *
 * Formato (RIFF simplificado): "VOX " + versão, e um chunk MAIN com filhos. Cada chunk tem id de
 * 4 letras, tamanho do conteúdo e tamanho dos filhos. Os que importam aqui:
 * - SIZE (x, y, z) e XYZI (lista de voxels x, y, z, índice de cor), um par por modelo;
 * - RGBA, a paleta de 256 cores (o índice i usa a entrada i - 1);
 * - nTRN / nGRP / nSHP, o grafo de cena que posiciona cada modelo (só a translação é usada).
 *
 * Eixos: o MagicaVoxel usa Z para cima e a vista "Front" olha o lado -Y. No jogo, Y é para cima e a
 * frente dos modelos é -Z. A conversão é (x, y, z) do editor → (-x, z, y) no jogo, centrado em X e Z.
 */

export interface VoxModel {
  size: [number, number, number];
  /** x, y, z, índice de cor (1..255), em sequência. */
  voxels: Uint8Array;
  /** Translação do modelo na cena, pelo grafo nTRN. */
  translation: [number, number, number];
}

export interface VoxFile {
  models: VoxModel[];
  /** 256 cores RGBA; palette[i - 1] é a cor do índice i. */
  palette: Uint32Array;
}

const id = (view: DataView, at: number) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

/** Lê um arquivo .vox. Lança erro se o arquivo não for .vox. */
export function parseVox(buffer: ArrayBuffer): VoxFile {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || id(view, 0) !== "VOX ") throw new Error("Não é um arquivo .vox");
  const sizes: [number, number, number][] = [];
  const blocks: Uint8Array[] = [];
  let palette: Uint32Array | null = null;
  const transforms = new Map<number, { child: number; t: [number, number, number] }>();
  const groups = new Map<number, number[]>();
  const shapes = new Map<number, number[]>();

  // Leitores do formato de dicionário (strings com tamanho) usados no grafo de cena.
  let p = 0;
  const int = () => { const v = view.getInt32(p, true); p += 4; return v; };
  const str = () => { const n = int(); let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(p + i)); p += n; return s; };
  const dict = () => { const n = int(); const d: Record<string, string> = {}; for (let i = 0; i < n; i++) { const k = str(); d[k] = str(); } return d; };

  let at = 8;
  while (at + 12 <= buffer.byteLength) {
    const chunk = id(view, at);
    const content = view.getInt32(at + 4, true);
    const children = view.getInt32(at + 8, true);
    const body = at + 12;
    if (chunk === "MAIN") {
      at = body + content; // os filhos vêm logo em seguida
      continue;
    }
    if (chunk === "SIZE") sizes.push([view.getInt32(body, true), view.getInt32(body + 4, true), view.getInt32(body + 8, true)]);
    else if (chunk === "XYZI") {
      const n = view.getInt32(body, true);
      blocks.push(new Uint8Array(buffer.slice(body + 4, body + 4 + n * 4)));
    } else if (chunk === "RGBA") {
      palette = new Uint32Array(256);
      for (let i = 0; i < 256; i++) palette[i] = view.getUint32(body + i * 4, true);
    } else if (chunk === "nTRN") {
      p = body;
      const node = int(); dict(); const child = int(); int(); int();
      const frames = int();
      let t: [number, number, number] = [0, 0, 0];
      for (let f = 0; f < frames; f++) {
        const d = dict();
        if (f === 0 && d._t) t = d._t.split(" ").map(Number) as [number, number, number];
      }
      transforms.set(node, { child, t });
    } else if (chunk === "nGRP") {
      p = body;
      const node = int(); dict();
      const n = int();
      const kids: number[] = [];
      for (let i = 0; i < n; i++) kids.push(int());
      groups.set(node, kids);
    } else if (chunk === "nSHP") {
      p = body;
      const node = int(); dict();
      const n = int();
      const models: number[] = [];
      for (let i = 0; i < n; i++) { models.push(int()); dict(); }
      shapes.set(node, models);
    }
    at = body + content + children;
  }

  const models: VoxModel[] = sizes.map((size, i) => ({ size, voxels: blocks[i] ?? new Uint8Array(), translation: [0, 0, 0] }));
  // Grafo de cena: soma as translações do nó raiz até cada forma.
  const walk = (node: number, acc: [number, number, number], depth: number): void => {
    if (depth > 64) return;
    const tr = transforms.get(node);
    if (tr) return walk(tr.child, [acc[0] + tr.t[0], acc[1] + tr.t[1], acc[2] + tr.t[2]], depth + 1);
    for (const kid of groups.get(node) ?? []) walk(kid, acc, depth + 1);
    for (const m of shapes.get(node) ?? []) if (models[m]) models[m].translation = acc;
  };
  if (transforms.has(0)) walk(0, [0, 0, 0], 0);
  return { models, palette: palette ?? defaultPalette() };
}

/** Paleta de reserva para arquivos sem RGBA (raro): uma rampa de cinzas. */
function defaultPalette(): Uint32Array {
  const pal = new Uint32Array(256);
  for (let i = 0; i < 256; i++) pal[i] = (0xff << 24) | (i << 16) | (i << 8) | i;
  return pal;
}

/** Converte um .vox em voxels do jogo (todos os modelos da cena, juntos). */
export function voxToBuilder(file: VoxFile): VoxelBuilder {
  const b = new VoxelBuilder();
  // Põe a cena inteira com o chão em y = 0 e centrada em X e Z.
  const placed: { x: number; y: number; z: number; c: number }[] = [];
  for (const m of file.models) {
    const half = [Math.floor(m.size[0] / 2), Math.floor(m.size[1] / 2), Math.floor(m.size[2] / 2)];
    for (let i = 0; i + 3 < m.voxels.length; i += 4) {
      placed.push({
        x: m.voxels[i]! - half[0]! + m.translation[0],
        y: m.voxels[i + 1]! - half[1]! + m.translation[1],
        z: m.voxels[i + 2]! - half[2]! + m.translation[2],
        c: m.voxels[i + 3]!,
      });
    }
  }
  if (placed.length === 0) return b;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
  for (const v of placed) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z);
  }
  const cx = Math.floor((minX + maxX + 1) / 2), cy = Math.floor((minY + maxY + 1) / 2);
  for (const v of placed) {
    const rgba = file.palette[v.c - 1] ?? 0;
    const hex = ((rgba & 0xff) << 16) | (((rgba >>> 8) & 0xff) << 8) | ((rgba >>> 16) & 0xff);
    // Editor (x, y, z) → jogo (-x, z, y).
    b.set(cx - 1 - v.x, v.z - minZ, v.y - cy, hex);
  }
  return b;
}

/** Gera um .vox (um modelo, paleta própria) a partir de voxels do jogo. */
export function builderToVox(b: VoxelBuilder): Uint8Array {
  const { min, max } = b.bounds();
  const sx = max[0] - min[0], sy = max[2] - min[2], sz = max[1] - min[1];
  if (sx > 256 || sy > 256 || sz > 256) throw new Error(`Modelo grande demais para o .vox (${sx}×${sy}×${sz}, máximo 256)`);
  const colors = quantize(b);
  const index = new Map<number, number>();
  colors.palette.forEach((hex, i) => index.set(hex, i + 1));
  const xyzi: number[] = [];
  b.forEach((x, y, z, hex) => {
    // Jogo (x, y, z) → editor (-x, z, y), deslocado para começar em 0.
    xyzi.push(max[0] - 1 - x, z - min[2], y - min[1], index.get(colors.map(hex))!);
  });

  const chunks: Uint8Array[] = [];
  const chunk = (name: string, content: number[] | Uint8Array) => {
    const bytes = new Uint8Array(12 + content.length);
    const v = new DataView(bytes.buffer);
    for (let i = 0; i < 4; i++) bytes[i] = name.charCodeAt(i);
    v.setInt32(4, content.length, true);
    v.setInt32(8, 0, true);
    bytes.set(content, 12);
    chunks.push(bytes);
  };
  const ints = (...n: number[]) => {
    const out = new Uint8Array(n.length * 4);
    const v = new DataView(out.buffer);
    n.forEach((x, i) => v.setInt32(i * 4, x, true));
    return out;
  };
  chunk("SIZE", ints(sx, sy, sz));
  const body = new Uint8Array(4 + xyzi.length);
  new DataView(body.buffer).setInt32(0, xyzi.length / 4, true);
  body.set(xyzi, 4);
  chunk("XYZI", body);
  const rgba = new Uint8Array(256 * 4);
  colors.palette.forEach((hex, i) => {
    rgba[i * 4] = (hex >> 16) & 0xff;
    rgba[i * 4 + 1] = (hex >> 8) & 0xff;
    rgba[i * 4 + 2] = hex & 0xff;
    rgba[i * 4 + 3] = 255;
  });
  chunk("RGBA", rgba);

  const childBytes = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(8 + 12 + childBytes);
  const v = new DataView(out.buffer);
  out.set([86, 79, 88, 32], 0); // "VOX "
  v.setInt32(4, 150, true);
  out.set([77, 65, 73, 78], 8); // "MAIN"
  v.setInt32(12, 0, true);
  v.setInt32(16, childBytes, true);
  let at = 20;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** O .vox aceita 255 cores: se o modelo tiver mais, junta tons vizinhos até caber. */
function quantize(b: VoxelBuilder): { palette: number[]; map: (hex: number) => number } {
  const unique = new Set<number>();
  b.forEach((_x, _y, _z, hex) => unique.add(hex));
  for (let bits = 0; bits < 8; bits++) {
    const mask = (0xff << bits) & 0xff;
    const map = (hex: number) => bits === 0 ? hex : (((hex >> 16) & mask) << 16) | (((hex >> 8) & mask) << 8) | (hex & mask);
    const reduced = new Set([...unique].map(map));
    if (reduced.size <= 255) return { palette: [...reduced], map };
  }
  throw new Error("Cores demais");
}
