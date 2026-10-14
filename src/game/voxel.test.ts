import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { VoxelBuilder } from "./voxel";

function faceNormalsMatch(geometry: THREE.BufferGeometry): boolean {
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  const idx = geometry.getIndex()!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    n.fromBufferAttribute(nor, idx.getX(i));
    const computed = b.clone().sub(a).cross(c.clone().sub(a));
    if (computed.dot(n) <= 0) return false;
  }
  return true;
}

describe("VoxelBuilder", () => {
  it("um cubo sozinho vira 6 quads com normais para fora", () => {
    const g = new VoxelBuilder().set(0, 0, 0, "#fff").build(1);
    expect(g.getIndex()!.count).toBe(6 * 6);
    expect(faceNormalsMatch(g)).toBe(true);
  });

  it("funde faces coplanares da mesma cor (greedy meshing)", () => {
    const g = new VoxelBuilder().box(0, 0, 0, 8, 3, 8, "#3b8f3a").build(1);
    expect(g.getIndex()!.count).toBe(6 * 6); // caixa sólida de uma cor = 6 retângulos
    expect(faceNormalsMatch(g)).toBe(true);
  });

  it("não funde cores diferentes nem faces internas", () => {
    const g = new VoxelBuilder().set(0, 0, 0, "#f00").set(1, 0, 0, "#0f0").build(1);
    // 2 cubos colados: 10 faces expostas, nenhuma fundida (cores diferentes).
    expect(g.getIndex()!.count).toBe(10 * 6);
    expect(faceNormalsMatch(g)).toBe(true);
  });
});

describe("VoxelBuilder: oclusão, grão e carimbos", () => {
  function colorAt(g: THREE.BufferGeometry, i: number): number {
    const c = g.getAttribute("color");
    return c.getX(i) + c.getY(i) + c.getZ(i);
  }

  it("a oclusão ambiente escurece o canto onde duas faces se encontram", () => {
    // Um degrau em L: a face de cima do bloco baixo encosta na parede do bloco alto.
    const b = new VoxelBuilder().set(0, 0, 0, "#fff").set(1, 0, 0, "#fff").set(1, 1, 0, "#fff");
    const lit = b.build(1, { ao: false, jitter: 0 });
    const shaded = b.build(1, { ao: true, jitter: 0 });
    const brightest = (g: THREE.BufferGeometry) => Math.max(...Array.from({ length: g.getAttribute("color").count }, (_, i) => colorAt(g, i)));
    const total = (g: THREE.BufferGeometry) => Array.from({ length: g.getAttribute("color").count }, (_, i) => colorAt(g, i)).reduce((a, c) => a + c, 0);
    expect(brightest(shaded)).toBeCloseTo(brightest(lit), 5); // faces livres não mudam
    expect(total(shaded)).toBeLessThan(total(lit)); // o canto do L escurece
    expect(faceNormalsMatch(shaded)).toBe(true);
  });

  it("sem oclusão nem grão, uma caixa continua sendo 6 retângulos", () => {
    const g = new VoxelBuilder().box(0, 0, 0, 4, 4, 4, "#abc").build(1, { ao: true, jitter: 0 });
    expect(g.getIndex()!.count).toBe(6 * 6); // a AO só muda em cantos côncavos
  });

  it("o grão varia o brilho por cubo e quebra a fusão", () => {
    const g = new VoxelBuilder().box(0, 0, 0, 4, 1, 4, "#888").build(1, { grain: 0.2 });
    expect(g.getIndex()!.count).toBeGreaterThan(6 * 6);
    expect(faceNormalsMatch(g)).toBe(true);
  });

  it("stampXY desenha de cima para baixo e ignora pontos", () => {
    const b = new VoxelBuilder().stampXY(["a.", ".b"], { a: "#f00", b: "#0f0" }, 0, 0, 0);
    expect(b.has(0, 1, 0)).toBe(true); // 'a' na linha de cima
    expect(b.has(1, 0, 0)).toBe(true); // 'b' na linha de baixo
    expect(b.has(1, 1, 0)).toBe(false);
    expect(b.has(0, 0, 0)).toBe(false);
  });

  it("carve remove e mirrorX espelha em volta do centro", () => {
    const b = new VoxelBuilder().box(0, 0, 0, 2, 1, 1, "#fff").carve(1, 0, 0, 2, 1, 1).mirrorX();
    expect(b.has(0, 0, 0)).toBe(true);
    expect(b.has(-1, 0, 0)).toBe(true);
    expect(b.has(1, 0, 0)).toBe(false);
  });
});
