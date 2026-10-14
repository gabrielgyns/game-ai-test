import { VoxelBuilder } from "../voxel";
import { blob, bough, coatSurface, coatTop, hash3, limb, noise3, pickTone, rng, trimBelow, type Paint, type Vec3 } from "./sculpt";

/**
 * Adereços da Floresta Ancestral, em voxels de 1/12 m como o resto do cenário: árvores gigantes com
 * raízes expostas, troncos caídos cobertos de musgo, as ruínas élficas de Elar (arcos, estátuas e
 * colunas quebradas) e o acampamento da Guardiã (barraca e fogueira).
 */

const BARK = ["#3a2618", "#4a3220", "#5a3e28", "#6a4a30"];
const LEAVES = ["#173a1e", "#1f4a24", "#28592a", "#326a30", "#3d7c36", "#6aa04a"];
const MOSS = ["#3e5a30", "#4a6a36", "#56763c"];

const barkPaint = (seed: number, mossy = 0): Paint => (x, y, z) => {
  if (mossy > 0 && noise3(x / 3, y / 4, z / 3, seed + 5) > 1 - mossy) return pickTone(MOSS, hash3(x, y, z));
  return pickTone(BARK, noise3(x / 1.4, y / 7, z / 1.4, seed) * 0.85 + hash3(x, y, z, seed) * 0.15);
};

/** Árvore ancestral: tronco largo e retorcido, raízes que serpenteiam pelo chão e uma copa alta e escura. */
export function giantTree(seed: number, height: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const bark = barkPaint(seed, 0.22);
  const top: Vec3 = [(rand() - 0.5) * 8, height * 0.7, (rand() - 0.5) * 8];
  bough(b, [[0, 0, 0], [top[0] * 0.2, height * 0.3, top[2] * 0.2], [top[0] * 0.6, height * 0.55, top[2] * 0.6], top], 9, 4.5, bark);
  // Raízes grossas que saem do pé e entram no chão.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.5;
    const len = 14 + rand() * 8;
    bough(b, [[0, 8, 0], [Math.cos(a) * len * 0.5, 4, Math.sin(a) * len * 0.5], [Math.cos(a) * len, 0, Math.sin(a) * len]], 4.2, 1.2, bark);
  }
  const tufts: { c: Vec3; r: Vec3 }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand();
    const y0 = height * (0.5 + rand() * 0.15);
    const reach = height * (0.32 + rand() * 0.1);
    const start: Vec3 = [top[0] * 0.6, y0, top[2] * 0.6];
    const tip: Vec3 = [start[0] + Math.cos(a) * reach, y0 + height * 0.18, start[2] + Math.sin(a) * reach];
    bough(b, [start, [start[0] + Math.cos(a) * reach * 0.5, y0 + height * 0.06, start[2] + Math.sin(a) * reach * 0.5], tip], 3.4, 1.4, bark);
    const s = height * (0.15 + rand() * 0.04);
    tufts.push({ c: [tip[0], tip[1] + s * 0.25, tip[2]], r: [s * 1.25, s * 0.75, s * 1.25] });
  }
  const s = height * 0.2;
  tufts.push({ c: [top[0], top[1] + s * 0.6, top[2]], r: [s * 1.2, s * 0.85, s * 1.2] });
  const lo = Math.min(...tufts.map((t) => t.c[1] - t.r[1])), hi = Math.max(...tufts.map((t) => t.c[1] + t.r[1]));
  const leaf: Paint = (x, y, z) => {
    if (hash3(x, y, z, seed + 7) < 0.03) return LEAVES[LEAVES.length - 1]!;
    return pickTone(LEAVES.slice(0, -1), Math.max(0, Math.min(0.999, ((y - lo) / (hi - lo)) * 0.75 + (noise3(x / 4, y / 4, z / 4, seed) - 0.5) * 0.6 + 0.1)));
  };
  tufts.forEach((t, i) => blob(b, t.c, t.r, leaf, { rough: 0.22, grain: 5.5, seed: seed + i, under: true }));
  // Cipós pendendo da copa.
  const hangs: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    if (y > height * 0.55 && !b.has(x, y - 1, z) && hash3(x, y, z, seed + 9) < 0.012) hangs.push([x, y, z]);
  });
  for (const [x, y, z] of hangs) for (let d = 1; d < 8 + ((x + z) & 7); d++) if (!b.has(x, y - d, z)) b.set(x, y - d, z, d % 3 ? "#2f5a2a" : "#3a6a30");
  return trimBelow(b);
}

/** Tronco caído e oco, tomado de musgo, com cogumelos na lateral. */
export function fallenLog(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const bark = barkPaint(seed, 0.35);
  limb(b, [-26, 5, 0], [24, 4, 3], 5, 4.2, bark);
  // Oco numa ponta: o miolo escuro e anéis claros.
  for (let y = 0; y < 9; y++) for (let z = -4; z < 8; z++) if (Math.hypot(y + 0.5 - 4.5, z + 0.5 - 1.5) < 3.4) b.set(24, y, z, "#1e140c").set(25, y, z, "#1e140c");
  coatTop(b, (x, y, z) => (noise3(x / 4, y, z / 4, seed) > 0.4 ? pickTone(MOSS, hash3(x, y, z)) : null), 2);
  coatSurface(b, (x, y, z) => (y > 3 && y < 7 && hash3(x, y, z, seed + 3) < 0.01 ? "#d8a060" : null));
  return trimBelow(b);
}

const RUIN = ["#8a8a7e", "#9a9a8e", "#a8a89c", "#b6b6aa"];
const ruinPaint = (seed: number): Paint => (x, y, z) => {
  if (noise3(x / 3, y / 3, z / 3, seed + 2) > 0.7) return pickTone(MOSS, hash3(x, y, z));
  return pickTone(RUIN, Math.min(0.999, noise3(x / 4, y / 4, z / 4, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));
};

/** Arco élfico em ruína: dois pilares finos com volutas e uma ogiva partida, cheia de hera. */
export function elvenArch(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const stone = ruinPaint(seed);
  for (const sx of [-1, 1]) {
    const x0 = sx * 14;
    for (let y = 0; y < 40; y++) for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) b.set(x0 + x, y, z, stone(x0 + x, y, z));
    b.box(x0 - 3, 0, -3, x0 + 3, 2, 3, "#7a7a6e");
  }
  // Ogiva: arco pontudo de um pilar ao outro; o lado direito caiu.
  for (let t = 0; t <= 40; t++) {
    const a = (t / 40) * Math.PI;
    const x = Math.round(-Math.cos(a) * 14), y = Math.round(40 + Math.sin(a) * 14 * (1 - Math.abs(Math.cos(a)) * 0.2));
    if (x > 4) continue; // parte caída
    for (let dz = -2; dz < 2; dz++) b.set(x, y, dz, stone(x, y, dz)).set(x, y + 1, dz, stone(x, y + 1, dz));
  }
  // Pedaços no chão e hera descendo.
  blob(b, [10, 1, 6], [4, 2, 3], stone, { rough: 0.3, seed: seed + 4, floor: 0 });
  coatSurface(b, (x, y, z) => (y > 8 && noise3(x / 2, y / 3, z / 2, seed + 8) > 0.66 ? "#2f6a2a" : null));
  return b;
}

/** Estátua élfica: arqueira de pedra em pé sobre um pedestal, com o braço do arco quebrado. */
export function elvenStatue(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const stone = ruinPaint(seed);
  b.box(-7, 0, -7, 7, 4, 7, "#7a7a6e").box(-6, 4, -6, 6, 6, 6, "#8a8a7e");
  limb(b, [0, 6, 0], [0, 26, 0], 4.5, 3.2, stone); // corpo com túnica
  blob(b, [0, 30, 0], [3, 3.5, 3], stone, { rough: 0.05, seed });
  limb(b, [0, 31, 1], [0, 26, 4], 2.5, 1, stone); // cabelo trançado
  limb(b, [-3, 24, 0], [-8, 18, -3], 1.4, 1.2, stone); // braço esquerdo
  limb(b, [3, 24, 0], [6, 22, -4], 1.4, 1.2, stone); // braço do arco (quebrado)
  bough(b, [[-9, 30, -4], [-11, 20, -5], [-9, 10, -4]], 0.9, 0.9, stone); // arco
  coatSurface(b, (x, y, z) => (y < 14 && noise3(x / 2, y / 2, z / 2, seed + 6) > 0.62 ? pickTone(MOSS, hash3(x, y, z)) : null));
  return b;
}

/** Coluna élfica quebrada, deitada em pedaços. */
export function brokenColumn(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const stone = ruinPaint(seed);
  b.box(-5, 0, -5, 5, 3, 5, "#7a7a6e");
  limb(b, [0, 3, 0], [0, 18, 0], 3.6, 3.6, stone);
  limb(b, [5, 3, 4], [24, 3, 10], 3.4, 3.4, stone);
  blob(b, [-6, 1, 7], [3, 2, 3], stone, { rough: 0.3, seed: seed + 2, floor: 0 });
  return trimBelow(b);
}

/** Barraca de lona no acampamento, com estacas e cordas. */
export function tent(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const canvas: Paint = (x, y, z) => pickTone(["#8a7a5a", "#9a8a68", "#a89878"], hash3(x, Math.floor(y / 2), z, seed));
  for (let y = 0; y < 20; y++) {
    const half = Math.round(16 - y * 0.8);
    for (let x = -half; x <= half; x++) if (Math.abs(x) >= half - 1) for (let z = -14; z < 14; z++) b.set(x, y, z, canvas(x, y, z));
  }
  for (let z = -14; z < 14; z++) b.set(0, 20, z, "#5a4430");
  // Entrada aberta na frente (-Z) e estacas.
  for (let y = 0; y < 10; y++) for (let x = -4; x < 4; x++) b.remove(x, y, -14);
  for (const z of [-15, 14]) b.box(0, 0, z, 1, 22, z + 1, "#5a3a20");
  return b;
}

/** Fogueira: pedras em roda, lenha cruzada e brasas que brilham. */
export function campfire(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    blob(b, [Math.cos(a) * 7, 1, Math.sin(a) * 7], [2, 1.6, 2], () => pickTone(["#6a6660", "#7a766e"], hash3(k, 1, seed)), { rough: 0.1, seed: k, floor: 0 });
  }
  limb(b, [-5, 1, -2], [5, 3, 2], 1.2, 1.2, () => "#4a3220");
  limb(b, [-4, 3, 3], [4, 1, -3], 1.2, 1.2, () => "#5a3e28");
  for (let x = -3; x < 3; x++) for (let z = -3; z < 3; z++) b.set(x, 0, z, hash3(x, 0, z, seed) < 0.5 ? "#ff7a1a" : "#ffb43a");
  for (const [x, z, h] of [[0, 0, 6], [1, -1, 4], [-1, 1, 5]] as const) for (let y = 1; y < h; y++) b.set(x, y, z, y > h - 2 ? "#ffe08a" : "#ffb43a");
  return b;
}
