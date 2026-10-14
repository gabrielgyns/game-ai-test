import * as THREE from "three";
import { VoxelBuilder } from "../voxel";
import { PAL, V, mesh, pivot, shades, tone, type CharacterModel } from "./common";
import { buildHumanoid } from "./humanoid";

/* ---------- Goblin: magro, orelhudo, porrete ---------- */

export function createGoblin(): CharacterModel {
  const skin = shades("#7bb04a", 0.1);
  const rag = shades("#5a3d2b", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 1, hd: 1, length: 8 },
    arms: { hw: 1, hd: 1, length: 11 },
    head: { hw: 5, h: 10, hd: 5 },
    torso: { hw: 5, h: 11, hd: 3 },
    legX: 3,
    armX: 7,
    pants: skin,
    boots: shades("#3a2a1a", 0.1),
    bootH: 2,
    sleeve: rag,
    sleeveLen: 3,
    face: { eye: "#f2d33c", mouth: "fangs", brow: tone(skin.dark, -0.2) },
    mouthY: 2,
    torsoPaint: (b, y) => {
      b.box(-5, y + 2, -4, 5, y + 3, 4, PAL.leather.dark); // corda na cintura
      b.box(-1, y + 2, -4, 1, y + 3, -3, PAL.leather.light);
      b.carve(-5, y + 9, -4, -3, y + 11, 4).carve(3, y + 9, -4, 5, y + 11, 4); // trapo sem mangas
      b.box(-5, y + 9, -3, -3, y + 11, 3, skin.base).box(3, y + 9, -3, 5, y + 11, 3, skin.base);
      b.set(2, y + 5, -4, rag.light).set(-3, y + 7, -4, rag.light).set(0, y + 4, 3, rag.light); // remendos
    },
    headPaint: (b) => {
      // Orelhas longas e pontudas, nariz comprido.
      for (const s of [-1, 1]) {
        b.box(s > 0 ? 5 : -9, 5, -1, s > 0 ? 9 : -5, 7, 1, skin.base);
        b.box(s > 0 ? 8 : -11, 6, -1, s > 0 ? 11 : -8, 8, 0, skin.base);
        b.set(s > 0 ? 10 : -11, 8, -1, skin.dark);
      }
      b.box(-1, 3, -7, 1, 5, -5, skin.base).set(0, 3, -8, skin.dark); // nariz
      b.box(-2, 10, -5, 2, 12, 2, "#3a2a1a"); // topete de cabelo sujo
    },
    weaponPaint: (b) => {
      const wood = PAL.wood;
      b.box(-1, -20, -1, 1, -8, 0, wood.base).box(-1, -20, -1, 0, -8, 0, wood.dark);
      b.box(-3, -24, -3, 3, -18, 2, wood.base); // cabeça do porrete
      b.box(-3, -24, -3, 3, -18, -2, wood.dark);
      b.set(-3, -21, -1, PAL.darkSteel.base).set(3, -22, 0, PAL.darkSteel.base).set(0, -25, -1, PAL.darkSteel.base); // pregos
    },
  });
}

/* ---------- Orc: brutamontes blindado, olhos vermelhos, presas ---------- */

export function createOrc(): CharacterModel {
  const skin = shades("#4f7a3a", 0.1);
  const armor = shades("#3c3c45", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 14 },
    arms: { hw: 3, hd: 3, length: 17 },
    head: { hw: 7, h: 13, hd: 7 },
    torso: { hw: 11, h: 20, hd: 6 },
    legX: 5,
    armX: 14,
    pants: shades("#2e2a26", 0.08),
    boots: shades("#1e1b19", 0.1),
    bootH: 4,
    sleeve: armor,
    sleeveLen: 5,
    face: { eye: "#ff4040", mouth: "fangs", brow: "#2a3a20" },
    mouthY: 3,
    neck: 1,
    torsoPaint: (b, y) => {
      b.box(-11, y + 2, -7, 11, y + 5, 7, "#2a2a30"); // cinto largo
      b.box(-2, y + 2, -7, 2, y + 5, -6, PAL.teeth); // crânio na fivela
      b.set(-1, y + 3, -7, PAL.pupil).set(1, y + 3, -7, PAL.pupil);
      b.box(-11, y + 10, -7, 11, y + 13, -6, armor.light); // placa peitoral
      b.box(-1, y + 6, -7, 1, y + 19, -6, armor.dark); // vinco
      // Espetos nos ombros.
      for (const s of [-1, 1]) {
        b.box(s * 11 - (s > 0 ? 0 : 4), y + 17, -5, s * 11 + (s > 0 ? 4 : 0), y + 21, 5, armor.base);
        b.box(s * 13 - (s > 0 ? 0 : 1), y + 21, -1, s * 13 + (s > 0 ? 1 : 0), y + 25, 1, PAL.darkSteel.light);
      }
      b.box(-4, y + 6, 6, 4, y + 16, 7, PAL.leather.dark); // alça nas costas
    },
    headPaint: (b) => {
      b.box(-8, 11, -8, 8, 15, 8, "#3c3c45"); // elmo
      b.box(-8, 14, -8, 8, 15, 8, "#4a4a55");
      b.box(-1, 6, -9, 1, 14, -8, "#2a2a30"); // protetor nasal
      b.box(-3, 0, -9, -1, 4, -7, PAL.teeth).box(1, 0, -9, 3, 4, -7, PAL.teeth); // presas grandes
      b.box(-10, 15, -2, -8, 20, 0, "#d9d2c0").box(8, 15, -2, 10, 20, 0, "#d9d2c0"); // chifres
    },
    weaponPaint: (b) => {
      b.box(-1, -34, -1, 1, -14, 0, PAL.wood.dark); // cabo longo
      b.box(-2, -33, -14, 2, -21, 0, PAL.steel.base); // lâmina larga
      b.box(-2, -32, -16, 2, -22, -14, PAL.steel.light);
      b.box(-2, -29, -12, 2, -27, -4, "#7a1f2b"); // sangue seco
      b.box(-2, -34, -1, 2, -20, 2, PAL.darkSteel.base);
    },
  });
}

/* ---------- Salteador: lenço no rosto, turbante, cimitarra ---------- */

export function createBandit(): CharacterModel {
  const skin = shades("#d9a070", 0.09);
  const cloth = shades("#7a3b2a", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: shades("#4a3a2a", 0.08),
    boots: shades("#2b2320", 0.1),
    bootH: 3,
    sleeve: cloth,
    sleeveLen: 5,
    face: { mouth: "flat", brow: "#2a1a10" },
    mouthY: 3,
    torsoPaint: (b, y) => {
      b.box(-7, y + 2, -5, 7, y + 4, 5, PAL.gold.base); // faixa dourada
      b.box(-6, y + 1, -5, 6, y + 2, 5, "#2b2b2b");
      for (let i = 0; i < 12; i++) b.set(6 - i, y + 3 + i, -5, "#2b2b2b"); // bandoleira
      b.box(-3, y + 6, -5, -1, y + 9, -4, PAL.steel.base); // adaga presa no peito
    },
    headPaint: (b) => {
      const scarf = shades("#2b2b2b", 0.1);
      b.box(-6, 1, -7, 6, 6, 7, scarf.base).box(-6, 5, -7, 6, 6, 7, scarf.light); // lenço cobrindo a boca
      b.box(-7, 10, -7, 7, 14, 7, "#e0c47f").box(-7, 13, -7, 7, 14, 7, "#ecd59a"); // turbante
      b.box(-2, 11, -8, 2, 13, -7, "#b8322f").set(0, 12, -9, PAL.gold.base); // broche
      b.box(5, 8, 5, 8, 12, 8, "#e0c47f"); // pano caído atrás
    },
    weaponPaint: (b) => {
      b.box(-1, -13, -1, 1, -8, 0, PAL.leather.base);
      b.box(-3, -14, -1, 3, -13, 0, PAL.gold.base);
      b.box(-1, -24, -1, 1, -14, 0, PAL.steel.base).box(-1, -24, -1, 0, -14, 0, PAL.steel.light);
      b.box(-3, -26, -1, 1, -22, 0, PAL.steel.base).box(-4, -27, -1, -2, -24, 0, PAL.steel.light); // curva da cimitarra
    },
  });
}

/* ---------- Zumbi do lodo: pele esverdeada, trapos, braço esticado ---------- */

export function createBogZombie(): CharacterModel {
  const skin = shades("#5e7a4a", 0.1);
  const rags = shades("#3a4a2a", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: 2, hd: 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: 7, h: 14, hd: 4 },
    legX: 3,
    armX: 9,
    pants: rags,
    boots: shades("#2c3320", 0.1),
    bootH: 1,
    sleeve: rags,
    sleeveLen: 4,
    face: { eye: "#c8ff5a", mouth: "grin", brow: "#2f3a22" },
    mouthY: 3,
    rightArmForward: true,
    torsoPaint: (b, y) => {
      b.carve(-7, y + 8, -5, -4, y + 11, 5).box(-7, y + 8, -4, -4, y + 11, 4, skin.base); // buraco no trapo
      b.set(2, y + 5, -5, rags.light).set(4, y + 10, -5, rags.light);
      b.box(-2, y + 3, -5, 1, y + 5, -4, "#2a3320"); // mancha de lodo
      b.box(-5, y + 11, 4, -2, y + 13, 5, "#4a6b3a"); // musgo nas costas
      b.sphere(5, y + 1, -2, 2, 1, 2, "#6b8a3a"); // cogumelo na cintura
    },
    headPaint: (b) => {
      b.box(-6, 10, -6, 6, 12, 6, "#2f3a22").box(-6, 8, 4, 6, 10, 6, "#2f3a22"); // cabelo ralo
      b.carve(-3, 10, -6, 0, 12, -4); // falha no couro cabeludo
      b.box(-2, 9, -7, 0, 11, -6, "#8ab06a"); // mancha de mofo
      b.box(4, 4, -7, 6, 6, -6, "#3a4a2a"); // ferida
    },
  });
}

/* ---------- Gosma: bolha translúcida com brilho e cara simpática ---------- */

export function createSlime(): CharacterModel {
  const body = shades("#5fd36b", 0.12);
  const b = new VoxelBuilder();
  // Corpo: elipsoide achatado com base mais larga e topo arredondado.
  b.sphere(0, 6, 0, 10, 7, 10, body.base);
  b.carve(-12, -4, -12, 12, 0, 12); // corta tudo abaixo do chão
  b.box(-10, 0, -10, 10, 1, 10, body.dark); // base úmida (recortada pela esfera acima)
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) if (!b.has(x, 1, z)) b.remove(x, 0, z);
  b.sphere(-4, 10, -4, 3, 2, 3, body.light); // reflexo
  b.set(-5, 12, -5, "#d7ffdc");
  b.sphere(5, 5, 5, 2, 2, 2, body.dark); // bolha interna escura
  b.sphere(-6, 3, 4, 1.5, 1.5, 1.5, body.dark);
  // Olhos grandes e boca pintados na superfície da bolha, com pupila saliente.
  for (const s of [-1, 1]) {
    for (let x = -2; x < 2; x++) for (let y = 5; y < 10; y++) b.recolorFront(s * 4 + x, y, PAL.eyeWhite, 2);
    for (let x = -1; x < 1; x++) for (let y = 5; y < 8; y++) b.recolorFront(s * 4 + x + (s > 0 ? 0 : 1), y, PAL.pupil, 2);
    b.recolorFront(s * 4 + (s > 0 ? -1 : 1), 7, "#ffffff", 2);
  }
  const mouth = tone(body.dark, -0.15);
  for (let x = -3; x < 3; x++) b.recolorFront(x, 3, mouth, 2);
  b.recolorFront(-4, 4, mouth, 2).recolorFront(3, 4, mouth, 2);
  const root = new THREE.Group();
  root.add(mesh(b));
  return { root, height: 13 * V + 0.15 };
}

/* ---------- Aranha: corpo baixo, oito patas, olhos vermelhos; `queen` para a rainha ---------- */

export function createSpider(queen = false): CharacterModel {
  const k = queen ? 2.2 : 1;
  const s = (n: number) => Math.round(n * k);
  const body = shades(queen ? "#2b1b2e" : "#2a2a2a", 0.12);
  const accent = shades(queen ? "#8f2f6b" : "#5a3a1a", 0.1);
  const b = new VoxelBuilder();
  b.sphere(0, s(6), s(4), s(6), s(5), s(7), body.base); // abdômen
  b.sphere(0, s(7), s(5), s(4), s(3), s(5), body.light); // topo iluminado
  b.sphere(0, s(6), s(4), s(6), s(5), s(7), body.base);
  b.carve(-s(6) - 1, 0, -s(12), s(6) + 1, s(2), s(12)); // nada abaixo da linha das patas
  b.sphere(0, s(5), -s(5), s(4), s(3), s(4), body.base); // cefalotórax
  // Marca no abdômen: ampulheta/caveira para a rainha, listra para as comuns.
  if (queen) {
    b.stampXY(["..aaaa..", ".aaaaaa.", "..aaaa..", "...aa...", "..aaaa..", ".aaaaaa."], { a: accent.base }, -4, s(6), s(11), s(11) + 1);
    b.box(-s(3), s(7), s(4), s(3), s(8), s(8), accent.dark);
  } else {
    b.box(-1, s(9), s(1), 1, s(10), s(8), accent.base);
    b.box(-2, s(8), s(3), 2, s(9), s(5), accent.base);
  }
  // Olhos pintados na frente do cefalotórax: um par grande e dois pares pequenos.
  for (const sx of [-1, 1]) {
    for (let dy = 0; dy < s(2); dy++) for (let dx = 0; dx < s(1) + 1; dx++) b.recolorFront(sx * (s(1) + dx) - (sx < 0 ? 1 : 0), s(5) + dy, "#ff3030");
    b.recolorFront(sx * s(3) - (sx < 0 ? 1 : 0), s(6), "#ff3030").recolorFront(sx * s(3) - (sx < 0 ? 1 : 0), s(7) + 1, "#b01010");
  }
  b.box(-1, s(3), -s(10), 1, s(5), -s(8), body.dark); // quelíceras
  b.set(-2, s(3), -s(10), PAL.teeth).set(1, s(3), -s(10), PAL.teeth);
  // Patas em arco: sobem do corpo, dobram no "joelho" e descem até o chão.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -s(6) + i * s(3);
      const reach = s(8) + (i === 0 || i === 3 ? s(2) : 0);
      b.box(sx * s(3), s(5), z, sx * (s(3) + reach / 2), s(6) + s(2), z + s(1), body.base); // fêmur subindo
      b.box(sx * (s(3) + reach / 2), s(6) + s(2), z, sx * (s(3) + reach), s(6) + s(3), z + s(1), body.light); // joelho
      b.box(sx * (s(3) + reach), 0, z, sx * (s(3) + reach) + sx, s(6) + s(3), z + s(1), body.dark); // tíbia descendo
      b.set(sx * (s(3) + reach) + (sx > 0 ? 0 : -1), 0, z, accent.dark); // ponta da pata
    }
  }
  if (queen) {
    const gold = PAL.gold;
    b.box(-4, s(8), -s(7), 4, s(8) + 2, -s(3), gold.base); // coroa
    for (const x of [-4, -1, 2]) b.box(x, s(8) + 2, -s(7), x + 1, s(8) + 4, -s(6), gold.light);
    b.set(0, s(8) + 2, -s(7), "#e5484d");
  }
  const root = new THREE.Group();
  root.add(mesh(b));
  return { root, height: (s(6) + s(5)) * V + (queen ? 0.5 : 0.25) };
}

/* ---------- Escorpião: carapaça segmentada, pinças e cauda com ferrão ---------- */

export function createScorpion(): CharacterModel {
  const shell = shades("#b8783a", 0.12);
  const dark = shades("#8a5428", 0.1);
  const b = new VoxelBuilder();
  // Corpo em segmentos: cada placa um pouco mais estreita, com sulco escuro entre elas.
  for (let i = 0; i < 4; i++) {
    const z0 = -6 + i * 3;
    const w = 6 - (i === 3 ? 1 : 0);
    b.box(-w, 2, z0, w, 7 - (i === 0 ? 1 : 0), z0 + 3, shell.base);
    b.box(-w, 6 - (i === 0 ? 1 : 0), z0, w, 7 - (i === 0 ? 1 : 0), z0 + 1, shell.light);
    b.box(-w, 2, z0 + 2, w, 7, z0 + 3, shell.dark);
  }
  b.box(-4, 1, -7, 4, 5, -6, dark.base); // cabeça baixa
  b.set(-2, 4, -8, PAL.pupil).set(1, 4, -8, PAL.pupil).set(-3, 4, -8, PAL.pupil).set(2, 4, -8, PAL.pupil);
  // Patas: três pares, com junta levantada.
  for (const sx of [-1, 1]) {
    for (const z of [-4, 0, 4]) {
      b.box(sx * 6, 4, z, sx * 9, 5, z + 1, dark.base);
      b.box(sx * 9, 0, z, sx * 10, 5, z + 1, dark.dark);
      b.box(sx * 9, 0, z - 1, sx * 11, 1, z + 1, dark.dark);
    }
    // Pinças: braço para a frente e garra aberta.
    b.box(sx * 5, 3, -9, sx * 8, 5, -5, shell.base);
    b.box(sx * 7, 3, -13, sx * 11, 6, -9, shell.base);
    b.box(sx * 7, 4, -16, sx * 9, 6, -13, shell.dark); // dedo fixo
    b.box(sx * 9, 2, -15, sx * 11, 4, -13, shell.dark); // dedo móvel
  }
  const root = new THREE.Group();
  root.add(mesh(b));
  // Cauda com ferrão, levantada no aviso.
  const tail = new VoxelBuilder();
  // Segmentos sobem e curvam para a frente, por cima do corpo, como um ponto de interrogação.
  const seg: [number, number][] = [[0, 0], [3, 1], [6, 1], [9, 0], [12, -2], [14, -5]];
  for (const [y, z] of seg) {
    tail.box(-2, y, z, 2, y + 3, z + 3, shell.base).box(-2, y + 2, z, 2, y + 3, z + 3, shell.light).box(-2, y, z, 2, y + 1, z + 3, shell.dark);
  }
  tail.box(-3, 14, -9, 3, 19, -5, shell.base).box(-3, 18, -9, 3, 19, -5, shell.light); // bulbo
  tail.box(-1, 11, -11, 1, 15, -8, PAL.pupil).box(-1, 9, -12, 1, 11, -10, PAL.pupil); // ferrão apontando para baixo e para a frente
  const weaponArm = pivot(0, 5, 5, mesh(tail));
  root.add(weaponArm);
  return { root, weaponArm, height: 22 * V + 0.2 };
}
