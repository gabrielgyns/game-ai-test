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
