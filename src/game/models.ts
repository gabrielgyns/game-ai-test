import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "./voxel";
import type { Equipment } from "../domain/inventory";
import type { Item, Rarity } from "../domain/items";

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

const BLADE_BY_RARITY: Record<Rarity, string> = {
  common: "#d8dde6",
  uncommon: "#9fe3a8",
  rare: "#8fb3ff",
  epic: "#d29bff",
};

/** Assinatura visual do equipamento: quando muda, o modelo do herói é reconstruído. */
export function equipmentSignature(eq: Equipment | undefined): string {
  if (!eq) return "";
  return [eq.weapon?.icon, eq.weapon?.rarity, eq.armor?.visual, eq.armor?.rarity, eq.accessory?.icon].join("|");
}

/** Armas em repouso apontam para baixo (-Y) a partir da mão; o golpe gira o braço para a frente. */
function buildWeapon(arm: VoxelBuilder, weapon: Item | null): void {
  if (!weapon) return; // mãos vazias
  const blade = BLADE_BY_RARITY[weapon.rarity];
  const gold = "#c9a227";
  const wood = "#6b4a2b";
  switch (weapon.icon) {
    case "dagger":
      arm.box(-1, -7, -1, 1, -6, 0, gold);
      arm.box(-1, -12, -1, 0, -7, 0, blade);
      break;
    case "axe":
      arm.box(-1, -19, -1, 0, -6, 0, wood); // cabo
      arm.box(-1, -17, -5, 0, -10, -1, "#aab0b8"); // lâmina para a frente
      arm.box(-1, -16, -6, 0, -11, -5, blade); // fio
      break;
    case "sword":
    default: {
      const long = (weapon.stats.damage ?? 0) >= 12; // montante
      arm.box(-2, -7, -1, 2, -6, 0, gold); // guarda
      arm.box(-1, long ? -21 : -17, -1, 0, -7, 0, blade);
      if (long) arm.box(-3, -7, -1, 3, -6, 0, gold);
      break;
    }
  }
}

export function createHero(equipment?: Equipment): CharacterModel {
  const skin = "#e8b893", hair = "#4a2e1a", eye = "#1b1b1b";
  const armor = equipment?.armor ?? null;
  const visual = armor?.visual ?? "none";
  const cloth = visual === "none" ? "#3b5aa6" : visual === "tunic" ? "#8a5a2b" : visual === "chain" ? "#8c94a3" : "#4a4f5c";
  const trim = visual === "plate" ? "#c9a227" : visual === "chain" ? "#b9c0cc" : "#6b4a2b";
  const boots = equipment?.accessory?.icon === "boots" ? "#c9a227" : "#2b2b2b";
  const b = new VoxelBuilder();
  b.box(-3, 0, -1, -1, 6, 1, "#6b4a2b").box(1, 0, -1, 3, 6, 1, "#6b4a2b"); // pernas
  b.box(-3, 0, -1, -1, 2, 1, boots).box(1, 0, -1, 3, 2, 1, boots); // botas
  b.box(-4, 6, -2, 4, 13, 2, cloth); // tronco
  b.box(-4, 6, -2, 4, 7, 2, trim); // cinto
  if (visual === "plate") {
    b.box(-6, 11, -2, -4, 14, 2, trim).box(4, 11, -2, 6, 14, 2, trim); // ombreiras
    b.box(-2, 9, -3, 2, 12, -2, "#5c6170"); // peitoral
  }
  if (visual === "chain") b.box(-4, 12, -2, 4, 13, 2, trim); // gola de malha
  if (equipment?.accessory?.icon === "amulet") b.set(0, 11, -3, "#c9a227"); // amuleto no peito
  b.box(-6, 7, -1, -4, 13, 1, skin); // braço esquerdo
  if (equipment?.accessory?.icon === "ring") b.set(-5, 7, -1, "#c9a227"); // anel na mão esquerda
  b.box(-3, 13, -3, 3, 19, 3, skin); // cabeça
  b.box(-3, 18, -3, 3, 20, 3, hair).box(-3, 15, 1, 3, 19, 3, hair).box(-3, 17, -3, 3, 18, -2, hair); // cabelo
  if (visual === "plate") b.box(-3, 18, -3, 3, 21, 3, "#4a4f5c"); // elmo
  b.set(-2, 16, -3, eye).set(1, 16, -3, eye); // olhos

  const root = new THREE.Group();
  root.add(mesh(b));

  // Braço direito + arma equipada, com pivô no ombro para o golpe.
  const arm = new VoxelBuilder();
  arm.box(-1, -6, -1, 1, 0, 1, skin);
  buildWeapon(arm, equipment?.weapon ?? null);
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
  arm.box(-1, -12, -1, 0, -5, 0, "#8a5a2b"); // porrete
  arm.box(-2, -14, -2, 2, -11, 1, "#8a5a2b"); // cabeça do porrete
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
  arm.box(0, -20, -1, 1, -8, 0, "#5a3d2b"); // cabo do machado
  arm.box(0, -19, -7, 1, -12, -1, "#aab0b8"); // lâmina
  const weaponArm = new THREE.Group();
  weaponArm.position.set(7 * V, 17 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 25 * V + 0.1 };
}

export function createGoblinKing(): CharacterModel {
  const skin = "#6a9c3c", armor = "#5a2e2e", gold = "#e0b43a", eye = "#ffd54a", cape = "#7a1f2b";
  const b = new VoxelBuilder();
  b.box(-4, 0, -2, -1, 8, 2, skin).box(1, 0, -2, 4, 8, 2, skin); // pernas
  b.box(-4, 0, -2, -1, 2, 2, "#2b2b2b").box(1, 0, -2, 4, 2, 2, "#2b2b2b"); // botas
  b.box(-7, 8, -4, 7, 20, 4, armor); // tronco largo
  b.box(-7, 8, -4, 7, 10, 4, gold); // cinto dourado
  b.box(-8, 10, 4, 8, 20, 6, cape); // capa nas costas
  b.box(-10, 12, -2, -7, 20, 2, skin); // braço esquerdo
  b.box(-5, 20, -5, 5, 29, 5, skin); // cabeça
  b.box(-9, 24, -1, -5, 26, 1, skin).box(5, 24, -1, 9, 26, 1, skin); // orelhas
  b.set(-3, 25, -5, eye).set(-2, 25, -5, eye).set(2, 25, -5, eye).set(3, 25, -5, eye);
  b.box(-2, 21, -6, 2, 22, -5, "#f1ead6"); // dentes
  b.box(-5, 29, -5, 5, 30, 5, gold); // coroa: base
  for (const x of [-5, -2, 1, 4]) b.box(x, 30, -5, x + 1, 32, -4, gold).box(x, 30, 4, x + 1, 32, 5, gold);
  b.box(-5, 30, -5, -4, 32, 5, gold).box(4, 30, -5, 5, 32, 5, gold);
  b.set(0, 30, -5, "#e5484d"); // rubi

  const root = new THREE.Group();
  root.add(mesh(b));
  const arm = new VoxelBuilder();
  arm.box(-2, -9, -2, 2, 0, 2, skin);
  arm.box(-1, -24, -1, 1, -9, 1, "#5a3d2b"); // cabo do machado real
  arm.box(-1, -22, -8, 1, -12, -1, "#aab0b8"); // lâmina grande
  arm.box(-1, -21, -9, 1, -13, -8, gold); // fio dourado
  const weaponArm = new THREE.Group();
  weaponArm.position.set(9 * V, 20 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 32 * V + 0.2 };
}

export function createModel(archetype: string, equipment?: Equipment): CharacterModel {
  switch (archetype) {
    case "hero": return createHero(equipment);
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "orc": return createOrc();
    case "goblinKing": return createGoblinKing();
    default: return createSlime();
  }
}
