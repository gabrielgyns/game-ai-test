import * as THREE from "three";

/**
 * Construtor de malhas voxel. Você "pinta" cubos numa grade inteira e ele gera uma única
 * BufferGeometry com cores por vértice, descartando faces internas (entre dois cubos).
 * Pense nele como LEGO: cada peça é um cubo de 1 unidade; `scale` diz quantos metros tem a peça.
 *
 * Além das cores, a malha carrega dois efeitos "cozidos" nos vértices que fazem a diferença entre
 * um voxel chapado e um voxel rico:
 * - oclusão ambiente (AO): cantos e dobras ficam mais escuros, como sujeira que se acumula nas
 *   frestas de uma miniatura;
 * - grão: cada cubo recebe uma variação mínima de brilho, como a textura de um tecido.
 */
export interface BuildOptions {
  /** Variação de brilho por retângulo fundido (legado, mantido para o cenário). */
  jitter?: number;
  /** Variação de brilho por cubo (quebra a fusão de faces; ideal para personagens). */
  grain?: number;
  /** Tamanho da mancha do grão em voxels (2 = manchas 2×2×2, funde mais faces; bom para cenário). */
  grainScale?: number;
  /** Oclusão ambiente nos cantos. */
  ao?: boolean;
  /** Intensidade do escurecimento por AO (0 = nenhum, 1 = forte). */
  aoStrength?: number;
}

export class VoxelBuilder {
  private readonly voxels = new Map<string, THREE.Color>();

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  set(x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    this.voxels.set(this.key(x, y, z), color instanceof THREE.Color ? color : new THREE.Color(color));
    return this;
  }

  remove(x: number, y: number, z: number): this {
    this.voxels.delete(this.key(x, y, z));
    return this;
  }

  /** Preenche a caixa [x0,x1) × [y0,y1) × [z0,z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.ColorRepresentation): this {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    // Aceita os cantos em qualquer ordem (útil ao espelhar com sinal negativo).
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x < bx; x++)
      for (let y = ay; y < by; y++)
        for (let z = az; z < bz; z++) this.set(x, y, z, c);
    return this;
  }

  /** Esvazia a caixa [x0,x1) × [y0,y1) × [z0,z1). */
  carve(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x < bx; x++)
      for (let y = ay; y < by; y++)
        for (let z = az; z < bz; z++) this.remove(x, y, z);
    return this;
  }

  /**
   * Pinta o voxel mais à frente (menor z) da coluna (x, y), como quem pinta um olho numa bola:
   * a cor fica na superfície, seja ela qual for. `depth` > 0 também pinta os voxels logo atrás.
   */
  recolorFront(x: number, y: number, color: THREE.ColorRepresentation, depth = 1): this {
    for (let z = -64; z <= 64; z++) {
      if (!this.has(x, y, z)) continue;
      for (let d = 0; d < depth; d++) if (this.has(x, y, z + d)) this.set(x, y, z + d, color);
      return this;
    }
    return this;
  }

  /** Preenche um "disco" arredondado em y (útil para gosmas e copas de árvore). */
  disc(cx: number, y: number, cz: number, radius: number, color: THREE.ColorRepresentation): this {
    const r = Math.ceil(radius);
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++)
        if (x * x + z * z <= radius * radius + 0.3) this.set(cx + x, y, cz + z, color);
    return this;
  }

  /** Esfera (ou elipsoide) centrada em (cx, cy, cz). */
  sphere(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: THREE.ColorRepresentation): this {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++)
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
        for (let z = Math.floor(-rz); z <= Math.ceil(rz); z++) {
          const d = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
          if (d <= 1.05) this.set(cx + x, cy + y, cz + z, c);
        }
    return this;
  }

  /**
   * Carimba um desenho ASCII no plano XY (visto de frente, olhando para -Z), extrudado em Z.
   * A primeira linha é o topo. `palette` mapeia cada letra para uma cor; "." é transparente.
   * `x0` é a coluna da esquerda e `y0` a linha de baixo; o desenho ocupa z em [z0, z1).
   */
  stampXY(rows: string[], palette: Record<string, THREE.ColorRepresentation>, x0: number, y0: number, z0: number, z1 = z0 + 1): this {
    rows.forEach((row, r) => {
      const y = y0 + (rows.length - 1 - r);
      [...row].forEach((ch, c) => {
        const color = palette[ch];
        if (color === undefined) return;
        for (let z = z0; z < z1; z++) this.set(x0 + c, y, z, color);
      });
    });
    return this;
  }

  /** Carimba um desenho ASCII no plano XZ (visto de cima; primeira linha = fundo, -Z), extrudado em Y. */
  stampXZ(rows: string[], palette: Record<string, THREE.ColorRepresentation>, x0: number, z0: number, y0: number, y1 = y0 + 1): this {
    rows.forEach((row, r) => {
      const z = z0 + r;
      [...row].forEach((ch, c) => {
        const color = palette[ch];
        if (color === undefined) return;
        for (let y = y0; y < y1; y++) this.set(x0 + c, y, z, color);
      });
    });
    return this;
  }

  /** Copia todos os voxels de outro builder com deslocamento. */
  merge(other: VoxelBuilder, dx = 0, dy = 0, dz = 0): this {
    for (const [key, color] of other.voxels) {
      const [x, y, z] = key.split(",").map(Number) as [number, number, number];
      this.set(x + dx, y + dy, z + dz, color);
    }
    return this;
  }

  /** Espelha em X (x → -1 - x, para grades centradas entre -n e n). */
  mirrorX(): this {
    const copy = [...this.voxels];
    for (const [key, color] of copy) {
      const [x, y, z] = key.split(",").map(Number) as [number, number, number];
      this.set(-1 - x, y, z, color);
    }
    return this;
  }

  has(x: number, y: number, z: number): boolean {
    return this.voxels.has(this.key(x, y, z));
  }

  get size(): number {
    return this.voxels.size;
  }

  /**
   * Gera a geometria. Faces vizinhas, coplanares, da mesma cor e com a mesma oclusão são fundidas
   * num único retângulo (greedy meshing): uma copa de árvore 8×3×8 vira poucos quads em vez de
   * centenas.
   */
  build(scale: number, options: number | BuildOptions = {}): THREE.BufferGeometry {
    const opts: BuildOptions = typeof options === "number" ? { jitter: options } : options;
    const jitter = opts.jitter ?? 0.06;
    const grain = opts.grain ?? 0;
    const grainScale = Math.max(1, Math.round(opts.grainScale ?? 1));
    const ao = opts.ao ?? true;
    const aoStrength = opts.aoStrength ?? 0.5;

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const tmp = new THREE.Color();

    interface Cell {
      u: number;
      v: number;
      color: THREE.Color;
      /** Assinatura de fusão: cor + AO dos 4 cantos + grão. */
      sig: string;
      ao: [number, number, number, number];
      shade: number;
    }

    for (const face of FACES) {
      // Agrupa as faces expostas desta direção por camada (coordenada ao longo da normal).
      const layers = new Map<number, Map<string, Cell>>();
      for (const [key, color] of this.voxels) {
        const [x, y, z] = key.split(",").map(Number) as [number, number, number];
        if (this.has(x + face.n[0], y + face.n[1], z + face.n[2])) continue;
        const p: [number, number, number] = [x, y, z];
        const d = p[face.axis];
        const u = p[face.uAxis];
        const v = p[face.vAxis];
        const aoQuad = ao ? this.faceAO(p, face) : ([3, 3, 3, 3] as [number, number, number, number]);
        const shade = grain > 0 ? 1 + (hash(Math.floor(x / grainScale), Math.floor(y / grainScale), Math.floor(z / grainScale)) - 0.5) * grain * 2 : 1;
        const sig = `${color.getHex()}|${aoQuad.join("")}|${grain > 0 ? shade.toFixed(3) : ""}`;
        let layer = layers.get(d);
        if (!layer) layers.set(d, (layer = new Map()));
        layer.set(`${u},${v}`, { u, v, color, sig, ao: aoQuad, shade });
      }

      for (const [d, layer] of layers) {
        const done = new Set<string>();
        for (const [k, cell] of layer) {
          if (done.has(k)) continue;
          const same = (u: number, v: number) => {
            const c = layer.get(`${u},${v}`);
            return c !== undefined && !done.has(`${u},${v}`) && c.sig === cell.sig;
          };
          // Estende em u, depois em v enquanto a linha inteira combinar.
          let w = 1;
          while (same(cell.u + w, cell.v)) w++;
          let h = 1;
          outer: for (;;) {
            for (let i = 0; i < w; i++) if (!same(cell.u + i, cell.v + h)) break outer;
            h++;
          }
          for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) done.add(`${cell.u + i},${cell.v + j}`);

          const quadShade = grain > 0 ? cell.shade : 1 + (hash(cell.u, d, cell.v) - 0.5) * jitter * 2;
          const plane = d + (face.n[face.axis] > 0 ? 1 : 0);
          const corner = (u: number, v: number): [number, number, number] => {
            const out: [number, number, number] = [0, 0, 0];
            out[face.axis] = plane;
            out[face.uAxis] = u;
            out[face.vAxis] = v;
            return out;
          };
          // Cantos na ordem (u-,v-), (u+,v-), (u+,v+), (u-,v+), casando com `faceAO`.
          const corners: { p: [number, number, number]; ao: number }[] = [
            { p: corner(cell.u, cell.v), ao: cell.ao[0] },
            { p: corner(cell.u + w, cell.v), ao: cell.ao[1] },
            { p: corner(cell.u + w, cell.v + h), ao: cell.ao[2] },
            { p: corner(cell.u, cell.v + h), ao: cell.ao[3] },
          ];
          // Garante winding anti-horário visto de fora: (c1-c0)×(c2-c0) deve apontar como a normal.
          const [c0, c1, c2] = [corners[0]!.p, corners[1]!.p, corners[2]!.p];
          const ax = c1[0] - c0[0], ay = c1[1] - c0[1], az = c1[2] - c0[2];
          const bx = c2[0] - c0[0], by = c2[1] - c0[1], bz = c2[2] - c0[2];
          const cross = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
          if (cross[0]! * face.n[0] + cross[1]! * face.n[1] + cross[2]! * face.n[2] < 0) corners.reverse();
          const base = positions.length / 3;
          for (const c of corners) {
            const occlusion = 1 - ((3 - c.ao) / 3) * aoStrength;
            tmp.copy(cell.color).multiplyScalar(quadShade * face.light * occlusion);
            positions.push(c.p[0] * scale, c.p[1] * scale, c.p[2] * scale);
            normals.push(face.n[0], face.n[1], face.n[2]);
            colors.push(tmp.r, tmp.g, tmp.b);
          }
          // Diagonal que acompanha a AO: evita o artefato de "X" nos cantos escuros.
          const flip = corners[0]!.ao + corners[2]!.ao > corners[1]!.ao + corners[3]!.ao;
          if (flip) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Oclusão ambiente clássica de voxels: para cada canto da face, conta os vizinhos laterais e
   * o diagonal no plano logo acima da face. 3 = livre, 0 = encaixado numa quina.
   */
  private faceAO(p: [number, number, number], face: Face): [number, number, number, number] {
    const q: [number, number, number] = [p[0] + face.n[0], p[1] + face.n[1], p[2] + face.n[2]];
    const at = (du: number, dv: number): boolean => {
      const s: [number, number, number] = [q[0], q[1], q[2]];
      s[face.uAxis] += du;
      s[face.vAxis] += dv;
      return this.has(s[0], s[1], s[2]);
    };
    const vertex = (du: number, dv: number): number => {
      const side1 = at(du, 0), side2 = at(0, dv), corner = at(du, dv);
      if (side1 && side2) return 0;
      return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
    };
    return [vertex(-1, -1), vertex(1, -1), vertex(1, 1), vertex(-1, 1)];
  }
}

function hash(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

interface Face {
  n: [number, number, number];
  /** Eixo da normal e os dois eixos do plano (0 = x, 1 = y, 2 = z). */
  axis: 0 | 1 | 2;
  uAxis: 0 | 1 | 2;
  vAxis: 0 | 1 | 2;
  /** Multiplicador de luz "cozido" por direção, reforça a leitura dos blocos. */
  light: number;
}

const FACES: Face[] = [
  { n: [0, 1, 0], axis: 1, uAxis: 0, vAxis: 2, light: 1.0 },
  { n: [0, -1, 0], axis: 1, uAxis: 0, vAxis: 2, light: 0.55 },
  { n: [1, 0, 0], axis: 0, uAxis: 1, vAxis: 2, light: 0.86 },
  { n: [-1, 0, 0], axis: 0, uAxis: 1, vAxis: 2, light: 0.78 },
  { n: [0, 0, 1], axis: 2, uAxis: 0, vAxis: 1, light: 0.9 },
  { n: [0, 0, -1], axis: 2, uAxis: 0, vAxis: 1, light: 0.72 },
];

export const voxelMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });

/* ---------- Paleta: tons derivados de uma cor base ---------- */

/** Clareia (k > 0) ou escurece (k < 0) uma cor em HSL, mantendo o matiz. */
export function tone(color: THREE.ColorRepresentation, k: number): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const l = Math.min(1, Math.max(0, hsl.l + k));
  // Sombras ficam um pouco mais saturadas e luzes um pouco menos, como em pintura.
  const s = Math.min(1, Math.max(0, hsl.s + (k < 0 ? 0.08 : -0.05)));
  c.setHSL(hsl.h, s, l);
  return `#${c.getHexString()}`;
}

/** Conjunto de tons de um material: sombra, base, luz. */
export interface Shades {
  dark: string;
  base: string;
  light: string;
}

export function shades(color: THREE.ColorRepresentation, spread = 0.1): Shades {
  return { dark: tone(color, -spread), base: `#${new THREE.Color(color).getHexString()}`, light: tone(color, spread) };
}
