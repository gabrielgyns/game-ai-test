import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "../game/voxel";
import type { Equipment } from "../domain/inventory";
import type { Item, Rarity } from "../domain/items";
import type { ClassId } from "../domain/classes";

/** Um modelo visual com ganchos de animação simples. */
export interface CharacterModel {
  root: THREE.Group;
  /** Pivô do braço que balança no ataque. */
  weaponArm?: THREE.Object3D;
  /** Altura aproximada em metros, para posicionar a barra de vida. */
  height: number;
  /** Materiais com glow de raridade (arma, armadura), para pulsar a intensidade. */
  glowMaterials?: { material: THREE.MeshStandardMaterial; baseIntensity: number }[];
}

const RARITY_GLOW: Record<Rarity, string | null> = {
  common: null,
  uncommon: "#5fd36b",
  rare: "#5b8def",
  epic: "#b06cf0",
};

/** Material da peça: tingido leve na cor da raridade (a cor do item continua legível). */
function glowMaterial(rarity: Rarity, intensity: number): { material: THREE.MeshStandardMaterial; baseIntensity: number } | null {
  const color = RARITY_GLOW[rarity];
  if (!color) return null;
  const material = voxelMaterial();
  material.emissive = new THREE.Color(color);
  material.emissiveIntensity = intensity;
  return { material, baseIntensity: intensity };
}

/**
 * Aura neon: uma casca da mesma geometria, um pouco maior, aditiva e acima do limiar do bloom.
 * É o que dá o contorno brilhante em volta da peça sem mudar a cor dela.
 */
function addAura(part: THREE.Mesh, rarity: Rarity, strength = 1): THREE.Mesh | null {
  const color = RARITY_GLOW[rarity];
  if (!color) return null;
  const geometry = part.geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const k = 1.09;
  const aura = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.7 * strength),
      transparent: true,
      opacity: 0.24,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  aura.scale.setScalar(k);
  aura.position.copy(center).multiplyScalar(1 - k); // cresce em volta do centro da peça, não dos pés
  part.add(aura);
  return aura;
}

/** Tamanho de um voxel de personagem, em metros (8 voxels = 1 m). */
const V = 1 / 8;

function mesh(builder: VoxelBuilder, scale = V, material: THREE.Material = voxelMaterial()): THREE.Mesh {
  const m = new THREE.Mesh(builder.build(scale, { jitter: 0.06, ao: false }), material);
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
    case "bow":
      // Arco segurado na vertical: corpo curvo em voxels e corda.
      arm.box(-1, -14, -1, 0, -2, 0, wood);
      arm.box(-1, -15, -2, 0, -14, -1, wood).box(-1, -2, -2, 0, -1, -1, wood);
      arm.box(0, -14, -2, 1, -2, -1, "#e8e4da"); // corda
      arm.box(-1, -9, -1, 0, -7, 0, blade); // empunhadura na cor da raridade
      break;
    case "staff":
      arm.box(-1, -16, -1, 0, -5, 0, wood);
      arm.box(-2, -4, -2, 1, -1, 1, blade); // orbe
      arm.box(-1, -5, -1, 0, -4, 0, gold);
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

export function createHero(equipment?: Equipment, classId: ClassId = "warrior"): CharacterModel {
  const skin = "#e8b893", hair = "#4a2e1a", eye = "#1b1b1b";
  const armor = equipment?.armor ?? null;
  const accessory = equipment?.accessory ?? null;
  const weapon = equipment?.weapon ?? null;
  const visual = armor?.visual ?? "none";
  const classCloth = classId === "archer" ? "#3f7a3a" : classId === "mage" ? "#5a3f8f" : "#3b5aa6";
  const cloth = visual === "none" ? classCloth : visual === "tunic" ? "#8a5a2b" : visual === "chain" ? "#8c94a3" : "#4a4f5c";
  const trim = visual === "plate" ? "#c9a227" : visual === "chain" ? "#b9c0cc" : "#6b4a2b";
  const boots = accessory?.icon === "boots" ? "#c9a227" : "#2b2b2b";
  const glows: NonNullable<CharacterModel["glowMaterials"]> = [];

  // Corpo (pele, cabelo, pernas): sem glow.
  const body = new VoxelBuilder();
  body.box(-3, 0, -1, -1, 6, 1, "#6b4a2b").box(1, 0, -1, 3, 6, 1, "#6b4a2b"); // pernas
  body.box(-6, 7, -1, -4, 13, 1, skin); // braço esquerdo
  body.box(-3, 13, -3, 3, 19, 3, skin); // cabeça
  body.box(-3, 18, -3, 3, 20, 3, hair).box(-3, 15, 1, 3, 19, 3, hair).box(-3, 17, -3, 3, 18, -2, hair); // cabelo
  body.set(-2, 16, -3, eye).set(1, 16, -3, eye); // olhos

  // Armadura e roupa: glow na raridade da armadura equipada.
  const gear = new VoxelBuilder();
  gear.box(-4, 6, -2, 4, 13, 2, cloth); // tronco
  gear.box(-4, 6, -2, 4, 7, 2, trim); // cinto
  if (visual === "plate") {
    gear.box(-6, 11, -2, -4, 14, 2, trim).box(4, 11, -2, 6, 14, 2, trim); // ombreiras
    gear.box(-2, 9, -3, 2, 12, -2, "#5c6170"); // peitoral
    gear.box(-3, 18, -3, 3, 21, 3, "#4a4f5c"); // elmo
  }
  if (visual === "chain") gear.box(-4, 12, -2, 4, 13, 2, trim); // gola de malha
  if (classId === "archer") gear.box(-4, 17, -4, 4, 21, 4, "#2f5a2a").box(-3, 17, -4, 3, 19, -3, skin); // capuz
  if (classId === "mage") gear.box(-4, 19, -4, 4, 20, 4, "#3b2a66").box(-2, 20, -2, 2, 25, 2, "#3b2a66").set(0, 25, 0, "#c9a227"); // chapéu
  const armorGlow = armor ? glowMaterial(armor.rarity, 0.08) : null;
  if (armorGlow) glows.push(armorGlow);

  // Acessório: botas, amuleto ou anel, com glow na própria raridade.
  const acc = new VoxelBuilder();
  acc.box(-3, 0, -1, -1, 2, 1, boots).box(1, 0, -1, 3, 2, 1, boots); // botas
  if (accessory?.icon === "amulet") acc.set(0, 11, -3, "#c9a227");
  if (accessory?.icon === "ring") acc.set(-5, 7, -1, "#c9a227");
  const accGlow = accessory ? glowMaterial(accessory.rarity, 0.15) : null;
  if (accGlow) glows.push(accGlow);

  const root = new THREE.Group();
  const gearMesh = mesh(gear, V, armorGlow?.material ?? voxelMaterial());
  const accMesh = mesh(acc, V, accGlow?.material ?? voxelMaterial());
  if (armor) addAura(gearMesh, armor.rarity, 0.8);
  if (accessory) addAura(accMesh, accessory.rarity, 0.9);
  root.add(mesh(body), gearMesh, accMesh);

  // Braço direito (pele) + arma em malha própria, com glow na raridade da arma.
  const arm = new VoxelBuilder();
  arm.box(-1, -6, -1, 1, 0, 1, skin);
  const weaponVox = new VoxelBuilder();
  buildWeapon(weaponVox, weapon);
  const weaponGlow = weapon ? glowMaterial(weapon.rarity, 0.22) : null;
  if (weaponGlow) glows.push(weaponGlow);
  const weaponArm = new THREE.Group();
  weaponArm.position.set(5 * V, 13 * V, 0);
  weaponArm.add(mesh(arm));
  if (weapon) {
    const weaponMesh = mesh(weaponVox, V, weaponGlow?.material ?? voxelMaterial());
    addAura(weaponMesh, weapon.rarity, 1.1);
    weaponArm.add(weaponMesh);
  }
  root.add(weaponArm);
  return { root, weaponArm, height: 20 * V + 0.1, glowMaterials: glows };
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

/** Aldeões do santuário: mesma silhueta do herói, roupas e adereços próprios. */
export function createVillager(variant: "elder" | "smith" | "guard"): CharacterModel {
  const skin = variant === "smith" ? "#c98a5e" : "#e8b893";
  const hair = variant === "elder" ? "#e9e4d8" : variant === "smith" ? "#2b2b2b" : "#5a3a1a";
  const cloth = variant === "elder" ? "#5a3f8f" : variant === "smith" ? "#6b4a2b" : "#7a8290";
  const eye = "#1b1b1b";
  const b = new VoxelBuilder();
  b.box(-3, 0, -1, -1, 6, 1, variant === "elder" ? cloth : "#4a3a2a").box(1, 0, -1, 3, 6, 1, variant === "elder" ? cloth : "#4a3a2a");
  b.box(-3, 0, -1, -1, 2, 1, "#2b2b2b").box(1, 0, -1, 3, 2, 1, "#2b2b2b");
  b.box(-4, 6, -2, 4, 13, 2, cloth);
  if (variant === "smith") b.box(-3, 6, -3, 3, 12, -2, "#3a3a3a"); // avental
  if (variant === "guard") b.box(-5, 11, -2, -4, 14, 2, "#aab0b8").box(4, 11, -2, 5, 14, 2, "#aab0b8"); // ombreiras
  b.box(-6, 7, -1, -4, 13, 1, skin).box(4, 7, -1, 6, 13, 1, skin);
  b.box(-3, 13, -3, 3, 19, 3, skin);
  b.box(-3, 18, -3, 3, 20, 3, hair).box(-3, 15, 1, 3, 19, 3, hair);
  if (variant === "elder") b.box(-3, 12, -4, 3, 15, -3, hair); // barba longa
  if (variant === "smith") b.box(-3, 12, -4, 3, 14, -3, hair); // barba curta
  if (variant === "guard") b.box(-3, 19, -3, 3, 22, 3, "#aab0b8"); // elmo
  b.set(-2, 16, -3, eye).set(1, 16, -3, eye);
  // Adereço na mão esquerda: cajado, martelo ou lança.
  if (variant === "elder") b.box(-6, 0, -1, -5, 20, 0, "#8a5a2b").box(-7, 20, -2, -4, 22, 1, "#5fd36b");
  if (variant === "smith") b.box(-6, 4, -1, -5, 14, 0, "#8a5a2b").box(-8, 14, -2, -3, 17, 1, "#7f8794");
  if (variant === "guard") b.box(-6, 0, -1, -5, 24, 0, "#8a5a2b").box(-6, 24, -1, -5, 28, 0, "#d8dde6");
  const root = new THREE.Group();
  root.add(mesh(b));
  return { root, height: (variant === "guard" ? 22 : 20) * V + 0.1 };
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

/** Aranha: corpo baixo, oito patas, olhos vermelhos. `scale` > 1 para a rainha. */
export function createSpider(queen = false): CharacterModel {
  const k = queen ? 2.2 : 1;
  const body = queen ? "#2b1b2e" : "#2a2a2a";
  const accent = queen ? "#8f2f6b" : "#5a3a1a";
  const b = new VoxelBuilder();
  const s = (n: number) => Math.round(n * k);
  b.box(-s(3), s(2), -s(2), s(3), s(5), s(4), body); // abdômen
  b.box(-s(2), s(2), -s(5), s(2), s(5), -s(2), body); // cabeça
  b.box(-s(1), s(3), s(1), s(1), s(4), s(4), accent); // marca
  for (const sx of [-1, 1]) {
    b.set(sx * s(1), s(4), -s(5) - 1, "#ff3030").set(sx * s(2), s(4), -s(5) - 1, "#ff3030"); // olhos
    for (let i = 0; i < 4; i++) {
      const z = -s(4) + i * s(2);
      b.box(sx * s(3), s(3), z, sx * s(6), s(4), z + 1, body); // pata para fora
      b.box(sx * s(6), 0, z, sx * s(7), s(4), z + 1, body); // pata descendo
    }
  }
  if (queen) {
    b.box(-3, s(5), -s(4), 3, s(5) + 3, -s(2), "#e0b43a"); // coroa
    for (const x of [-3, 0, 2]) b.set(x, s(5) + 3, -s(3), "#e0b43a");
  }
  const root = new THREE.Group();
  root.add(mesh(b));
  return { root, height: s(5) * V + (queen ? 0.6 : 0.3) };
}

export function createBogZombie(): CharacterModel {
  const skin = "#5e7a4a", rags = "#3a4a2a", eye = "#c8ff5a";
  const b = new VoxelBuilder();
  b.box(-3, 0, -1, -1, 6, 1, rags).box(1, 0, -1, 3, 6, 1, rags);
  b.box(-4, 6, -2, 4, 13, 2, skin);
  b.box(-4, 6, -2, 4, 9, 2, rags);
  b.box(-6, 7, -1, -4, 13, 1, skin);
  b.box(-3, 13, -3, 3, 19, 3, skin);
  b.set(-2, 16, -3, eye).set(1, 16, -3, eye);
  b.box(-1, 13, -4, 2, 14, -3, "#2b2b2b"); // boca
  const root = new THREE.Group();
  root.add(mesh(b));
  // Braço direito esticado para a frente (zumbi).
  const arm = new VoxelBuilder();
  arm.box(-1, -1, -7, 1, 1, 1, skin);
  const weaponArm = new THREE.Group();
  weaponArm.position.set(5 * V, 11 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 19 * V + 0.1 };
}

export function createScorpion(): CharacterModel {
  const shell = "#b8783a", dark = "#8a5428";
  const b = new VoxelBuilder();
  b.box(-3, 1, -3, 3, 4, 4, shell); // corpo
  for (const sx of [-1, 1]) {
    for (const z of [-2, 0, 2]) b.box(sx * 3, 0, z, sx * 5, 2, z + 1, dark); // patas
    b.box(sx * 3, 2, -5, sx * 5, 3, -3, shell).box(sx * 5, 2, -7, sx * 6, 4, -4, dark); // pinças
  }
  b.set(-1, 3, -4, "#1b1b1b").set(1, 3, -4, "#1b1b1b");
  const root = new THREE.Group();
  root.add(mesh(b));
  // Cauda com ferrão, levantada no aviso.
  const tail = new VoxelBuilder();
  tail.box(-1, 0, 0, 1, 2, 5, shell).box(-1, 2, 4, 1, 6, 6, shell).box(-1, 5, 2, 1, 7, 4, "#1b1b1b");
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0, 3 * V, 4 * V);
  weaponArm.add(mesh(tail));
  root.add(weaponArm);
  return { root, weaponArm, height: 10 * V + 0.2 };
}

export function createBandit(): CharacterModel {
  const skin = "#d9a070", cloth = "#7a3b2a", scarf = "#2b2b2b";
  const b = new VoxelBuilder();
  b.box(-3, 0, -1, -1, 6, 1, "#4a3a2a").box(1, 0, -1, 3, 6, 1, "#4a3a2a");
  b.box(-4, 6, -2, 4, 13, 2, cloth);
  b.box(-4, 6, -2, 4, 7, 2, "#c9a227");
  b.box(-6, 7, -1, -4, 13, 1, skin);
  b.box(-3, 13, -3, 3, 19, 3, skin);
  b.box(-3, 13, -4, 3, 16, -2, scarf); // lenço no rosto
  b.box(-3, 18, -3, 3, 20, 3, "#e0c47f"); // turbante
  b.set(-2, 16, -3, "#1b1b1b").set(1, 16, -3, "#1b1b1b");
  const root = new THREE.Group();
  root.add(mesh(b));
  const arm = new VoxelBuilder();
  arm.box(-1, -6, -1, 1, 0, 1, skin);
  arm.box(-1, -7, -1, 1, -6, 0, "#c9a227");
  arm.box(-1, -15, -1, 0, -7, 0, "#d8dde6"); // cimitarra reta (voxel)
  arm.box(-2, -15, -1, -1, -11, 0, "#d8dde6");
  const weaponArm = new THREE.Group();
  weaponArm.position.set(5 * V, 13 * V, 0);
  weaponArm.add(mesh(arm));
  root.add(weaponArm);
  return { root, weaponArm, height: 20 * V + 0.1 };
}

export function createModel(archetype: string, equipment?: Equipment, classId?: ClassId): CharacterModel {
  switch (archetype) {
    case "hero": return createHero(equipment, classId);
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "orc": return createOrc();
    case "goblinKing": return createGoblinKing();
    case "spider": return createSpider(false);
    case "spiderQueen": return createSpider(true);
    case "bogZombie": return createBogZombie();
    case "scorpion": return createScorpion();
    case "bandit": return createBandit();
    case "elder": return createVillager("elder");
    case "smith": return createVillager("smith");
    case "guard": return createVillager("guard");
    default: return createSlime();
  }
}
