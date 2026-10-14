import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "../voxel";
import { PAL, V, mesh, pivot, shades, tone, type CharacterModel } from "./common";
import { buildHumanoid } from "./humanoid";
import { createSpider } from "./mobs";

/* ---------- Rei Goblin: gordo, coroado, capa, machado real ---------- */

export function createGoblinKing(): CharacterModel {
  const skin = shades("#6a9c3c", 0.1);
  const armor = shades("#5a2e2e", 0.1);
  const gold = PAL.gold;
  const cape = shades("#7a1f2b", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 16 },
    arms: { hw: 3, hd: 3, length: 20 },
    head: { hw: 9, h: 16, hd: 9 },
    torso: { hw: 14, h: 24, hd: 8 },
    legX: 6,
    armX: 17,
    pants: shades("#3a2a1a", 0.08),
    boots: shades("#1e1b19", 0.1),
    bootH: 4,
    sleeve: armor,
    sleeveLen: 6,
    face: { eye: "#ffd54a", mouth: "grin", brow: "#2f4a1a" },
    mouthY: 4,
    neck: 1,
    topExtra: 6,
    torsoPaint: (b, y) => {
      b.box(-14, y + 3, -9, 14, y + 7, 9, gold.base).box(-14, y + 6, -9, 14, y + 7, 9, gold.light); // cinturão dourado
      b.box(-3, y + 3, -10, 3, y + 7, -9, "#e5484d").box(-2, y + 4, -11, 2, y + 6, -10, "#ff8a8a"); // rubi da fivela
      b.sphere(0, y + 12, -8, 9, 6, 2, armor.light); // barriga saliente
      b.box(-14, y + 16, -9, 14, y + 19, -8, armor.dark); // faixa do peito
      for (const x of [-10, -5, 0, 5]) b.box(x, y + 16, -10, x + 2, y + 19, -9, PAL.teeth); // troféus de dentes
      // Capa: cai das costas até perto do chão, com dobras.
      b.box(-16, y - 10, 8, 16, y + 24, 11, cape.base);
      for (const x of [-12, -6, 0, 6, 12]) b.box(x, y - 10, 10, x + 1, y + 22, 11, cape.dark);
      b.box(-16, y - 10, 8, 16, y - 8, 11, cape.dark);
      b.box(-16, y + 22, 8, 16, y + 24, 11, gold.base); // gola
      b.box(-15, y - 6, 11, -9, y + 2, 12, cape.light); // dobra solta
      // Ombreiras com espetos.
      for (const s of [-1, 1]) {
        b.box(s > 0 ? 14 : -19, y + 20, -8, s > 0 ? 19 : -14, y + 25, 8, armor.dark);
        b.box(s > 0 ? 14 : -19, y + 24, -8, s > 0 ? 19 : -14, y + 25, 8, gold.base);
        b.box(s > 0 ? 16 : -17, y + 25, -1, s > 0 ? 17 : -16, y + 29, 1, PAL.darkSteel.light);
      }
    },
    headPaint: (b) => {
      // Orelhas enormes, nariz de batata, coroa com rubi.
      for (const s of [-1, 1]) {
        b.box(s > 0 ? 9 : -15, 7, -1, s > 0 ? 15 : -9, 10, 1, skin.base);
        b.box(s > 0 ? 13 : -17, 9, -1, s > 0 ? 17 : -13, 12, 0, skin.base);
      }
      b.sphere(0, 6, -10, 2, 2, 2, skin.dark);
      b.box(-9, 15, -9, 9, 17, 9, gold.base).box(-9, 16, -9, 9, 17, 9, gold.light); // base da coroa
      for (let i = -9; i < 9; i += 3) {
        b.box(i, 17, -9, i + 1, 20, -8, gold.base).box(i, 17, 8, i + 1, 20, 9, gold.base);
        b.box(-9, 17, i, -8, 20, i + 1, gold.base).box(8, 17, i, 9, 20, i + 1, gold.base);
      }
      b.box(-1, 17, -10, 1, 20, -9, "#e5484d").set(0, 19, -10, "#ff8a8a"); // rubi
      b.box(-3, 3, -10, 3, 4, -9, PAL.pupil); // sombra sob o nariz
    },
    weaponPaint: (b) => {
      b.box(-1, -42, -1, 1, -16, 0, PAL.wood.dark); // cabo real
      b.box(-2, -40, -16, 2, -24, 0, PAL.steel.base); // lâmina enorme
      b.box(-2, -39, -18, 2, -25, -16, gold.light); // fio dourado
      b.box(-2, -40, 0, 2, -24, 10, PAL.steel.base).box(-2, -39, 10, 2, -25, 12, gold.light); // lâmina dupla
      b.box(-2, -34, -12, 2, -32, -4, tone("#5a2e2e", -0.1)); // gravura
      b.box(-2, -41, -1, 2, -23, 1, PAL.darkSteel.base);
      b.box(-1, -44, -1, 1, -42, 0, gold.base); // ponteira
    },
  });
}

export function createSpiderQueen(): CharacterModel {
  return createSpider(true);
}

/* ---------- Imperador Escorpião: carapaça obsidiana com placas de ouro, coroa e ácido ---------- */

export function createScorpionEmperor(): CharacterModel {
  const shell = shades("#5a2a1e", 0.12);
  const dark = shades("#2e1a14", 0.1);
  const gold = PAL.gold;
  const k = (n: number) => Math.round(n * 2.4);
  const b = new VoxelBuilder();

  // Corpo em quatro placas, cada uma com costura de ouro e uma crista no dorso.
  for (let i = 0; i < 4; i++) {
    const z0 = k(-6 + i * 3);
    const z1 = k(-3 + i * 3);
    const w = k(i === 3 ? 5 : 6);
    const top = k(i === 0 ? 6 : 7);
    b.box(-w, k(2), z0, w, top, z1, shell.base);
    b.box(-w, top - 1, z0, w, top, z1, shell.light);
    b.box(-w - 1, k(3), z1 - 1, w + 1, top + 1, z1, gold.base); // costura de ouro saltada
    b.box(-2, top, z0 + 2, 2, top + 2, z1 - 2, gold.light); // crista
    for (const sx of [-1, 1]) b.box(sx * (w - 1), top - 2, z0 + 2, sx * (w + 2), top - 1, z0 + 4, dark.base); // espinhos laterais
  }
  b.box(-k(5), k(2) - 1, -k(6), k(5), k(2), k(6), dark.dark); // ventre

  // Cabeça baixa com seis olhos e coroa.
  b.box(-k(4), k(1), -k(8), k(4), k(5), -k(6), dark.base);
  b.box(-k(4), k(5) - 1, -k(8), k(4), k(5), -k(6), dark.light);
  const crownY = k(5);
  b.box(-k(4), crownY, -k(8), k(4), crownY + 2, -k(6) + 2, gold.base).box(-k(4), crownY + 1, -k(8), k(4), crownY + 2, -k(6) + 2, gold.light);
  for (const x of [-k(4), -k(2), 0, k(2) - 1, k(4) - 1]) b.box(x, crownY + 2, -k(8), x + 1, crownY + (x === 0 ? 6 : 4), -k(8) + 1, gold.base);
  b.box(-1, crownY + 2, -k(8) - 1, 1, crownY + 4, -k(8), "#4fd36b"); // esmeralda

  // Patas: três pares com junta alta e ponta escura.
  for (const sx of [-1, 1]) {
    for (const z of [-k(4), 0, k(4)]) {
      b.box(sx * k(6), k(4), z, sx * k(10), k(5), z + 2, dark.base);
      b.box(sx * k(9), 0, z, sx * k(10), k(5), z + 2, dark.base);
      b.box(sx * k(9), k(4), z, sx * k(10), k(5) + 1, z + 2, gold.base); // joelho dourado
      b.box(sx * k(9) - sx, 0, z - 1, sx * k(11), 1, z + 2, dark.dark);
    }
    // Pinças grandes com borda de ouro.
    b.box(sx * k(5), k(3), -k(10), sx * k(8), k(5), -k(5), shell.base);
    b.box(sx * k(7), k(3), -k(14), sx * k(11), k(6), -k(10), shell.base);
    b.box(sx * k(7), k(6) - 1, -k(14), sx * k(11), k(6), -k(10), gold.base);
    b.box(sx * k(7), k(4), -k(17), sx * k(9), k(6), -k(14), shell.dark); // dedo fixo
    b.box(sx * k(9), k(2), -k(16), sx * k(11), k(4), -k(14), shell.dark); // dedo móvel
    b.box(sx * k(7), k(4), -k(17) - 1, sx * k(8), k(5), -k(17), gold.light); // ponta de ouro
  }

  // Olhos vermelhos que brilham (material próprio, pulsa como os equipamentos raros).
  const eyesB = new VoxelBuilder();
  for (const x of [-k(3), -k(1) - 1, k(1), k(3) - 1]) eyesB.box(x, k(4) - 1, -k(8) - 1, x + 2, k(4) + 1, -k(8), "#ff4a3a");
  const eyeMat = voxelMaterial();
  eyeMat.emissive = new THREE.Color("#ff3a2a");
  eyeMat.emissiveIntensity = 0.9;

  const root = new THREE.Group();
  root.add(mesh(b), mesh(eyesB, eyeMat));

  // Cauda: anéis de ouro, curvada sobre o corpo, com bulbo de ácido verde que brilha.
  const tail = new VoxelBuilder();
  const seg: [number, number][] = [[0, 0], [3, 1], [6, 1], [9, 0], [12, -2], [14, -5]];
  for (const [y, z] of seg) {
    tail.box(-k(2), k(y), k(z), k(2), k(y + 3), k(z + 3), shell.base);
    tail.box(-k(2), k(y + 3) - 1, k(z), k(2), k(y + 3), k(z + 3), shell.light);
    tail.box(-k(2) - 1, k(y), k(z), k(2) + 1, k(y) + 1, k(z + 3), gold.base); // anel
  }
  tail.box(-k(1), k(11), -k(11), k(1), k(15), -k(8), "#1b1b1b").box(-k(1), k(9), -k(12), k(1), k(11), -k(10), "#1b1b1b"); // ferrão
  const acid = new VoxelBuilder();
  acid.sphere(0, k(16), -k(7), k(2.6), k(2.6), k(2.6), "#7ccf3e");
  acid.recolorFront(0, k(17), "#d8ff9a").recolorFront(1, k(17), "#d8ff9a").recolorFront(0, k(17) + 1, "#d8ff9a"); // reflexo
  const acidMat = voxelMaterial();
  acidMat.emissive = new THREE.Color("#6fd63a");
  acidMat.emissiveIntensity = 0.45;
  const weaponArm = pivot(0, k(5), k(5), mesh(tail), mesh(acid, acidMat));
  root.add(weaponArm);
  return {
    root,
    weaponArm,
    height: k(22) * V + 0.2,
    glowMaterials: [
      { material: eyeMat, baseIntensity: 0.9 },
      { material: acidMat, baseIntensity: 0.45 },
    ],
  };
}
