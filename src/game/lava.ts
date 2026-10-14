import * as THREE from "three";
import { CELL_SIZE, isLava, LAVA_LEVEL, WORLD_HALF } from "../domain/terrain";
import type { ZoneDefinition } from "../domain/zones";

/**
 * Lava: uma lâmina incandescente sobre as células de lava da zona, com cor acima de 1 (acende no
 * bloom), veios mais escuros de crosta e um pulso lento. Uma malha só, com cor por vértice.
 */
export interface LavaMesh {
  mesh: THREE.Mesh;
  update(time: number): void;
}

export function createLavaMesh(zone: ZoneDefinition): LavaMesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const hot = new THREE.Color("#ff7a1a"), bright = new THREE.Color("#ffc24a"), crust = new THREE.Color("#8a2a0a");
  const c = new THREE.Color();
  const y = LAVA_LEVEL + 0.06;
  for (let i = -WORLD_HALF; i < WORLD_HALF; i += CELL_SIZE)
    for (let j = -WORLD_HALF; j < WORLD_HALF; j += CELL_SIZE) {
      const x0 = zone.center.x + i, z0 = zone.center.z + j;
      if (!isLava(x0 + 0.5, z0 + 0.5)) continue;
      const corners: [number, number][] = [[x0, z0], [x0, z0 + 1], [x0 + 1, z0 + 1], [x0 + 1, z0]];
      const col = corners.map(([x, z]) => {
        const v = Math.sin(x * 0.7 + z * 0.3) * Math.sin(z * 0.5 - x * 0.2);
        return c.copy(hot).lerp(v > 0.55 ? crust : bright, v > 0.55 ? 0.7 : Math.max(0, v) * 0.6).clone();
      });
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [x, z] = corners[k]!;
        positions.push(x, y, z);
        colors.push(col[k]!.r, col[k]!.g, col[k]!.b);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  material.color.setScalar(1.6);
  const mesh = new THREE.Mesh(g, material);
  return {
    mesh,
    update(time) {
      material.color.setScalar(1.45 + Math.sin(time * 1.3) * 0.18 + Math.sin(time * 3.1) * 0.06);
    },
  };
}
