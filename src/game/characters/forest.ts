import * as THREE from "three";
import { VoxelBuilder } from "../voxel";
import { blob, bough, hash3, limb, noise3, pickTone, type Paint } from "../props/sculpt";
import { buildHumanoid } from "./humanoid";
import { PAL, V, mesh, pivot, shades, type CharacterModel } from "./common";

/**
 * Criaturas da Floresta Ancestral, em voxels de 1/16 m: o lobo cinzento (quadrúpede com quatro pernas
 * articuladas), o ente (árvore que anda: tronco, braços de galho, pés de raiz e copa na cabeça), o
 * espírito élfico (arqueiro translúcido que brilha) e a Guardiã Lyra. O Ente Ancião é um ente gigante,
 * coberto de musgo e cogumelos.
 */

const FUR = ["#4a4a50", "#5a5a62", "#6a6a72", "#7a7a82"];

export function createWolf(): CharacterModel {
  const fur: Paint = (x, y, z) => {
    // Dorso escuro, barriga e peito claros, manchas em ruído.
    const t = Math.min(0.999, Math.max(0, (14 - y) / 9 * 0.6 + noise3(x / 3, y / 3, z / 3, 4) * 0.4));
    return pickTone(FUR, t);
  };
  const b = new VoxelBuilder();
  blob(b, [0, 13, 1], [4.5, 4, 10], fur, { rough: 0.12, grain: 3, seed: 2 }); // corpo
  blob(b, [0, 14.5, -8], [5, 4.5, 4], fur, { rough: 0.15, grain: 2.5, seed: 3 }); // peito e ombros
  // Cabeça, focinho, orelhas e olhos amarelos.
  const head = new VoxelBuilder();
  blob(head, [0, 2, -3], [3.5, 3.2, 3.5], fur, { rough: 0.08, seed: 5 });
  head.box(-2, -1, -10, 2, 2, -5, "#5a5a62").box(-2, -1, -10, 2, 0, -5, "#3a3a40").box(-1, 1, -11, 1, 2, -10, "#1b1b1f"); // focinho e nariz
  head.box(-1, -2, -9, 1, -1, -6, "#e8e0d0"); // presas
  for (const s of [-1, 1]) {
    head.box(s < 0 ? -4 : 2, 4, -3, s < 0 ? -2 : 4, 8, -1, "#4a4a50").box(s < 0 ? -3 : 2, 5, -3, s < 0 ? -2 : 3, 7, -2, "#8a6a6a"); // orelhas
    head.set(s < 0 ? -2 : 1, 3, -6, "#ffd040").set(s < 0 ? -3 : 2, 3, -6, "#1b1b1f");
  }
  // Rabo levantado em curva.
  bough(b, [[0, 15, 10], [0, 17, 14], [0, 15, 18]], 1.8, 0.9, (x, y, z) => pickTone(FUR, hash3(x, y, z) * 0.6 + 0.2));
  const root = new THREE.Group();
  root.add(mesh(b));
  const headGroup = pivot(0, 15, -10, mesh(head));
  root.add(headGroup);
  // Quatro pernas, com pivô no ombro/quadril: [dianteira esq., dianteira dir., traseira esq., traseira dir.].
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[-3, -8], [3, -8], [-3, 8], [3, 8]] as const) {
    const leg = new VoxelBuilder();
    leg.box(-1, -12, -1, 2, 0, 2, "#5a5a62").box(-1, -12, -2, 2, -10, 2, "#3a3a40"); // pata
    const p = pivot(x, 12, z, mesh(leg));
    legs.push(p);
    root.add(p);
  }
  // O "braço da arma" do lobo é a cabeça: a mordida é o golpe.
  return { root, legs, head: headGroup, weaponArm: headGroup, height: 20 * V + 0.15 };
}

const BARK = ["#3e2a1a", "#4e3522", "#5e412a", "#6e4f33"];
const LEAF = ["#1f4a24", "#28592a", "#326a30", "#3d7c36", "#5a9a44"];

/** Ente: k = 1 para o jovem; o Ente Ancião usa k ≈ 2,2 e mais musgo. */
export function createEnt(k = 1, ancient = false): CharacterModel {
  const s = (n: number) => Math.round(n * k);
  const bark: Paint = (x, y, z) => {
    if (ancient && noise3(x / 3, y / 3, z / 3, 8) > 0.68) return pickTone(["#3e5a30", "#4a6a36", "#56763c"], hash3(x, y, z));
    return pickTone(BARK, noise3(x / 1.5, y / 6, z / 1.5, 3) * 0.85 + hash3(x, y, z) * 0.15);
  };
  const root = new THREE.Group();
  const hip = s(14);
  // Tronco (o corpo): mais largo embaixo, com rosto de casca e olhos verdes que brilham.
  const body = new VoxelBuilder();
  limb(body, [0, hip, 0], [0, hip + s(22), 0], s(7), s(5.5), bark);
  for (const sx of [-1, 1]) {
    body.recolorFront(sx * s(2) - (sx < 0 ? 1 : 0), hip + s(17), "#9cff6a");
    body.recolorFront(sx * s(2) - (sx < 0 ? 1 : 0) + (sx < 0 ? -1 : 1), hip + s(17), "#5adf3a");
  }
  for (let x = -s(2); x < s(2); x++) body.recolorFront(x, hip + s(12), "#1b1410"); // boca, uma fenda escura
  // Copa na cabeça: tufos de folha.
  const leaf: Paint = (x, y, z) => pickTone(LEAF, Math.min(0.999, (y - hip - s(20)) / s(14) * 0.6 + noise3(x / 3, y / 3, z / 3, 6) * 0.4));
  for (const [cx, cy, cz, r] of [[0, s(26), 0, s(9)], [-s(7), s(23), s(2), s(6)], [s(6), s(24), -s(2), s(6)], [0, s(30), s(3), s(6)]] as const) {
    blob(body, [cx, hip + cy, cz], [r, r * 0.8, r], leaf, { rough: 0.25, grain: 3, seed: cx + cy, under: true });
  }
  if (ancient) {
    // Cogumelos que brilham nos ombros e barba de musgo.
    for (const [x, y, z] of [[-s(6), s(18), 0], [s(6), s(16), s(2)], [-s(3), s(8), -s(6)]] as const) {
      body.box(x - 2, hip + y, z - 2, x + 2, hip + y + 1, z + 2, "#5ad8ff").set(x, hip + y - 1, z, "#d8e8f0");
    }
    for (let x = -s(3); x < s(3); x += 2) for (let y = 0; y < s(6); y++) body.recolorFront(x, hip + s(10) - y, y % 2 ? "#5a7a4a" : "#4a6a3a");
  }
  root.add(mesh(body));
  // Pés de raiz (pernas) e braços de galho com dedos de graveto.
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new VoxelBuilder();
    limb(leg, [0, 0, 0], [0, -hip + 2, 0], s(3.2), s(3.6), bark);
    for (const [dx, dz] of [[2, -4], [-2, -4], [0, 3]] as const) limb(leg, [0, -hip + 3, 0], [s(dx), -hip, s(dz)], s(1.6), s(0.8), bark);
    const p = pivot(side * s(4), hip, 0, mesh(leg));
    legs.push(p);
    root.add(p);
  }
  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const arm = new VoxelBuilder();
    bough(arm, [[0, 0, 0], [side * s(2), -s(8), 0], [side * s(1), -s(18), -s(2)]], s(2.6), s(1.6), bark);
    for (const [dx, dz] of [[-2, -3], [2, -3], [0, -4]] as const) limb(arm, [side * s(1), -s(18), -s(2)], [side * s(1) + s(dx), -s(23), s(dz) - s(2)], s(0.9), s(0.5), bark);
    blob(arm, [side * s(2), -s(4), s(1)], [s(3), s(2.5), s(3)], leaf, { rough: 0.3, seed: side + 9 });
    const p = pivot(side * s(8), hip + s(19), 0, mesh(arm));
    arms.push(p);
    root.add(p);
  }
  return { root, legs, offArm: arms[0], weaponArm: arms[1], height: (hip + s(36)) * V, weaponArmRest: 0.15 };
}

/** Espírito élfico: arqueiro esguio de capuz, translúcido e azulado, que brilha de leve no escuro. */
export function createElvenSpirit(): CharacterModel {
  const skin = shades("#b8e8f0", 0.08);
  const cloth = shades("#4a8aa8", 0.1);
  const model = buildHumanoid({
    skin,
    legs: { hw: 2, hd: 2, length: 13 },
    arms: { hw: 2, hd: 2, length: 13 },
    head: { hw: 5, h: 11, hd: 5 },
    torso: { hw: 6, h: 14, hd: 3 },
    legX: 3,
    armX: 8,
    pants: cloth,
    boots: shades("#3a6a88", 0.1),
    bootH: 2,
    sleeve: cloth,
    sleeveLen: 10,
    face: { eye: "#e8fbff", mouth: "flat" },
    mouthY: 2,
    torsoPaint: (b, y) => {
      b.box(-7, y - 6, -4, 7, y + 2, 4, cloth.dark); // túnica longa
      b.box(-1, y + 2, -4, 1, y + 13, -3, "#c8e8f8"); // faixa
      b.box(-7, y + 12, -4, 7, y + 14, 4, cloth.light);
    },
    headPaint: (b) => {
      b.box(-6, 6, -6, 6, 13, 6, cloth.base).box(-6, 12, -6, 6, 13, 6, cloth.light).box(-5, 1, 5, 5, 9, 6, cloth.dark); // capuz
      for (const s of [-1, 1]) b.box(s < 0 ? -8 : 5, 6, -1, s < 0 ? -5 : 8, 8, 1, skin.base); // orelhas pontudas
    },
    weaponPaint: (b) => {
      // Arco élfico longo, de prata.
      for (let y = -22; y < -2; y++) {
        const bend = Math.round(Math.sin(((y + 22) / 20) * Math.PI) * 2);
        b.set(0, y, -2 - bend, "#c8d8e8");
      }
      for (let y = -21; y < -3; y++) b.set(0, y, -1, "#f0f8ff");
    },
  });
  // Material de fantasma: translúcido, emissivo azul.
  const ghost = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0.72, emissive: new THREE.Color("#3a8ab8"), emissiveIntensity: 0.35, depthWrite: false });
  model.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghost;
      m.castShadow = false;
    }
  });
  return model;
}

/**
 * Ente Ancião: o ente montado um pouco maior e desenhado com voxels duas vezes maiores (o grupo interno
 * é escalado). Fica do tamanho de um gigante com uma fração dos triângulos de esculpir em 1/16 m.
 */
export function createAncientTreant(): CharacterModel {
  const inner = createEnt(1.15, true);
  const root = new THREE.Group();
  inner.root.scale.setScalar(2);
  root.add(inner.root);
  return { ...inner, root, height: inner.height * 2 };
}

/** Guardiã Lyra: patrulheira de capuz verde, capa e arco às costas. */
export function createRanger(): CharacterModel {
  const cloak = shades("#2f5a34", 0.1);
  return buildHumanoid({
    skin: shades("#d8a07a", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#4a3a2a", 0.08),
    boots: shades("#3a2a1a", 0.1),
    bootH: 4,
    sleeve: shades("#5a7a3a", 0.1),
    sleeveLen: 6,
    face: { mouth: "smile" },
    mouthY: 3,
    topExtra: 3,
    torsoPaint: (b, y) => {
      b.box(-8, y - 2, 4, 8, y + 14, 5, cloak.base).box(-8, y - 2, 4, 8, y - 1, 5, cloak.dark); // capa
      b.box(-8, y + 1, -5, 8, y + 3, 5, "#6b4a2b"); // cinto
      // Arco atravessado nas costas.
      for (let k = 0; k < 22; k++) b.set(Math.min(8, Math.round(-8 + k * 0.75)), y + 2 + Math.round(k * 0.55), 6, "#7a5230");
    },
    headPaint: (b) => {
      b.box(-7, 8, -7, 7, 15, 7, cloak.base).box(-7, 14, -7, 7, 15, 7, cloak.light).box(-6, 2, 6, 6, 10, 7, cloak.dark); // capuz
      b.box(-7, 8, -7, -5, 10, 7, cloak.dark).box(5, 8, -7, 7, 10, 7, cloak.dark);
    },
  });
}

/** Mascate Faelan: meio-elfo de capa marrom, mochila enorme cheia de tralha e orelhas pontudas. */
export function createPeddler(): CharacterModel {
  const coat = shades("#7a5a3a", 0.1);
  const hair = shades("#d8c48a", 0.08);
  return buildHumanoid({
    skin: shades("#e2b892", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#3a4a2a", 0.08),
    boots: shades("#4a3018", 0.1),
    bootH: 4,
    sleeve: coat,
    sleeveLen: 10,
    face: { mouth: "smile" },
    mouthY: 3,
    topExtra: 2,
    torsoPaint: (b, y) => {
      b.box(-8, y - 4, -5, 8, y + 3, 5, coat.base).box(-8, y - 4, -5, 8, y - 3, 5, coat.dark); // casaco até a coxa
      b.box(-8, y + 2, -5, 8, y + 4, 5, "#3a2414").set(0, y + 3, -6, PAL.gold.light); // cinto com fivela
      b.box(-1, y + 4, -5, 1, y + 13, -4, PAL.gold.dark); // botões
      // Mochila: caixote com rolo de pano, panela e lanterna penduradas.
      b.box(-6, y + 1, 5, 6, y + 16, 10, "#6b4a2b").box(-6, y + 15, 5, 6, y + 16, 10, "#8a6238");
      b.box(-7, y + 16, 6, 7, y + 19, 9, "#a83a3a").box(-7, y + 17, 6, 7, y + 18, 9, "#c8584a"); // rolo de pano
      b.box(6, y + 4, 7, 9, y + 7, 10, "#5a5a62").box(-9, y + 6, 7, -7, y + 9, 9, "#e0a030"); // panela e lanterna
      for (const x of [-5, 4]) b.box(x, y + 2, -5, x + 1, y + 14, 5, "#3a2414"); // alças
    },
    headPaint: (b) => {
      b.box(-6, 11, -6, 6, 14, 6, hair.base).box(-6, 4, 5, 6, 12, 7, hair.base).box(-6, 10, -7, 6, 12, -6, hair.light);
      b.box(-8, 5, -1, -6, 9, 1, "#e2b892").set(-9, 9, 0, "#e2b892"); // orelhas pontudas
      b.box(6, 5, -1, 8, 9, 1, "#e2b892").set(8, 9, 0, "#e2b892");
      b.box(-8, 14, -8, 8, 15, 8, "#4a3a22").box(-5, 15, -5, 5, 19, 5, "#5a4a2a").box(-5, 16, -5, 5, 17, 5, "#a83a3a"); // chapéu
    },
  });
}

/** Armeira Kaia: braços fortes, avental de couro, trança ruiva, ombreira de casca de ente e martelo. */
export function createArmorer(): CharacterModel {
  const bark = shades("#5a4028", 0.1);
  const hair = shades("#b04a24", 0.08);
  return buildHumanoid({
    skin: shades("#c98a5e", 0.09),
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 3, hd: 3, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 8, h: 14, hd: 4 },
    legX: 3,
    armX: 11,
    pants: shades("#3a3028", 0.08),
    boots: shades("#2b2b2b", 0.1),
    bootH: 4,
    sleeve: shades("#6a7a4a", 0.1),
    sleeveLen: 3,
    face: { mouth: "flat" },
    mouthY: 3,
    topExtra: 0,
    torsoPaint: (b, y) => {
      const apron = shades("#4a3424", 0.1);
      b.box(-6, y - 2, -5, 6, y + 12, -4, apron.base).box(-6, y + 9, -5, 6, y + 12, -4, apron.light);
      b.box(-8, y + 1, -5, 8, y + 3, 5, PAL.leather.dark);
      // Ombreira de casca de ente, no ombro esquerdo, com musgo.
      b.box(-12, y + 11, -5, -7, y + 15, 5, bark.base).box(-12, y + 14, -5, -7, y + 15, 5, bark.light);
      b.set(-11, y + 15, -2, "#5c8a38").set(-9, y + 15, 1, "#4d7a30");
    },
    headPaint: (b) => {
      b.box(-6, 11, -6, 6, 14, 6, hair.base).box(-6, 8, 5, 6, 12, 6, hair.base).box(-6, 11, -7, 6, 12, -6, hair.dark);
      b.box(-2, -6, 6, 2, 9, 8, hair.base).box(-1, -9, 7, 1, -6, 8, hair.light).set(0, -5, 8, "#3a2414"); // trança
      b.box(-7, 9, -7, 7, 11, 7, "#3a5a2a"); // faixa na testa
    },
    offhandPaint: (b) => {
      b.box(-1, -22, -1, 1, -8, 0, PAL.wood.base);
      b.box(-4, -27, -3, 4, -21, 2, PAL.darkSteel.base).box(-4, -27, -3, 4, -21, -2, PAL.darkSteel.light);
    },
  });
}
