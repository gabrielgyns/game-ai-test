import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/** Um modelo visual com ganchos de animação simples. */
export interface CharacterModel {
  root: THREE.Group;
  /** Pivô do braço que balança no ataque. */
  weaponArm?: THREE.Object3D;
  /** Altura aproximada em metros, para posicionar a barra de vida. */
  height: number;
}

/** Tamanho de um voxel de personagem, em metros (8 voxels = 1 m). */
const V = 1 / 8;

function mesh(builder: VoxelBuilder, scale = V): THREE.Mesh {
  const m = new THREE.Mesh(builder.build(scale), voxelMaterial());
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/* Todos os modelos: origem nos pés, centro em X/Z, frente apontando para -Z. */

export function createHero(): CharacterModel {
  const skin = "#e8b893", cloth = "#3b5aa6", leather = "#6b4a2b", hair = "#4a2e1a", eye = "#1b1b1b";
  const b = new VoxelBuilder();
  b.box(-3, 0, -1, -1, 6, 1, leather).box(1, 0, -1, 3, 6, 1, leather); // pernas
  b.box(-3, 1, -1, -1, 2, 1, "#2b2b2b").box(1, 1, -1, 3, 2, 1, "#2b2b2b"); // botas
  b.box(-4, 6, -2, 4, 13, 2, cloth); // tronco
  b.box(-4, 6, -2, 4, 7, 2, leather); // cinto
  b.box(-6, 7, -1, -4, 13, 1, skin); // braço esquerdo
  b.box(-3, 13, -3, 3, 19, 3, skin); // cabeça
  b.box(-3, 18, -3, 3, 20, 3, hair).box(-3, 15, 1, 3, 19, 3, hair).box(-3, 17, -3, 3, 18, -2, hair); // cabelo
  b.set(-2, 16, -3, eye).set(1, 16, -3, eye); // olhos

  const root = new THREE.Group();
  root.add(mesh(b));

  // Braço direito + espada, com pivô no ombro para o golpe.
  const arm = new VoxelBuilder();
  arm.box(-1, -6, -1, 1, 0, 1, skin);
  arm.box(-1, -6, -3, 1, -5, -1, "#c9a227"); // guarda
  arm.box(-1, -6, -13, 0, -5, -3, "#d8dde6"); // lâmina
  const weaponArm = new THREE.Group();
  weaponArm.position.set(5 * V, 13 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 20 * V + 0.1 };
}

export function createSlime(): CharacterModel {
  const body = "#5fd36b", dark = "#3fa84c", eye = "#1b1b1b";
  const b = new VoxelBuilder();
  b.disc(0, 0, 0, 4.2, dark);
  b.disc(0, 1, 0, 5, body).disc(0, 2, 0, 5.2, body).disc(0, 3, 0, 5, body);
  b.disc(0, 4, 0, 4.3, body).disc(0, 5, 0, 3.2, body).disc(0, 6, 0, 1.8, body);
  b.set(-2, 3, -5, eye).set(-2, 4, -5, eye).set(2, 3, -5, eye).set(2, 4, -5, eye);
  const root = new THREE.Group();
  root.add(mesh(b));
  return { root, height: 7 * V + 0.15 };
}

export function createGoblin(): CharacterModel {
  const skin = "#7bb04a", rag = "#5a3d2b", eye = "#1b1b1b";
  const b = new VoxelBuilder();
  b.box(-2, 0, -1, -1, 4, 1, skin).box(1, 0, -1, 2, 4, 1, skin); // pernas finas
  b.box(-3, 4, -2, 3, 10, 2, rag); // tronco
  b.box(-5, 5, -1, -3, 10, 1, skin); // braço esquerdo
  b.box(-3, 10, -3, 3, 15, 3, skin); // cabeça
  b.box(-6, 12, -1, -3, 13, 0, skin).box(3, 12, -1, 6, 13, 0, skin); // orelhas
  b.set(-2, 12, -3, eye).set(1, 12, -3, eye);
  b.set(0, 10, -3, "#f1ead6").set(-1, 10, -3, "#f1ead6"); // dentes
  const root = new THREE.Group();
  root.add(mesh(b));

  const arm = new VoxelBuilder();
  arm.box(-1, -5, -1, 1, 0, 1, skin);
  arm.box(-1, -5, -8, 1, -4, -1, "#8a5a2b"); // porrete
  arm.box(-2, -6, -9, 2, -3, -6, "#8a5a2b"); // cabeça do porrete
  const weaponArm = new THREE.Group();
  weaponArm.position.set(4 * V, 10 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 15 * V + 0.1 };
}

export function createOrc(): CharacterModel {
  const skin = "#4f7a3a", armor = "#3c3c45", eye = "#ff4040";
  const b = new VoxelBuilder();
  b.box(-4, 0, -2, -1, 7, 2, skin).box(1, 0, -2, 4, 7, 2, skin); // pernas
  b.box(-6, 7, -3, 6, 17, 3, armor); // tronco largo
  b.box(-6, 7, -3, 6, 9, 3, "#2a2a30"); // cinto
  b.box(-9, 9, -2, -6, 17, 2, skin); // braço esquerdo
  b.box(-4, 17, -4, 4, 24, 4, skin); // cabeça
  b.box(-4, 23, -4, 4, 25, 4, armor); // elmo
  b.set(-3, 20, -4, eye).set(2, 20, -4, eye);
  b.set(-3, 17, -5, "#f1ead6").set(2, 17, -5, "#f1ead6").set(-3, 18, -5, "#f1ead6").set(2, 18, -5, "#f1ead6"); // presas
  const root = new THREE.Group();
  root.add(mesh(b));

  const arm = new VoxelBuilder();
  arm.box(-1, -8, -2, 2, 0, 2, skin);
  arm.box(0, -8, -14, 1, -7, -2, "#5a3d2b"); // cabo do machado
  arm.box(-1, -11, -14, 2, -4, -11, "#aab0b8"); // lâmina
  const weaponArm = new THREE.Group();
  weaponArm.position.set(7 * V, 17 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 25 * V + 0.1 };
}

export function createModel(archetype: string): CharacterModel {
  switch (archetype) {
    case "hero": return createHero();
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "orc": return createOrc();
    default: return createSlime();
  }
}
