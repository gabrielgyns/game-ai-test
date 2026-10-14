import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "../voxel";
import type { Equipment } from "../../domain/inventory";
import type { Item, Rarity } from "../../domain/items";
import type { ClassId } from "../../domain/classes";
import {
  BLADE_BY_RARITY, HERO_BUILD, PAL, V, addAura, glowMaterial, mesh as meshWith, paintArm, paintFace, paintHairShort, paintHead, paintLeg, pivot, shades, tone,
  type CharacterModel, type Shades,
  lookRarity,
} from "./common";

/** Assinatura visual do equipamento: quando muda, o modelo do herói é reconstruído. */
export function equipmentSignature(eq: Equipment | undefined): string {
  if (!eq) return "";
  return [eq.weapon?.icon, eq.weapon?.rarity, eq.weapon?.set, eq.weapon?.stats.damage, eq.armor?.visual, eq.armor?.rarity, eq.armor?.set, eq.accessory?.icon, eq.accessory?.rarity, eq.accessory?.set].join("|");
}

const mesh = (b: VoxelBuilder, material?: THREE.Material): THREE.Mesh => meshWith(b, material, V, HERO_BUILD);

const LEG = { hw: 2, hd: 2, length: 12 };
const ARM = { hw: 2, hd: 2, length: 12 };
const HEAD = { hw: 6, h: 12, hd: 6 };
const TORSO = { hw: 7, h: 14, hd: 4 };
const HIP_Y = 12;
const SHOULDER_Y = 25;
const HEAD_Y = 26;

/* ---------- Armas (coordenadas locais do braço direito; a mão vai de y -12 a -9) ---------- */

/** Armas em repouso apontam para baixo (-Y) a partir da mão; o golpe gira o braço para a frente. */
export function paintWeapon(b: VoxelBuilder, weapon: Item): void {
  const blade = shades(BLADE_BY_RARITY[lookRarity(weapon)], 0.14);
  const gold = PAL.gold;
  const wood = PAL.wood;
  const grip = PAL.leather;
  switch (weapon.icon) {
    case "dagger":
      b.box(-1, -13, -1, 1, -8, 0, grip.base).box(-1, -11, -1, 1, -10, 0, grip.dark);
      b.box(-1, -8, -1, 1, -7, 1, gold.base); // pomo
      b.box(-3, -14, -1, 3, -13, 0, gold.base).box(-3, -14, -1, -2, -13, 0, gold.light); // guarda
      b.box(-1, -21, -1, 1, -14, 0, blade.base).box(-1, -21, -1, 0, -14, 0, blade.light);
      b.box(0, -23, -1, 1, -21, 0, blade.base); // ponta
      break;
    case "axe": {
      const twin = (weapon.stats.damage ?? 0) >= 14;
      b.box(-1, -28, -1, 1, -8, 0, wood.base).box(-1, -28, -1, 0, -8, 0, wood.dark); // cabo
      b.box(-1, -13, -1, 1, -9, 0, grip.base); // empunhadura
      b.box(-1, -8, -1, 1, -7, 1, gold.base); // tampa
      b.box(-1, -27, -9, 1, -17, -1, PAL.steel.base); // lâmina para a frente
      b.box(-1, -26, -11, 1, -18, -9, blade.light); // fio na cor da raridade
      b.box(-1, -24, -9, 1, -20, -7, PAL.steel.dark); // detalhe gravado
      b.box(-1, -28, -1, 1, -16, 1, PAL.darkSteel.base); // encaixe no cabo
      if (twin) {
        b.box(-1, -27, 1, 1, -17, 9, PAL.steel.base);
        b.box(-1, -26, 9, 1, -18, 11, blade.light);
      } else {
        b.box(-1, -25, 1, 1, -19, 4, PAL.darkSteel.base); // contrapeso
      }
      break;
    }
    case "bow": {
      // Arco segurado na vertical: braços curvos, pontas para a frente e corda esticada.
      b.box(0, -21, -1, 1, 1, 0, wood.base);
      b.box(0, -23, -3, 1, -21, -1, wood.dark).box(0, 1, -3, 1, 3, -1, wood.dark); // pontas curvadas
      b.box(0, -24, -4, 1, -22, -3, wood.dark).box(0, 2, -4, 1, 4, -3, wood.dark);
      b.box(0, -23, -4, 1, 3, -3, "#e8e4da"); // corda
      b.box(-1, -13, -2, 2, -8, 1, grip.base); // empunhadura em couro
      b.box(-1, -11, -2, 2, -10, 1, blade.base); // faixa na cor da raridade
      b.box(0, -18, -1, 1, -14, 0, gold.base).box(0, -6, -1, 1, -2, 0, gold.base); // ponteiras
      break;
    }
    case "staff": {
      b.box(-1, -22, -1, 1, 4, 0, wood.base).box(-1, -22, -1, 0, 4, 0, wood.dark); // bastão
      b.box(-1, -13, -1, 1, -8, 0, grip.base); // empunhadura
      b.box(-2, 4, -2, 2, 6, 1, gold.base).box(-2, 5, -2, -1, 6, 1, gold.light); // berço
      b.sphere(0, 9, -1, 3, 3, 3, blade.base); // orbe
      b.box(0, 10, -2, 1, 11, -1, blade.light); // brilho
      b.set(-2, 6, -1, gold.base).set(2, 6, -1, gold.base).set(0, 6, -3, gold.base).set(0, 6, 1, gold.base);
      b.box(-1, -23, -1, 1, -22, 0, gold.base); // ponteira
      break;
    }
    case "sword":
    default: {
      const long = (weapon.stats.damage ?? 0) >= 12; // montante
      const len = long ? 16 : 10;
      b.box(-1, -13, -1, 1, -8, 0, grip.base).box(-1, -11, -1, 1, -10, 0, grip.dark); // empunhadura
      b.box(-1, -8, -1, 1, -7, 1, gold.base).set(-1, -8, 0, gold.light); // pomo
      b.box(long ? -5 : -4, -15, -1, long ? 5 : 4, -13, 0, gold.base); // guarda
      b.box(long ? -5 : -4, -14, -1, long ? -2 : -1, -13, 0, gold.light);
      b.box(-1, -15 - len, -1, 1, -15, 0, blade.base);
      b.box(-1, -15 - len, -1, 0, -15, 0, blade.light); // fio iluminado
      b.box(0, -14 - len, -1, 1, -18, 0, tone(blade.base, -0.06)); // canal central
      b.box(0, -17 - len, -1, 1, -15 - len, 0, blade.base); // ponta
      if (long) b.box(-1, -19, -1, 1, -17, 0, PAL.darkSteel.base); // ricasso
      break;
    }
  }
}

/* ---------- Herói ---------- */

export interface HeroLook {
  classId: ClassId;
  skin: Shades;
  hair: Shades;
  cloth: Shades;
  trim: Shades;
  pants: Shades;
  boots: Shades;
}

export function heroLook(classId: ClassId, visual: string, bootsGold: boolean): HeroLook {
  const classCloth = classId === "archer" ? "#3f7a3a" : classId === "mage" ? "#5a3f8f" : "#3b5aa6";
  const cloth = visual === "none" ? classCloth : visual === "tunic" ? "#8a5a2b" : visual === "chain" ? "#8c94a3" : "#4a4f5c";
  const trim = visual === "plate" ? "#d4a92a" : visual === "chain" ? "#b9c0cc" : "#6b4a2b";
  return {
    classId,
    skin: shades("#e8b893", 0.09),
    hair: shades(classId === "mage" ? "#8a5a3a" : classId === "archer" ? "#2b1d12" : "#4a2e1a", 0.08),
    cloth: shades(cloth, 0.1),
    trim: shades(trim, 0.1),
    pants: shades(classId === "mage" ? "#3b2a66" : "#4a3524", 0.08),
    boots: shades(bootsGold ? "#d4a92a" : "#2f2a28", 0.1),
  };
}

/** Pinta o tronco com a roupa da classe e a armadura equipada. */
function paintTorso(b: VoxelBuilder, look: HeroLook, visual: string): void {
  const { hw, h, hd } = TORSO;
  const y0 = HIP_Y;
  const cloth = look.cloth, trim = look.trim;
  b.box(-hw, y0, -hd, hw, y0 + h, hd, cloth.base);
  b.box(-hw, y0 + h - 1, -hd, hw, y0 + h, hd, cloth.light); // ombros iluminados
  b.box(-hw, y0, -hd, hw, y0 + 1, hd, cloth.dark); // bainha
  // Cintura um voxel mais estreita: silhueta com peito e quadril.
  b.carve(-hw, y0 + 2, -hd, -hw + 1, y0 + 5, hd).carve(hw - 1, y0 + 2, -hd, hw, y0 + 5, hd);
  b.box(-hw + 1, y0 + 2, -hd, -hw + 2, y0 + 5, hd, cloth.dark).box(hw - 2, y0 + 2, -hd, hw - 1, y0 + 5, hd, cloth.dark);
  // Cinto com fivela.
  b.box(-hw + 1, y0 + 2, -hd - 1, hw - 1, y0 + 4, hd + 1, PAL.leather.base);
  b.box(-1, y0 + 2, -hd - 1, 1, y0 + 4, -hd, PAL.gold.base);
  // Pescoço.
  b.box(-2, y0 + h - 1, -2, 2, y0 + h + 1, 2, look.skin.base);

  if (visual === "none") {
    // Roupa da classe: gola em V e costura central.
    b.box(-1, y0 + 6, -hd - 1, 1, y0 + h - 1, -hd, cloth.dark);
    b.box(-3, y0 + h - 2, -hd - 1, 3, y0 + h, -hd, cloth.dark);
    if (look.classId === "warrior") b.box(-hw, y0 + 10, -hd - 1, -hw + 3, y0 + h, -hd, trim.base); // faixa no ombro
    if (look.classId === "archer") {
      // Tira de couro cruzada e aljava nas costas.
      for (let i = 0; i < 12; i++) b.set(-hw + 1 + i, y0 + 3 + i, -hd - 1, PAL.leather.base);
      b.box(2, y0 + 1, hd, 6, y0 + 17, hd + 3, PAL.leather.base).box(2, y0 + 16, hd, 6, y0 + 17, hd + 3, PAL.leather.dark);
      b.box(3, y0 + 17, hd + 1, 5, y0 + 21, hd + 2, PAL.wood.base); // hastes das flechas
      b.set(3, y0 + 21, hd + 1, "#e5484d").set(4, y0 + 21, hd + 1, "#e5484d").set(3, y0 + 20, hd + 1, PAL.steel.base);
    }
    if (look.classId === "mage") {
      // Manto com barra dourada e runa no peito; saia curta sobre as pernas.
      b.box(-hw, y0 + 4, -hd - 1, hw, y0 + 5, hd + 1, PAL.gold.base);
      b.box(-hw - 1, y0 - 3, -hd - 1, hw + 1, y0 + 2, hd + 1, cloth.dark);
      b.box(-hw - 1, y0 - 3, -hd - 1, hw + 1, y0 - 2, hd + 1, PAL.gold.dark);
      b.set(0, y0 + 9, -hd - 1, PAL.gold.light).set(0, y0 + 8, -hd - 1, PAL.gold.base).set(-1, y0 + 8, -hd - 1, PAL.gold.base).set(1, y0 + 8, -hd - 1, PAL.gold.base).set(0, y0 + 7, -hd - 1, PAL.gold.base);
    }
  }
  if (visual === "tunic") {
    // Couro com costuras claras e abas na frente.
    for (const y of [y0 + 6, y0 + 10]) b.box(-hw, y, -hd - 1, hw, y + 1, -hd, cloth.light);
    b.box(-1, y0 + 4, -hd - 1, 1, y0 + h - 1, -hd, cloth.dark);
    b.box(-hw, y0 + h - 3, -hd - 1, hw, y0 + h, -hd, trim.base); // gola
  }
  if (visual === "chain") {
    // Malha: xadrez de dois tons em toda a superfície.
    checker(b, -hw, y0 + 5, -hd - 1, hw, y0 + h, hd + 1, cloth.base, cloth.dark);
    b.box(-hw, y0 + h - 2, -hd - 1, hw, y0 + h, hd + 1, trim.base); // gola de malha
    b.box(-hw + 1, y0 + 2, -hd - 1, hw - 1, y0 + 4, hd + 1, PAL.leather.base);
  }
  if (visual === "plate") {
    const steel = shades("#5c6170", 0.12);
    b.box(-hw, y0 + 5, -hd - 1, hw, y0 + h, hd + 1, steel.base);
    b.box(-3, y0 + 7, -hd - 2, 3, y0 + h - 2, -hd - 1, steel.light); // peitoral saliente
    b.box(-hw, y0 + h - 3, -hd - 1, hw, y0 + h - 2, hd + 1, trim.base); // friso dourado
    b.box(-hw, y0 + 5, -hd - 1, hw, y0 + 6, hd + 1, trim.base);
    b.box(-1, y0 + 7, -hd - 2, 1, y0 + h - 2, -hd - 1, steel.dark); // vinco central
    // Ombreiras largas (estáticas no tronco; os braços giram por dentro).
    b.box(-hw - 4, y0 + h - 3, -hd - 1, -hw, y0 + h + 1, hd + 1, steel.base).box(hw, y0 + h - 3, -hd - 1, hw + 4, y0 + h + 1, hd + 1, steel.base);
    b.box(-hw - 4, y0 + h, -hd - 1, -hw, y0 + h + 1, hd + 1, trim.base).box(hw, y0 + h, -hd - 1, hw + 4, y0 + h + 1, hd + 1, trim.base);
    b.box(-hw - 4, y0 + h - 3, -hd - 1, -hw, y0 + h - 2, hd + 1, steel.dark).box(hw, y0 + h - 3, -hd - 1, hw + 4, y0 + h - 2, hd + 1, steel.dark);
  }
}

function checker(b: VoxelBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, a: string, c: string): void {
  for (let x = x0; x < x1; x++)
    for (let y = y0; y < y1; y++)
      for (let z = z0; z < z1; z++) b.set(x, y, z, (x + y + z) % 2 === 0 ? a : c);
}

/** Cabelo, capuz ou chapéu, conforme a classe. */
function paintHeadwear(b: VoxelBuilder, look: HeroLook): void {
  const { hw, h, hd } = HEAD;
  if (look.classId === "archer") {
    const hood = shades("#2f5a2a", 0.1);
    b.box(-hw - 1, h - 6, -hd - 1, hw + 1, h + 2, hd + 1, hood.base); // capuz
    b.carve(-hw, h - 6, -hd - 1, hw, h - 1, -hd); // abre o rosto
    b.box(-hw - 1, h - 6, -hd - 1, hw + 1, h - 5, hd + 1, hood.dark);
    b.box(-hw - 1, h + 1, -hd - 1, hw + 1, h + 2, hd + 1, hood.light);
    b.box(-3, h + 2, 2, 3, h + 4, hd + 1, hood.base).box(-2, h + 4, 4, 2, h + 6, hd + 1, hood.dark); // bico do capuz
    b.box(-hw + 1, h - 1, -hd - 1, hw - 1, h, -hd, look.hair.base); // franja aparecendo
    return;
  }
  paintHairShort(b, HEAD, look.hair);
  if (look.classId === "mage") {
    const hat = shades("#3b2a66", 0.1);
    b.box(-hw - 3, h + 1, -hd - 3, hw + 3, h + 2, hd + 3, hat.dark); // aba
    b.box(-hw - 3, h + 2, -hd - 3, hw + 3, h + 3, hd + 3, hat.base);
    b.box(-5, h + 3, -5, 5, h + 6, 5, hat.base).box(-5, h + 3, -5, 5, h + 4, 5, PAL.gold.base); // fita
    b.box(-4, h + 6, -4, 4, h + 9, 4, hat.base);
    b.box(-3, h + 9, -3, 3, h + 11, 3, hat.base);
    b.box(-2, h + 11, -2, 2, h + 13, 2, hat.dark);
    b.box(-1, h + 13, -1, 1, h + 14, 1, hat.dark);
    b.set(1, h + 14, 0, PAL.gold.light); // ponta dobrada
    b.set(2, h + 14, 0, PAL.gold.base);
  }
}

export function createHero(equipment?: Equipment, classId: ClassId = "warrior"): CharacterModel {
  const armor = equipment?.armor ?? null;
  const accessory = equipment?.accessory ?? null;
  const weapon = equipment?.weapon ?? null;
  const visual = armor?.visual ?? "none";
  const look = heroLook(classId, visual, accessory?.icon === "boots");
  const glows: NonNullable<CharacterModel["glowMaterials"]> = [];
  const armorGlow = armor ? glowMaterial(lookRarity(armor), 0.08) : null;
  const accGlow = accessory ? glowMaterial(lookRarity(accessory), 0.15) : null;
  const weaponGlow = weapon ? glowMaterial(lookRarity(weapon), 0.22) : null;
  for (const g of [armorGlow, accGlow, weaponGlow]) if (g) glows.push(g);

  const root = new THREE.Group();

  // Tronco (roupa + armadura).
  const torso = new VoxelBuilder();
  paintTorso(torso, look, visual);
  const torsoMesh = mesh(torso, armorGlow?.material ?? voxelMaterial());
  if (armor) addAura(torsoMesh, lookRarity(armor), 0.8);
  root.add(torsoMesh);

  // Acessório no corpo: amuleto no peito.
  if (accessory?.icon === "amulet") {
    const acc = new VoxelBuilder();
    acc.box(-3, HIP_Y + 12, -TORSO.hd - 1, 3, HIP_Y + 13, -TORSO.hd, PAL.gold.dark); // corrente
    acc.set(-3, HIP_Y + 11, -TORSO.hd - 1, PAL.gold.dark).set(2, HIP_Y + 11, -TORSO.hd - 1, PAL.gold.dark);
    acc.box(-1, HIP_Y + 9, -TORSO.hd - 2, 1, HIP_Y + 11, -TORSO.hd, PAL.gold.base);
    acc.set(0, HIP_Y + 10, -TORSO.hd - 2, BLADE_BY_RARITY[lookRarity(accessory)]).set(-1, HIP_Y + 10, -TORSO.hd - 2, BLADE_BY_RARITY[lookRarity(accessory)]);
    const accMesh = mesh(acc, accGlow?.material ?? voxelMaterial());
    addAura(accMesh, lookRarity(accessory), 0.9);
    root.add(accMesh);
  }

  // Cabeça com rosto, cabelo e elmo.
  const headB = new VoxelBuilder();
  paintHead(headB, HEAD, look.skin);
  paintFace(headB, HEAD.hw, HEAD.hd, 3, look.skin, { mouth: "smile" });
  paintHeadwear(headB, look);
  const headGroup = pivot(0, HEAD_Y, 0, mesh(headB));
  if (visual === "plate" && classId === "warrior") { // capuz e chapéu são a identidade das outras classes
    const helm = new VoxelBuilder();
    const steel = shades("#5c6170", 0.12);
    helm.box(-HEAD.hw - 1, 8, -HEAD.hd - 1, HEAD.hw + 1, HEAD.h + 3, HEAD.hd + 1, steel.base);
    helm.carve(-HEAD.hw, 8, -HEAD.hd - 1, HEAD.hw, HEAD.h, -HEAD.hd); // abre o rosto
    helm.box(-HEAD.hw - 1, HEAD.h + 2, -HEAD.hd - 1, HEAD.hw + 1, HEAD.h + 3, HEAD.hd + 1, steel.light);
    helm.box(-1, 5, -HEAD.hd - 2, 1, HEAD.h + 1, -HEAD.hd - 1, steel.dark); // protetor de nariz
    helm.box(-HEAD.hw - 1, 8, -HEAD.hd - 1, HEAD.hw + 1, 9, HEAD.hd + 1, look.trim.base); // friso
    helm.box(-1, HEAD.h + 3, -2, 1, HEAD.h + 6, 4, "#b8322f"); // penacho
    const helmMesh = mesh(helm, armorGlow?.material ?? voxelMaterial());
    headGroup.add(helmMesh);
  }
  root.add(headGroup);

  // Pernas: calça e bota em malhas separadas (a bota pode brilhar).
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new VoxelBuilder();
    paintLeg(leg, LEG, look.pants, look.boots, 4);
    const bootsGlow = accessory?.icon === "boots" ? accGlow : null;
    const legMesh = mesh(leg, voxelMaterial());
    const group = pivot(side * 3, HIP_Y, 0, legMesh);
    if (bootsGlow) {
      const boot = new VoxelBuilder();
      boot.box(-LEG.hw - 1, -LEG.length, -LEG.hd - 2, LEG.hw + 1, -LEG.length + 4, LEG.hd + 1, look.boots.base);
      boot.box(-LEG.hw - 1, -LEG.length + 3, -LEG.hd - 1, LEG.hw + 1, -LEG.length + 4, LEG.hd + 1, look.boots.light);
      boot.box(-LEG.hw - 1, -LEG.length, -LEG.hd - 2, LEG.hw + 1, -LEG.length + 1, LEG.hd + 1, look.boots.dark);
      const bootMesh = mesh(boot, bootsGlow.material);
      addAura(bootMesh, lookRarity(accessory!), 0.9);
      group.add(bootMesh);
    }
    legs.push(group);
    root.add(group);
  }

  // Braços: esquerdo livre (com anel), direito com a arma.
  const sleeve = visual === "plate" ? shades("#5c6170", 0.12) : look.cloth;
  const sleeveLen = classId === "mage" ? 10 : visual === "none" && classId === "archer" ? 4 : 6;
  const left = new VoxelBuilder();
  paintArm(left, ARM, sleeve, look.skin, sleeveLen);
  if (accessory?.icon === "ring") left.box(-ARM.hw, -ARM.length + 1, -ARM.hd - 1, -ARM.hw + 2, -ARM.length + 2, -ARM.hd, PAL.gold.base).set(-ARM.hw + 1, -ARM.length + 1, -ARM.hd - 1, BLADE_BY_RARITY[lookRarity(accessory)]);
  const offArm = pivot(-9, SHOULDER_Y, 0, mesh(left, accessory?.icon === "ring" ? (accGlow?.material ?? voxelMaterial()) : voxelMaterial()));
  root.add(offArm);

  const right = new VoxelBuilder();
  paintArm(right, ARM, sleeve, look.skin, sleeveLen);
  const weaponArm = pivot(9, SHOULDER_Y, 0, mesh(right));
  if (weapon) {
    const w = new VoxelBuilder();
    paintWeapon(w, weapon);
    const weaponMesh = mesh(w, weaponGlow?.material ?? voxelMaterial());
    addAura(weaponMesh, lookRarity(weapon), 1.1);
    weaponArm.add(weaponMesh);
  }
  root.add(weaponArm);

  const hatExtra = classId === "mage" ? 14 : classId === "archer" ? 2 : 0;
  return { root, weaponArm, offArm, legs, head: headGroup, height: (HEAD_Y + HEAD.h + 2 + hatExtra * 0.4) * V + 0.1, glowMaterials: glows, weaponArmRest: 0.3 };
}

export type { Rarity };
