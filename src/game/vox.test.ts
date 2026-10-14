import { describe, expect, it } from "vitest";
import { VoxelBuilder } from "./voxel";
import { builderToVox, parseVox, voxToBuilder } from "./vox";

function snapshot(b: VoxelBuilder): string[] {
  const out: string[] = [];
  b.forEach((x, y, z, hex) => out.push(`${x},${y},${z}:${hex.toString(16)}`));
  return out.sort();
}

/** Um .vox de cena (versão 200) com dois modelos posicionados por nTRN, como o editor salva. */
function sceneVox(): ArrayBuffer {
  const bytes: number[] = [];
  const i32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, true); return [...b]; };
  const str = (s: string) => [...i32(s.length), ...[...s].map((c) => c.charCodeAt(0))];
  const dict = (d: Record<string, string>) => [...i32(Object.keys(d).length), ...Object.entries(d).flatMap(([k, v]) => [...str(k), ...str(v)])];
  const chunk = (id: string, content: number[]) => [...[...id].map((c) => c.charCodeAt(0)), ...i32(content.length), ...i32(0), ...content];
  const kids = [
    ...chunk("SIZE", [...i32(2), ...i32(2), ...i32(2)]),
    ...chunk("XYZI", [...i32(1), 0, 0, 0, 1]),
    ...chunk("SIZE", [...i32(2), ...i32(2), ...i32(2)]),
    ...chunk("XYZI", [...i32(1), 0, 0, 0, 2]),
    ...chunk("nTRN", [...i32(0), ...dict({}), ...i32(1), ...i32(-1), ...i32(-1), ...i32(1), ...dict({})]),
    ...chunk("nGRP", [...i32(1), ...dict({}), ...i32(2), ...i32(2), ...i32(4)]),
    ...chunk("nTRN", [...i32(2), ...dict({}), ...i32(3), ...i32(-1), ...i32(0), ...i32(1), ...dict({ _t: "0 0 0" })]),
    ...chunk("nSHP", [...i32(3), ...dict({}), ...i32(1), ...i32(0), ...dict({})]),
    ...chunk("nTRN", [...i32(4), ...dict({}), ...i32(5), ...i32(-1), ...i32(0), ...i32(1), ...dict({ _t: "0 0 5" })]),
    ...chunk("nSHP", [...i32(5), ...dict({}), ...i32(1), ...i32(1), ...dict({})]),
    ...chunk("RGBA", Array.from({ length: 256 }, (_, i) => (i === 0 ? [255, 0, 0, 255] : i === 1 ? [0, 0, 255, 255] : [0, 0, 0, 255])).flat()),
  ];
  bytes.push(..."VOX ".split("").map((c) => c.charCodeAt(0)), ...i32(200), ...chunk("MAIN", []).slice(0, 8), ...i32(kids.length), ...kids);
  return new Uint8Array(bytes).buffer;
}

describe(".vox do MagicaVoxel", () => {
  it("exporta e lê de volta o mesmo modelo, com as cores", () => {
    const b = new VoxelBuilder().box(-3, 0, -2, 3, 4, 2, "#6b4a2b").set(0, 4, 0, "#3b8f3a").set(-3, 0, -2, "#ff0000");
    const back = voxToBuilder(parseVox(builderToVox(b).buffer as ArrayBuffer));
    expect(back.size).toBe(b.size);
    expect(snapshot(back)).toEqual(snapshot(b));
  });

  it("converte os eixos: Z do editor vira Y (para cima) e a vista Front (-Y) vira a frente do jogo (-Z)", () => {
    // Um voxel no alto e outro na frente, num modelo 3×3×3 do editor.
    const b = new VoxelBuilder().set(0, 0, 0, "#808080").set(0, 2, 0, "#ff0000").set(0, 0, -1, "#00ff00");
    const file = parseVox(builderToVox(b).buffer as ArrayBuffer);
    const m = file.models[0]!;
    const editor: Record<string, [number, number, number]> = {};
    for (let i = 0; i < m.voxels.length; i += 4) {
      const rgba = file.palette[m.voxels[i + 3]! - 1]!;
      editor[(rgba & 0xff) === 255 ? "red" : ((rgba >> 8) & 0xff) === 255 ? "green" : "gray"] = [m.voxels[i]!, m.voxels[i + 1]!, m.voxels[i + 2]!];
    }
    expect(editor.red![2]).toBeGreaterThan(editor.gray![2]); // mais alto no Z do editor
    expect(editor.green![1]).toBeLessThan(editor.gray![1]); // mais para -Y (Front) no editor
  });

  it("lê cenas com vários modelos posicionados pelo grafo de cena", () => {
    const b = voxToBuilder(parseVox(sceneVox()));
    expect(b.size).toBe(2);
    const ys: number[] = [];
    const colors: number[] = [];
    b.forEach((_x, y, _z, hex) => { ys.push(y); colors.push(hex); });
    expect(Math.max(...ys) - Math.min(...ys)).toBe(5); // o segundo modelo subiu 5 no Z do editor
    expect(colors.sort()).toEqual([0x0000ff, 0xff0000].sort());
  });

  it("recusa arquivo que não é .vox", () => {
    expect(() => parseVox(new Uint8Array(40).buffer)).toThrow();
  });

  it("modelos com mais de 255 cores são reduzidos para caber na paleta", () => {
    const b = new VoxelBuilder();
    for (let i = 0; i < 600; i++) b.set(i % 30, Math.floor(i / 30), 0, (i * 2654435761) & 0xffffff);
    const file = parseVox(builderToVox(b).buffer as ArrayBuffer);
    expect(file.models[0]!.voxels.length / 4).toBe(600);
  });
});
