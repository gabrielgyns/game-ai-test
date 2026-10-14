import * as THREE from "three";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "../domain/terrain";
import { BOSS_HOME, seededRandom } from "../domain/worldgen";
import { biomeAt, SWAMP_BOSS_HOME } from "../domain/biomes";
import { isWater } from "../domain/terrain";
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
  return b.build(V, { grain: 0.09, grainScale: 2 });
}

function rockGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const stone = ["#8a8780", "#77756e", "#9a968c"][variant % 3]!;
  b.box(-3, 0, -2, 3, 2, 2, stone);
  b.box(-2, 2, -2, 2, 3, 1, stone);
  b.box(-1, 3, -1, 1, 4, 1, stone);
  if (variant % 2) b.box(-4, 0, -1, -3, 1, 1, stone);
  return b.build(V, { grain: 0.08, grainScale: 2 });
}

function deadTreeGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const bark = ["#3b2f25", "#4a3a2c"][variant % 2]!;
  const h = 7 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, bark);
  b.box(-4, h - 3, 0, -1, h - 2, 1, bark).box(-5, h - 2, 0, -4, h + 1, 1, bark); // galho esquerdo
  b.box(1, h - 1, -1, 4, h, 0, bark).box(3, h, -1, 4, h + 3, 0, bark); // galho direito
  if (variant % 2) b.box(-1, h, -1, 1, h + 2, 1, bark);
  return b.build(V, 0.08);
}

function mushroomGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(-1, 0, -1, 1, 3, 1, "#d9cfb8");
  b.box(-3, 3, -3, 3, 5, 3, "#7a3d8f").box(-2, 5, -2, 2, 6, 2, "#8f4da3");
  b.set(-2, 4, -3, "#e8dcc0").set(2, 4, 3, "#e8dcc0").set(0, 5, -2, "#e8dcc0");
  return b.build(V, 0.1);
}

function cactusGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const green = ["#4f8f3a", "#3f7a33"][variant % 2]!;
  const h = 8 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, green);
  b.box(-3, 3, -1, -1, 4, 0, green).box(-3, 4, -1, -2, h - 2, 0, green); // braço
  if (variant % 2) b.box(1, 5, -1, 3, 6, 0, green).box(2, 6, -1, 3, h - 1, 0, green);
  b.set(0, h, 0, "#f0d0d8"); // flor
  return b.build(V, 0.06);
}

function bonesGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const bone = "#e8e0cf";
  b.box(-4, 0, -1, 4, 1, 0, bone); // espinha
  for (const x of [-3, -1, 1, 3]) b.box(x, 0, -3, x + 1, 1, 3, bone);
  b.box(4, 0, -2, 7, 2, 2, bone).box(5, 1, -3, 6, 2, -2, bone); // crânio
  return b.build(V, 0.05);
}

/** Catálogo de adereços de cenário, para a vitrine (/lab). */
export const PROP_BUILDERS: Record<string, () => THREE.BufferGeometry> = {
  "Árvore 1": () => treeGeometry(0),
  "Árvore 2": () => treeGeometry(1),
  "Árvore 3": () => treeGeometry(2),
  "Pedra 1": () => rockGeometry(0),
  "Pedra 2": () => rockGeometry(1),
  "Árvore morta 1": () => deadTreeGeometry(0),
  "Árvore morta 2": () => deadTreeGeometry(1),
  "Cogumelo": () => mushroomGeometry(),
  "Cacto 1": () => cactusGeometry(0),
  "Cacto 2": () => cactusGeometry(1),
  "Ossada": () => bonesGeometry(),
  "Pilar do santuário": () => pillarGeometry(),
  "Totem goblin": () => totemGeometry(),
  "Casulo de teia": () => cocoonGeometry(),
};

function pillarGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder().box(-1, 0, -1, 1, 5, 1, "#d9d2c0").box(-2, 5, -2, 2, 6, 2, "#c8bfa8").build(V, 0.08);
}

function totemGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 7, 1, "#5a3d2b")
    .box(-2, 7, -2, 2, 10, 2, "#e8dcc0")
    .set(-1, 8, -3, "#1b1b1b").set(0, 8, -3, "#1b1b1b")
    .box(-3, 4, -1, 3, 5, 1, "#7a1f2b")
    .build(V, 0.08);
}

function cocoonGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 8, 1, "#3b2f25")
    .box(-2, 5, -2, 2, 9, 2, "#e8e4da").box(-3, 6, -1, 3, 8, 1, "#e8e4da").box(-1, 6, -3, 1, 8, 3, "#e8e4da")
    .set(-2, 7, -3, "#b8322f").set(2, 7, 3, "#b8322f")
    .build(V, 0.06);
}

/** Árvores, pedras e santuário, todos em voxels e instanciados. */
export function createEnvironment(seed = 4242): THREE.Group {
  const group = new THREE.Group();
  const rand = seededRandom(seed);
  const dummy = new THREE.Object3D();

  const TREES_PER_VARIANT = 70;
  for (let v = 0; v < 3; v++) {
    const trees = new THREE.InstancedMesh(treeGeometry(v), voxelMaterial(), TREES_PER_VARIANT);
    trees.castShadow = trees.receiveShadow = true;
    for (let i = 0; i < TREES_PER_VARIANT; i++) {
      const { x, z } = randomPoint(rand, SPAWN_FLAT_RADIUS + 2, "meadow");
      dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
      dummy.rotation.set(0, Math.floor(rand() * 4) * (Math.PI / 2), 0);
      dummy.scale.setScalar(0.85 + rand() * 0.5);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    }
    group.add(trees);
  }

  // Pântano: árvores mortas e cogumelos. Deserto: cactos e ossadas.
  const biomeProps: { geometry: THREE.BufferGeometry; count: number; biome: "swamp" | "desert"; scale: [number, number] }[] = [
    { geometry: deadTreeGeometry(0), count: 40, biome: "swamp", scale: [0.9, 1.5] },
    { geometry: deadTreeGeometry(1), count: 40, biome: "swamp", scale: [0.9, 1.5] },
    { geometry: mushroomGeometry(), count: 45, biome: "swamp", scale: [0.5, 1.2] },
    { geometry: cactusGeometry(0), count: 35, biome: "desert", scale: [0.8, 1.4] },
    { geometry: cactusGeometry(1), count: 35, biome: "desert", scale: [0.8, 1.4] },
    { geometry: bonesGeometry(), count: 20, biome: "desert", scale: [0.8, 1.3] },
  ];
  for (const prop of biomeProps) {
    const mesh = new THREE.InstancedMesh(prop.geometry, voxelMaterial(), prop.count);
    mesh.castShadow = mesh.receiveShadow = true;
    for (let i = 0; i < prop.count; i++) {
      const { x, z } = randomPoint(rand, 6, prop.biome);
      dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
      dummy.rotation.set(0, Math.floor(rand() * 4) * (Math.PI / 2), 0);
      dummy.scale.setScalar(prop.scale[0] + rand() * (prop.scale[1] - prop.scale[0]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
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
  const pillars = new THREE.InstancedMesh(pillarGeometry(), voxelMaterial(), 8);
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

  // Arena do chefe: anel de totens goblin com crânios, no platô norte.
  const totems = new THREE.InstancedMesh(totemGeometry(), voxelMaterial(), 10);
  totems.castShadow = totems.receiveShadow = true;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = BOSS_HOME.x + Math.cos(a) * 12;
    const z = BOSS_HOME.z + Math.sin(a) * 12;
    dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
    dummy.rotation.set(0, -a + Math.PI / 2, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    totems.setMatrixAt(i, dummy.matrix);
  }
  group.add(totems);

  // Arena da Rainha Aranha: casulos de teia pendurados em estacas, no pântano.
  const cocoons = new THREE.InstancedMesh(cocoonGeometry(), voxelMaterial(), 10);
  cocoons.castShadow = cocoons.receiveShadow = true;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = SWAMP_BOSS_HOME.x + Math.cos(a) * 12;
    const z = SWAMP_BOSS_HOME.z + Math.sin(a) * 12;
    dummy.position.set(Math.floor(x) + 0.5, terrainHeight(x, z), Math.floor(z) + 0.5);
    dummy.rotation.set(0, -a, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    cocoons.setMatrixAt(i, dummy.matrix);
  }
  group.add(cocoons);
  return group;
}

function randomPoint(rand: () => number, minRadius: number, biome?: "meadow" | "swamp" | "desert"): { x: number; z: number } {
  for (;;) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 6);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 6);
    if (Math.hypot(x, z) < minRadius) continue;
    if (Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < 15) continue; // arenas dos chefes livres
    if (Math.hypot(x - SWAMP_BOSS_HOME.x, z - SWAMP_BOSS_HOME.z) < 15) continue;
    if (biome && biomeAt(x, z) !== biome) continue;
    if (isWater(x, z)) continue;
    return { x, z };
  }
}
