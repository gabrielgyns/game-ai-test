import * as THREE from "three";
import { terrainHeight, WORLD_HALF } from "../domain/terrain";
import { clamp } from "../domain/math";

const GRASS_LOW = new THREE.Color("#6aa84f");
const GRASS_HIGH = new THREE.Color("#8fbf63");
const ROCK = new THREE.Color("#7d7a70");
const SAND = new THREE.Color("#c9b98a");

export function createTerrainMesh(): THREE.Mesh {
  const size = WORLD_HALF * 2;
  const segments = 160;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);

    // Cor por altura e inclinação: grama nas planícies, rocha nas encostas, areia no centro.
    const slope = Math.abs(terrainHeight(x + 1, z) - h) + Math.abs(terrainHeight(x, z + 1) - h);
    const t = clamp((h + 4) / 16, 0, 1);
    color.copy(GRASS_LOW).lerp(GRASS_HIGH, t);
    if (slope > 0.9) color.lerp(ROCK, clamp((slope - 0.9) / 1.2, 0, 1));
    if (Math.hypot(x, z) < 10) color.lerp(SAND, 1 - Math.hypot(x, z) / 10);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
