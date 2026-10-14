import * as THREE from "three";
import { hash3, noise3, pickTone } from "../props/sculpt";
import { buildHumanoid } from "./humanoid";
import { PAL, shades, type CharacterModel } from "./common";
import { createWolf } from "./forest";

/**
 * Criaturas e gente dos Picos Gelados, em voxels de 1/16 m: o lobo das neves (o lobo cinzento de
 * pelagem branca e olhos azuis), o yeti, o espectro gélido (translúcido, de gelo), o Gigante de Gelo e
 * a Rainha Gélida (os dois montados maiores e desenhados com voxels maiores, como o Ente Ancião) e os
 * moradores de Pedra-Fria.
 */
export function createSnowWolf(): CharacterModel {
  return createWolf({ fur: ["#b8c4d0", "#ccd6e0", "#dfe7ee", "#f2f6fa"], snout: "#c8d2dc", dark: "#7a8794", ear: "#aab6c4", eye: "#7ad8ff" });
}

/** Desenha num grupo interno escalado: tamanho grande com poucos triângulos. */
function enlarge(model: CharacterModel, k: number): CharacterModel {
  const root = new THREE.Group();
  model.root.scale.setScalar(k);
  root.add(model.root);
  return { ...model, root, height: model.height * k };
}

const furPaint = (tones: string[], seed: number) => (x: number, y: number, z: number) => pickTone(tones, Math.min(0.999, noise3(x / 2, y / 3, z / 2, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));

/** Yeti: corcunda, de pelo branco desgrenhado, cara e mãos azul-acinzentadas e braços enormes. */
export function createYeti(): CharacterModel {
  const fur = shades("#dfe6ee", 0.08);
  const skin = shades("#7a8ca4", 0.1);
  const shag = ["#c8d2dc", "#d8e0e8", "#e6ecf2", "#f4f8fb"];
  const model = buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 11 },
    arms: { hw: 3, hd: 3, length: 17 },
    head: { hw: 6, h: 10, hd: 6 },
    torso: { hw: 10, h: 15, hd: 6 },
    legX: 5,
    armX: 13,
    pants: fur,
    boots: shades("#6a7a90", 0.1),
    bootH: 2,
    sleeve: fur,
    sleeveLen: 14,
    face: { eye: "#1b2a3a", mouth: "fangs" },
    mouthY: 2,
    torsoPaint: (b, y) => {
      const paint = furPaint(shag, 3);
      for (let x = -11; x <= 10; x++) for (let z = -7; z <= 6; z++) for (let yy = y; yy < y + 17; yy++) {
        const hump = yy > y + 12 && z > 0 ? 2 : 0;
        if (Math.abs(x + 0.5) > 10.5 + hump || (Math.abs(x + 0.5) < 10 && Math.abs(z + 0.5) < 6 && yy < y + 15)) continue;
        if (hash3(x, yy, z, 4) < 0.35) b.set(x, yy, z, paint(x, yy, z));
      }
      for (let x = -6; x <= 5; x++) for (let z = 0; z <= 7; z++) b.set(x, y + 15 + (z > 3 ? 1 : 0), z, paint(x, y + 16, z)); // corcunda
      b.box(-5, y + 4, -7, 5, y + 11, -6, skin.light); // peito pelado
    },
    headPaint: (b) => {
      const paint = furPaint(shag, 6);
      b.box(-7, 7, -7, 7, 12, 7, fur.base).box(-7, 3, 5, 7, 12, 7, fur.base); // juba
      for (let x = -7; x <= 6; x++) if (hash3(x, 0, 0, 9) < 0.6) b.set(x, 7 - Math.floor(hash3(x, 1, 0, 9) * 3), -7, paint(x, 7, -7)); // franja
      b.set(-3, 1, -7, "#f4f8fb").set(2, 1, -7, "#f4f8fb"); // presas
    },
    weaponPaint: (b) => b.box(-4, -19, -4, 4, -14, 4, skin.dark), // mão enorme
    offhandPaint: (b) => b.box(-4, -19, -4, 4, -14, 4, skin.dark),
    weaponArmRest: 0.15,
  });
  return enlarge(model, 1.25);
}

/** Espectro gélido: vulto de gelo translúcido, manto esfarrapado que vira névoa e coroa de estilhaços. */
export function createIceWraith(): CharacterModel {
  const robe = shades("#7ab8d8", 0.12);
  const model = buildHumanoid({
    skin: shades("#d8f2ff", 0.08),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 13 },
    head: { hw: 5, h: 10, hd: 5 },
    torso: { hw: 6, h: 14, hd: 3 },
    legX: 3,
    armX: 8,
    pants: robe,
    boots: shades("#9ad0ea", 0.1),
    bootH: 2,
    sleeve: robe,
    sleeveLen: 13,
    face: { eye: "#2a6aff", mouth: "flat" },
    mouthY: 2,
    torsoPaint: (b, y) => {
      for (let yy = y - 12; yy < y + 2; yy++) {
        const r = 7 + Math.floor((y + 2 - yy) / 4);
        for (let x = -r; x <= r; x++) for (const z of [-4, 3]) if (hash3(x, yy, z, 2) > (y - yy) / 18) b.set(x, yy, z, yy % 3 ? robe.base : robe.dark);
      }
      b.box(-1, y + 3, -4, 1, y + 12, -3, "#e8fbff");
    },
    headPaint: (b) => {
      b.box(-6, 5, -6, 6, 12, 6, robe.dark).box(-5, 1, 5, 5, 9, 6, robe.dark); // capuz
      for (const [x, h] of [[-4, 4], [-2, 6], [0, 8], [2, 6], [4, 4]] as const) b.box(x, 12, -1, x + 1, 12 + h, 0, "#c8f0ff"); // coroa de estilhaços
    },
    weaponPaint: (b) => {
      b.box(0, -24, -1, 1, -2, 0, "#a8c8d8"); // cajado
      b.box(-2, -3, -3, 3, 3, 2, "#5ad0ff").box(-1, 3, -2, 2, 5, 1, "#bfeeff");
    },
  });
  const ghost = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.78, emissive: new THREE.Color("#3aa8e8"), emissiveIntensity: 0.4, depthWrite: false });
  model.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghost;
      m.castShadow = false;
    }
  });
  return model;
}

/** Gigante de Gelo: pele azul de pedra, armadura de placas de gelo, barba de pingentes e uma clava de geleira. */
export function createFrostGiant(): CharacterModel {
  const skin = shades("#6a8ab0", 0.1);
  const ice = shades("#a6d8ee", 0.12);
  const model = buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 12 },
    arms: { hw: 3, hd: 3, length: 14 },
    head: { hw: 6, h: 11, hd: 6 },
    torso: { hw: 9, h: 15, hd: 5 },
    legX: 4,
    armX: 12,
    pants: shades("#4a5a74", 0.1),
    boots: ice,
    bootH: 4,
    sleeve: ice,
    sleeveLen: 5,
    face: { eye: "#9af0ff", mouth: "grin" },
    mouthY: 2,
    torsoPaint: (b, y) => {
      b.box(-9, y + 5, -6, 9, y + 15, -5, ice.base); // peitoral de gelo
      for (let x = -8; x < 9; x += 4) b.box(x, y + 6, -7, x + 2, y + 13, -6, ice.light);
      b.box(-10, y + 1, -6, 10, y + 3, 6, "#4a3a2a"); // cinto de couro
      b.box(-2, y + 1, -7, 2, y + 3, -6, "#c9d8e8"); // fivela
      for (const s of [-1, 1]) b.box(s < 0 ? -14 : 9, y + 12, -6, s < 0 ? -9 : 14, y + 17, 6, ice.base).box(s < 0 ? -14 : 9, y + 16, -6, s < 0 ? -9 : 14, y + 17, 6, "#f0f8ff"); // ombreiras
    },
    headPaint: (b) => {
      b.box(-7, 9, -7, 7, 13, 7, ice.dark).box(-7, 12, -7, 7, 13, 7, "#f0f8ff"); // elmo
      for (const s of [-1, 1]) b.box(s * 7 - (s < 0 ? 2 : 0), 10, -1, s * 7 + (s > 0 ? 2 : 0), 18, 1, ice.light); // chifres de gelo
      for (let x = -5; x <= 4; x++) {
        const len = 3 + Math.floor(hash3(x, 0, 0, 5) * 5);
        for (let d = 0; d < len; d++) b.set(x, 2 - d, -7, d === len - 1 ? "#ffffff" : d % 2 ? "#bfe4f4" : "#d8f0fa"); // barba de pingentes
      }
    },
    weaponPaint: (b) => {
      b.box(-1, -30, -1, 2, -10, 2, "#4a3a2a"); // cabo
      for (let y = -38; y < -26; y++) {
        const r = 4 - Math.abs(y + 32) * 0.4;
        for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (Math.hypot(x, z) < r) b.set(x, y, z, pickTone(["#8fcbe8", "#a6d8ee", "#d8f0fa"], hash3(x, y, z, 2)));
      }
    },
    weaponArmRest: 0.2,
  });
  return enlarge(model, 2.4);
}

/** Rainha Gélida: alta e esguia, pele azul-clara, cabelo branco, coroa de pontas de gelo, vestido e lâmina de gelo. */
export function createIceQueen(): CharacterModel {
  const gown = shades("#4a7ab8", 0.12);
  const model = buildHumanoid({
    skin: shades("#cfe8f6", 0.08),
    legs: { hw: 2, hd: 2, length: 14 },
    arms: { hw: 2, hd: 2, length: 13 },
    head: { hw: 5, h: 11, hd: 5 },
    torso: { hw: 6, h: 14, hd: 3 },
    legX: 3,
    armX: 8,
    pants: gown,
    boots: shades("#2a4a7a", 0.1),
    bootH: 3,
    sleeve: gown,
    sleeveLen: 13,
    face: { eye: "#5ad0ff", mouth: "flat" },
    mouthY: 2,
    neck: 1,
    topExtra: 8,
    torsoPaint: (b, y) => {
      for (let yy = y - 14; yy < y + 2; yy++) {
        const r = 6 + Math.floor((y + 2 - yy) / 3);
        for (let x = -r; x <= r; x++) for (let z = -Math.min(r, 6); z <= Math.min(r, 6); z++) if (Math.abs(x) >= r - 1 || Math.abs(z) >= Math.min(r, 6) - 1) b.set(x, yy, z, yy % 4 ? gown.base : gown.dark);
      }
      b.box(-7, y + 2, -4, 7, y + 4, 4, "#d8f0fa"); // faixa de gelo
      for (let x = -9; x <= 8; x++) b.set(x, y + 14, 4, "#e8f6ff").set(x, y + 15 + (Math.abs(x) % 3), 4, "#bfe4f4"); // gola alta
    },
    headPaint: (b) => {
      b.box(-6, 6, -6, 6, 12, 6, "#f0f6fa").box(-6, -4, 4, 6, 12, 6, "#f0f6fa").box(-6, 5, -6, 6, 6, -5, "#dbe6ee"); // cabelo longo
      for (const [x, h] of [[-5, 3], [-3, 5], [-1, 8], [1, 8], [3, 5], [5, 3]] as const) b.box(x, 12, -5, x + 1, 12 + h, -4, "#9adcff"); // coroa
      b.set(0, 14, -6, "#5ad0ff");
    },
    weaponPaint: (b) => {
      b.box(-1, -16, -1, 1, -11, 1, "#d8e8f0");
      for (let y = -38; y < -16; y++) b.box(-1, y, -1, 1, y + 1, 0, y < -34 ? "#ffffff" : "#a6d8ee");
      b.box(-3, -17, -1, 3, -16, 0, "#5ad0ff");
    },
  });
  return enlarge(model, 1.3);
}

/** Jarl Bjorn: manto de pele, elmo com chifres, barba ruiva trançada e machado. */
export function createJarl(): CharacterModel {
  const cloak = shades("#6a5a48", 0.1);
  return buildHumanoid({
    skin: shades("#e8b893", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 3, hd: 3, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 8, h: 14, hd: 4 },
    legX: 3,
    armX: 11,
    pants: shades("#3a3a46", 0.08),
    boots: shades("#4a3420", 0.1),
    bootH: 4,
    sleeve: shades("#4a5a7a", 0.1),
    sleeveLen: 8,
    face: { mouth: "flat" },
    mouthY: 3,
    topExtra: 6,
    torsoPaint: (b, y) => {
      b.box(-9, y + 9, -5, 9, y + 15, 5, "#e6e0d4").box(-9, y + 13, -5, 9, y + 15, 5, "#f4f0e8"); // gola de pele
      b.box(-9, y - 3, 4, 9, y + 12, 6, cloak.base).box(-9, y - 3, 5, 9, y - 2, 6, cloak.dark); // manto
      b.box(-8, y + 1, -5, 8, y + 3, 5, PAL.leather.dark).box(-1, y + 1, -6, 1, y + 3, -5, PAL.gold.base);
    },
    headPaint: (b) => {
      b.box(-7, 9, -7, 7, 14, 7, PAL.steel.base).box(-7, 9, -7, 7, 10, 7, PAL.steel.dark);
      for (const s of [-1, 1]) b.box(s < 0 ? -10 : 7, 11, -1, s < 0 ? -7 : 10, 13, 1, "#e8e0c8").box(s < 0 ? -11 : 9, 13, -1, s < 0 ? -9 : 11, 18, 1, "#e8e0c8"); // chifres
      b.box(-5, -5, -7, 5, 3, -6, "#b04a24").box(-2, -9, -7, 2, -5, -6, "#c05a2a").set(0, -7, -8, PAL.gold.base); // barba trançada
    },
    weaponPaint: (b) => {
      b.box(-1, -26, -1, 1, -9, 0, PAL.wood.base);
      b.box(-1, -27, -6, 1, -21, -1, PAL.steel.base).box(-1, -27, -7, 1, -21, -6, PAL.steel.light);
    },
  });
}

/** Mercadora Sigrid: chapéu de pele, casaco acolchoado, bolsa de couro e um fardo de peles no ombro. */
export function createFurTrader(): CharacterModel {
  const coat = shades("#8a4a3a", 0.1);
  return buildHumanoid({
    skin: shades("#f0c8a8", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#4a3a30", 0.08),
    boots: shades("#3a2a1a", 0.1),
    bootH: 5,
    sleeve: coat,
    sleeveLen: 12,
    face: { mouth: "smile" },
    mouthY: 3,
    topExtra: 4,
    torsoPaint: (b, y) => {
      b.box(-8, y - 5, -5, 8, y + 3, 5, coat.base).box(-8, y - 5, -5, 8, y - 4, 5, "#e6e0d4"); // casaco até o joelho com barra de pele
      b.box(-1, y - 5, -6, 1, y + 13, -5, "#e6e0d4");
      b.box(5, y - 1, -6, 9, y + 4, -3, PAL.leather.base); // bolsa
      b.box(-9, y + 12, -3, -5, y + 17, 4, "#a8865a").box(-9, y + 15, -3, -5, y + 17, 4, "#c8a87a"); // fardo de peles
    },
    headPaint: (b) => {
      b.box(-7, 9, -7, 7, 16, 7, "#d8cfc0").box(-7, 15, -7, 7, 16, 7, "#e8e0d4").box(-7, 9, -8, 7, 11, -7, "#c8bfb0"); // chapéu de pele
      b.box(-6, 2, 5, 6, 10, 7, "#d8a040").box(-2, -4, 6, 2, 2, 8, "#d8a040"); // trança loira
    },
  });
}

/** Caçadora Eira: capa branca de camuflagem, capuz, lança de ponta de osso. */
export function createHunter(): CharacterModel {
  const cloak = shades("#e6ecf2", 0.08);
  return buildHumanoid({
    skin: shades("#d8a07a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#7a8494", 0.08),
    boots: shades("#5a4a3a", 0.1),
    bootH: 5,
    sleeve: shades("#9aa4b4", 0.1),
    sleeveLen: 10,
    face: { mouth: "flat" },
    mouthY: 3,
    topExtra: 3,
    torsoPaint: (b, y) => {
      b.box(-8, y - 2, 4, 8, y + 14, 5, cloak.base).box(-8, y - 2, 4, 8, y - 1, 5, cloak.dark);
      b.box(-8, y + 1, -5, 8, y + 3, 5, "#6b4a2b");
    },
    headPaint: (b) => {
      b.box(-7, 8, -7, 7, 15, 7, cloak.base).box(-7, 14, -7, 7, 15, 7, cloak.light).box(-6, 2, 6, 6, 10, 7, cloak.dark);
      b.box(-7, 8, -7, -5, 10, 7, cloak.dark).box(5, 8, -7, 7, 10, 7, cloak.dark);
    },
    weaponPaint: (b) => {
      b.box(0, -36, -1, 1, 10, 0, PAL.wood.base);
      b.box(-1, 10, -1, 2, 15, 0, "#e8e0d0").set(0, 16, -1, "#f4f0e8");
    },
  });
}

