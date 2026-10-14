import * as THREE from "three";
import { hash3, noise3, pickTone } from "../props/sculpt";
import { buildHumanoid } from "./humanoid";
import { PAL, shades, type CharacterModel } from "./common";
import { createWolf } from "./forest";

/**
 * Criaturas e gente das Terras Vulcânicas, em voxels de 1/16 m: o cão de lava (lobo de pelagem negra
 * com rachaduras em brasa), o piromante, o golem de magma, o Senhor das Chamas e o Mestre da Forja (os
 * três montados maiores, como os outros chefes) e os moradores do Bastião de Brasa.
 */
export function createLavaHound(): CharacterModel {
  return createWolf({ fur: ["#1a1414", "#241c1a", "#3a2018", "#ff7a1a"], snout: "#2a2020", dark: "#120e0e", ear: "#3a2018", eye: "#ffd040" });
}

function enlarge(model: CharacterModel, k: number): CharacterModel {
  const root = new THREE.Group();
  model.root.scale.setScalar(k);
  root.add(model.root);
  return { ...model, root, height: model.height * k };
}

/** Faz as partes alaranjadas da malha brilharem (emissivo por cor de vértice não existe: brilho geral). */
function glowing(model: CharacterModel, color: string, intensity: number): CharacterModel {
  model.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = intensity;
    m.material = mat;
  });
  return model;
}

/** Piromante: manto vermelho e preto, capuz, máscara de osso e cajado com uma brasa na ponta. */
export function createFlameCaster(): CharacterModel {
  const robe = shades("#8a1a14", 0.12);
  return buildHumanoid({
    skin: shades("#c8906a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#2a1a1a", 0.08),
    boots: shades("#1a1414", 0.1),
    bootH: 3,
    sleeve: robe,
    sleeveLen: 12,
    face: { eye: "#ffb43a", mouth: "flat" },
    mouthY: 3,
    topExtra: 3,
    torsoPaint: (b, y) => {
      b.box(-8, y - 6, -5, 8, y + 3, 5, robe.dark).box(-8, y - 6, -5, 8, y - 5, 5, "#ff7a1a"); // manto com barra em brasa
      b.box(-1, y + 2, -5, 1, y + 13, -4, "#1a1414");
      b.box(-8, y + 2, -5, 8, y + 4, 5, "#1a1414");
    },
    headPaint: (b) => {
      b.box(-7, 7, -7, 7, 15, 7, robe.base).box(-7, 14, -7, 7, 15, 7, robe.light).box(-6, 0, 6, 6, 11, 7, robe.dark); // capuz
      b.box(-5, 1, -7, 5, 8, -6, "#e8dcc4").set(-3, 5, -8, "#ff7a1a").set(2, 5, -8, "#ff7a1a"); // máscara de osso
    },
    weaponPaint: (b) => {
      b.box(0, -26, -1, 1, 6, 0, "#2a1a14");
      b.box(-2, 6, -3, 3, 11, 2, "#ff7a1a").box(-1, 8, -2, 2, 13, 1, "#ffc24a");
    },
  });
}

/** Golem de magma: pedra negra em placas, rachaduras e núcleo em brasa, punhos enormes. */
export function createMagmaGolem(): CharacterModel {
  const rock = shades("#2e2a2c", 0.12);
  const crack = (x: number, y: number, z: number) => (Math.abs(noise3(x / 3, y / 3, z / 3, 7) - 0.5) < 0.05 ? pickTone(["#ff7a1a", "#ffa03a"], hash3(x, y, z)) : null);
  const model = buildHumanoid({
    skin: rock,
    legs: { hw: 3, hd: 3, length: 11 },
    arms: { hw: 3, hd: 3, length: 15 },
    head: { hw: 5, h: 8, hd: 5 },
    torso: { hw: 10, h: 15, hd: 6 },
    legX: 5,
    armX: 13,
    pants: rock,
    boots: shades("#1e1a1c", 0.1),
    bootH: 3,
    sleeve: rock,
    sleeveLen: 15,
    face: { eye: "#ffc24a", mouth: "flat" },
    mouthY: 1,
    torsoPaint: (b, y) => {
      for (let x = -10; x < 10; x++) for (let yy = y; yy < y + 15; yy++) for (const z of [-6, 5]) { const c = crack(x, yy, z); if (c) b.set(x, yy, z, c); }
      b.box(-3, y + 6, -7, 3, y + 11, -6, "#ffb43a").box(-2, y + 7, -8, 2, y + 10, -7, "#ffe08a"); // núcleo
      for (const s of [-1, 1]) b.box(s < 0 ? -12 : 8, y + 12, -5, s < 0 ? -8 : 12, y + 17, 5, rock.dark); // ombros de pedra
    },
    headPaint: (b) => b.box(-6, 6, -6, 6, 9, 6, rock.dark),
    weaponPaint: (b) => b.box(-4, -19, -4, 4, -13, 4, rock.dark).box(-4, -19, -5, 4, -17, -4, "#ff7a1a"),
    offhandPaint: (b) => b.box(-4, -19, -4, 4, -13, 4, rock.dark).box(-4, -19, -5, 4, -17, -4, "#ff7a1a"),
    weaponArmRest: 0.15,
  });
  return enlarge(glowing(model, "#ff5a10", 0.12), 1.5);
}

/** Senhor das Chamas: demônio de pele vermelha, chifres, coroa de fogo, asas de rocha e lâmina em brasa. */
export function createFireLord(): CharacterModel {
  const skin = shades("#a82a1a", 0.1);
  const model = buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 12 },
    arms: { hw: 3, hd: 3, length: 14 },
    head: { hw: 6, h: 11, hd: 6 },
    torso: { hw: 9, h: 15, hd: 5 },
    legX: 4,
    armX: 12,
    pants: shades("#2a1414", 0.1),
    boots: shades("#1a1010", 0.1),
    bootH: 4,
    sleeve: skin,
    sleeveLen: 0,
    face: { eye: "#ffe08a", mouth: "fangs" },
    mouthY: 2,
    topExtra: 10,
    torsoPaint: (b, y) => {
      b.box(-9, y + 5, -6, 9, y + 15, -5, "#2a2224"); // peitoral de obsidiana
      for (let x = -8; x < 9; x += 4) b.box(x, y + 7, -7, x + 1, y + 13, -6, "#ff7a1a");
      b.box(-10, y + 1, -6, 10, y + 3, 6, "#2a1a14").box(-2, y + 1, -7, 2, y + 3, -6, "#d4a92a");
      // Asas de rocha com membrana em brasa, nas costas.
      for (const s of [-1, 1])
        for (let k = 0; k < 16; k++) {
          const x = s * (4 + k), top = y + 22 - Math.floor(k * 0.5);
          for (let yy = y + 6 + Math.floor(k * 0.6); yy < top; yy++) b.set(x, yy, 7, k % 5 === 0 || yy === top - 1 ? "#2a2224" : pickTone(["#c0400a", "#e0601a"], hash3(x, yy, 7)));
        }
    },
    headPaint: (b) => {
      for (const s of [-1, 1]) {
        b.box(s < 0 ? -9 : 6, 8, -1, s < 0 ? -6 : 9, 11, 1, "#2a2224").box(s < 0 ? -10 : 8, 11, -1, s < 0 ? -8 : 10, 17, 1, "#2a2224").box(s < 0 ? -10 : 9, 17, -1, s < 0 ? -9 : 10, 20, 0, "#e8dcc4"); // chifres
      }
      for (const [x, h] of [[-4, 4], [-2, 7], [0, 9], [2, 7], [4, 4]] as const) b.box(x, 11, -1, x + 1, 11 + h, 0, h > 6 ? "#ffc24a" : "#ff7a1a"); // coroa de fogo
    },
    weaponPaint: (b) => {
      b.box(-1, -16, -1, 1, -11, 1, "#2a2224");
      b.box(-3, -17, -1, 3, -16, 1, "#d4a92a");
      for (let y = -40; y < -17; y++) b.box(-1, y, -1, 2, y + 1, 0, y < -36 ? "#ffe08a" : y % 3 ? "#ff7a1a" : "#ffa03a");
    },
    weaponArmRest: 0.2,
  });
  return enlarge(glowing(model, "#ff4a10", 0.18), 2.4);
}

/** Mestre da Forja: ferreiro enorme de avental de couro, braços queimados, máscara de ferro e martelo. */
export function createForgeMaster(): CharacterModel {
  const skin = shades("#8a5a42", 0.1);
  const model = buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 11 },
    arms: { hw: 3, hd: 3, length: 13 },
    head: { hw: 6, h: 11, hd: 6 },
    torso: { hw: 10, h: 15, hd: 6 },
    legX: 5,
    armX: 13,
    pants: shades("#2a2220", 0.08),
    boots: shades("#1a1414", 0.1),
    bootH: 5,
    sleeve: skin,
    sleeveLen: 0,
    face: { eye: "#ff9a3a", mouth: "flat" },
    mouthY: 2,
    torsoPaint: (b, y) => {
      const apron = shades("#3a2a1e", 0.1);
      b.box(-8, y - 3, -7, 8, y + 13, -6, apron.base).box(-8, y + 10, -7, 8, y + 13, -6, apron.light);
      b.box(-10, y + 1, -7, 10, y + 3, 7, PAL.leather.dark);
      for (const [x, yy] of [[-5, 4], [3, 7], [-2, 10]] as const) b.set(x, y + yy, -8, "#ff7a1a"); // queimaduras no avental
      for (const s of [-1, 1]) b.box(s < 0 ? -13 : 9, y + 12, -6, s < 0 ? -9 : 13, y + 16, 6, PAL.darkSteel.base);
    },
    headPaint: (b) => {
      b.box(-7, 0, -7, 7, 13, -6, PAL.darkSteel.base).box(-5, 5, -8, -1, 7, -7, "#ff9a3a").box(1, 5, -8, 5, 7, -7, "#ff9a3a"); // máscara de ferro com frestas acesas
      b.box(-7, 10, -7, 7, 13, 7, PAL.darkSteel.dark);
    },
    weaponPaint: (b) => {
      b.box(-1, -30, -1, 1, -9, 1, "#4a3220");
      b.box(-6, -38, -4, 6, -30, 4, PAL.darkSteel.base).box(-6, -38, -4, 6, -36, 4, "#ff7a1a"); // martelo com a cabeça em brasa
    },
    weaponArmRest: 0.2,
  });
  return enlarge(glowing(model, "#ff5a10", 0.1), 1.6);
}

/** Comandante Varga: armadura escura com detalhes em cobre, capa vermelha e lança. */
export function createCommander(): CharacterModel {
  return buildHumanoid({
    skin: shades("#c8906a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 3, hd: 3, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 8, h: 14, hd: 4 },
    legX: 3,
    armX: 11,
    pants: shades("#2a2a30", 0.08),
    boots: shades("#1a1a1e", 0.1),
    bootH: 5,
    sleeve: shades("#3a3a42", 0.1),
    sleeveLen: 10,
    face: { mouth: "flat" },
    mouthY: 3,
    topExtra: 3,
    torsoPaint: (b, y) => {
      b.box(-9, y - 3, 4, 9, y + 13, 6, "#8a1a14").box(-9, y - 3, 5, 9, y - 2, 6, "#5a1010"); // capa
      b.box(-8, y + 5, -5, 8, y + 14, -4, PAL.darkSteel.base);
      b.box(-1, y + 7, -6, 1, y + 12, -5, "#c87a3a");
      for (const s of [-1, 1]) b.box(s < 0 ? -12 : 8, y + 11, -5, s < 0 ? -8 : 12, y + 15, 5, "#c87a3a");
    },
    headPaint: (b) => {
      b.box(-7, 8, -7, 7, 15, 7, PAL.darkSteel.base).box(-1, 2, -8, 1, 9, -7, PAL.darkSteel.dark);
      b.box(-1, 15, -5, 1, 18, 5, "#8a1a14"); // crista
      b.box(-4, 0, -7, 4, 2, -6, "#3a2a20"); // barba curta
    },
    weaponPaint: (b) => {
      b.box(-1, -36, -1, 1, 12, 0, "#3a2a20");
      b.box(-1, 12, -1, 1, 19, 0, "#c87a3a").set(0, 20, -1, "#ffb43a");
    },
  });
}

/** Ferreira Ignis: braços fortes, avental de couro, óculos de proteção na testa e tenaz. */
export function createForgeSmith(): CharacterModel {
  return buildHumanoid({
    skin: shades("#a8704a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 3, hd: 3, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 8, h: 14, hd: 4 },
    legX: 3,
    armX: 11,
    pants: shades("#3a3028", 0.08),
    boots: shades("#2b2b2b", 0.1),
    bootH: 4,
    sleeve: shades("#5a4a3a", 0.1),
    sleeveLen: 2,
    face: { mouth: "smile" },
    mouthY: 3,
    torsoPaint: (b, y) => {
      b.box(-6, y - 2, -5, 6, y + 12, -4, "#4a3424").box(-6, y + 9, -5, 6, y + 12, -4, "#5a4030");
      b.box(-8, y + 1, -5, 8, y + 3, 5, PAL.leather.dark);
    },
    headPaint: (b) => {
      b.box(-6, 11, -6, 6, 14, 6, "#1a1414").box(-6, 7, 5, 6, 12, 6, "#1a1414"); // cabelo preso
      b.box(-6, 10, -7, 6, 12, -6, "#3a3a42").box(-5, 10, -8, -1, 12, -7, "#ffb43a").box(1, 10, -8, 5, 12, -7, "#ffb43a"); // óculos na testa
    },
    offhandPaint: (b) => {
      b.box(-1, -24, -1, 1, -8, 0, PAL.darkSteel.base);
      b.box(-2, -27, -2, 2, -24, 1, "#ff8a2a");
    },
  });
}

/** Batedor Kael: roupa de couro cor de cinza, lenço no rosto e arco curto. */
export function createScout(): CharacterModel {
  const cloak = shades("#6a6260", 0.08);
  return buildHumanoid({
    skin: shades("#d8a07a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#4a4240", 0.08),
    boots: shades("#3a2a1a", 0.1),
    bootH: 5,
    sleeve: shades("#5a4a3a", 0.1),
    sleeveLen: 10,
    face: { mouth: "flat" },
    mouthY: 3,
    topExtra: 3,
    torsoPaint: (b, y) => {
      b.box(-8, y - 2, 4, 8, y + 14, 5, cloak.base);
      b.box(-8, y + 1, -5, 8, y + 3, 5, "#6b4a2b");
    },
    headPaint: (b) => {
      b.box(-7, 8, -7, 7, 15, 7, cloak.base).box(-7, 14, -7, 7, 15, 7, cloak.light).box(-6, 2, 6, 6, 10, 7, cloak.dark);
      b.box(-6, 0, -7, 6, 4, -6, "#8a3a2a"); // lenço no rosto
    },
    weaponPaint: (b) => {
      for (let y = -20; y < -4; y++) {
        const bend = Math.round(Math.sin(((y + 20) / 16) * Math.PI) * 2);
        b.set(0, y, -2 - bend, "#5a3a20");
      }
      for (let y = -19; y < -5; y++) b.set(0, y, -1, "#e8e0d0");
    },
  });
}
