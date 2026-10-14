import * as THREE from "three";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "../domain/terrain";
import { seededRandom } from "../domain/worldgen";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/** Voxel de cenário: 4 por metro (mais grosso que os personagens, como blocos de mundo). */
const V = 1 / 4;

function treeGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const trunk = "#6b4a2b";
  const leaf = ["#2f7a3e", "#3b8f3a", "#2a6b4a"][variant % 3]!;
  const h = 6 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, trunk);
  // Copa em camadas: larga embaixo, estreita em cima.
  b.box(-4, h - 1, -4, 4, h + 2, 4, leaf);
  b.box(-3, h + 2, -3, 3, h + 4, 3, leaf);
  b.box(-2, h + 4, -2, 2, h + 6, 2, leaf);
  b.box(-1, h + 6, -1, 1, h + 7, 1, leaf);
  return b.build(V, 0.1);
}

function rockGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const stone = ["#8a8780", "#77756e", "#9a968c"][variant % 3]!;
  b.box(-3, 0, -2, 3, 2, 2, stone);
  b.box(-2, 2, -2, 2, 3, 1, stone);
  b.box(-1, 3, -1, 1, 4, 1, stone);
  if (variant % 2) b.box(-4, 0, -1, -3, 1, 1, stone);
  return b.build(V, 0.1);
}

/** Árvores, pedras e santuário, todos em voxels e instanciados. */
export function createEnvironment(seed = 4242): THREE.Group {
  const group = new THREE.Group();
  const rand = seededRandom(seed);
  const dummy = new THREE.Object3D();

  const TREES_PER_VARIANT = 90;
  for (let v = 0; v < 3; v++) {
    const trees = new THREE.InstancedMesh(treeGeometry(v), voxelMaterial(), TREES_PER_VARIANT);
    trees.castShadow = trees.receiveShadow = true;
    for (let i = 0; i < TREES_PER_VARIANT; i++) {
      const { x, z } = randomPoint(rand, SPAWN_FLAT_RADIUS + 2);
      dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
      dummy.rotation.set(0, Math.floor(rand() * 4) * (Math.PI / 2), 0);
      dummy.scale.setScalar(0.85 + rand() * 0.5);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    }
    group.add(trees);
  }

  const ROCKS_PER_VARIANT = 40;
  for (let v = 0; v < 3; v++) {
    const rocks = new THREE.InstancedMesh(rockGeometry(v), voxelMaterial(), ROCKS_PER_VARIANT);
    rocks.castShadow = rocks.receiveShadow = true;
    for (let i = 0; i < ROCKS_PER_VARIANT; i++) {
      const { x, z } = randomPoint(rand, 6);
      dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
      dummy.rotation.set(0, Math.floor(rand() * 4) * (Math.PI / 2), 0);
      dummy.scale.setScalar(0.7 + rand() * 1.2);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    group.add(rocks);
  }

  // Santuário: pilares de pedra clara em círculo, ponto de referência do spawn.
  const pillar = new VoxelBuilder().box(-1, 0, -1, 1, 5, 1, "#d9d2c0").box(-2, 5, -2, 2, 6, 2, "#c8bfa8").build(V, 0.08);
  const pillars = new THREE.InstancedMesh(pillar, voxelMaterial(), 8);
  pillars.castShadow = pillars.receiveShadow = true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    dummy.position.set(Math.round(Math.cos(a) * 8) + 0.5, terrainHeight(0, 0), Math.round(Math.sin(a) * 8) + 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix);
  }
  group.add(pillars);
  return group;
}

function randomPoint(rand: () => number, minRadius: number): { x: number; z: number } {
  for (;;) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 6);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 6);
    if (Math.hypot(x, z) >= minRadius) return { x, z };
  }
}
