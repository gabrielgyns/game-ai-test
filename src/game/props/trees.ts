import { VoxelBuilder } from "../voxel";
import { blob, bough, coatTop, hash3, limb, noise3, pickTone, rng, trimBelow, type Paint, type Vec3 } from "./sculpt";

/**
 * Árvores esculpidas em voxels de 1/12 m: tronco que afina, raízes que abrem no chão, galhos que
 * saem do tronco e copas em tufos na ponta de cada galho. A casca tem veios verticais e as folhas
 * clareiam de baixo (sombra) para cima (sol), com pontos de luz soltos.
 */

const BARK_OAK = ["#3e2a1a", "#4e3522", "#5e412a", "#6e4f33"];
const BARK_BIRCH = ["#e8e4d8", "#f2efe6", "#d8d2c2", "#2e2a26"];
const BARK_PINE = ["#3a2618", "#4a301e", "#5a3c26"];

/** Casca com veios verticais: o ruído é esticado em y. */
function barkPaint(tones: string[], seed: number): Paint {
  return (x, y, z) => pickTone(tones, noise3(x / 1.4, y / 7, z / 1.4, seed) * 0.85 + hash3(x, y, z, seed) * 0.15);
}

/** Folhagem: escura embaixo, clara em cima, em manchas, com alguns pontos de luz. */
function leafPaint(tones: string[], bottom: number, top: number, seed: number): Paint {
  return (x, y, z) => {
    const h = (y - bottom) / Math.max(1, top - bottom);
    const n = noise3(x / 3, y / 3, z / 3, seed);
    if (hash3(x, y, z, seed + 7) < 0.035) return tones[tones.length - 1]!;
    return pickTone(tones.slice(0, -1), Math.max(0, Math.min(0.999, h * 0.75 + (n - 0.5) * 0.7 + 0.12)));
  };
}

/** Raízes: braços curtos que descem do pé do tronco e se abrem no chão. */
function roots(b: VoxelBuilder, count: number, reach: number, r: number, paint: Paint, rand: () => number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.6;
    const len = reach * (0.75 + rand() * 0.5);
    limb(b, [0, 5, 0], [Math.cos(a) * len, 0, Math.sin(a) * len], r, r * 0.35, paint);
  }
}

export interface OakOptions {
  seed: number;
  height: number;
  leaves: string[];
}

/** Carvalho: tronco grosso, 4 a 5 galhos que abrem e uma copa larga em tufos. */
export function oak({ seed, height, leaves }: OakOptions): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const bark = barkPaint(BARK_OAK, seed);
  // Tronco levemente torto, que se abre em galhos grossos a pouco mais de um terço da altura.
  const lean: Vec3 = [(rand() - 0.5) * 6, 0, (rand() - 0.5) * 6];
  const fork = height * 0.4;
  const top: Vec3 = [lean[0], height * 0.72, lean[2]];
  bough(b, [[0, 0, 0], [lean[0] * 0.3, fork * 0.5, lean[2] * 0.3], [lean[0] * 0.7, fork, lean[2] * 0.7], top], 4.6, 2.2, bark);
  roots(b, 5, 8, 3, bark, rand);

  // Galhos que abrem para os lados e tufos de folha separados na ponta de cada um: entre um tufo e
  // outro aparece o galho, como numa árvore de verdade.
  const tufts: { c: Vec3; r: Vec3 }[] = [];
  const count = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.8;
    const y0 = fork + rand() * height * 0.1;
    const reach = height * (0.4 + rand() * 0.1);
    const start: Vec3 = [lean[0] * 0.7, y0, lean[2] * 0.7];
    const mid: Vec3 = [start[0] + Math.cos(a) * reach * 0.5, y0 + height * 0.1, start[2] + Math.sin(a) * reach * 0.5];
    const tip: Vec3 = [start[0] + Math.cos(a) * reach, y0 + height * (0.2 + rand() * 0.08), start[2] + Math.sin(a) * reach];
    bough(b, [start, mid, tip], 2.6, 1.0, bark);
    const s = height * (0.16 + rand() * 0.04);
    tufts.push({ c: [tip[0], tip[1] + s * 0.3, tip[2]], r: [s * 1.2, s * 0.72, s * 1.2] });
    // Galhinho secundário que sai do meio do galho, com um tufo menor.
    const a2 = a + (rand() < 0.5 ? -0.9 : 0.9);
    const twig: Vec3 = [mid[0] + Math.cos(a2) * reach * 0.35, mid[1] + height * 0.14, mid[2] + Math.sin(a2) * reach * 0.35];
    limb(b, mid, twig, 1.5, 0.8, bark);
    tufts.push({ c: twig, r: [s * 0.8, s * 0.6, s * 0.8] });
  }
  const s = height * 0.2;
  tufts.push({ c: [top[0], top[1] + s * 0.5, top[2]], r: [s * 1.1, s * 0.8, s * 1.1] });

  const bottom = Math.min(...tufts.map((t) => t.c[1] - t.r[1]));
  const crownTop = Math.max(...tufts.map((t) => t.c[1] + t.r[1]));
  const paint = leafPaint(leaves, bottom, crownTop, seed);
  tufts.forEach((t, i) => blob(b, t.c, t.r, paint, { rough: 0.22, grain: 5.5, seed: seed + i, under: true }));
  return trimBelow(b);
}

/** Bétula: tronco fino e branco com manchas pretas, copa alta e estreita de folhas claras. */
export function birch(seed: number, height: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const bark: Paint = (x, y, z) => {
    // Faixas pretas horizontais curtas, típicas da bétula.
    if (noise3(x / 2, y / 1.2, z / 2, seed) > 0.78) return BARK_BIRCH[3]!;
    return pickTone(BARK_BIRCH.slice(0, 3), hash3(x, Math.floor(y / 3), z, seed));
  };
  const sway: Vec3 = [(rand() - 0.5) * 5, height * 0.95, (rand() - 0.5) * 5];
  bough(b, [[0, 0, 0], [sway[0] * 0.2, height * 0.45, sway[2] * 0.2], sway], 2.6, 1.2, bark);
  roots(b, 4, 5, 1.6, bark, rand);
  const leaves = ["#5d8f2e", "#6fa236", "#82b440", "#9ccc52", "#c4e070"];
  const tufts: { c: Vec3; r: Vec3 }[] = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.45 + (i / 5) * 0.5;
    const a = i * 2.4 + rand();
    const out = (1 - t) * height * 0.28 + 3;
    const c: Vec3 = [sway[0] * t + Math.cos(a) * out, height * t + 4, sway[2] * t + Math.sin(a) * out];
    limb(b, [sway[0] * t, height * t, sway[2] * t], c, 1.1, 0.7, bark);
    const s = height * (0.16 - t * 0.05) + 3;
    tufts.push({ c, r: [s, s * 0.85, s] });
  }
  const paint = leafPaint(leaves, height * 0.35, height * 1.15, seed);
  tufts.forEach((t, i) => blob(b, t.c, t.r, paint, { rough: 0.24, grain: 4.5, seed: seed + i, under: true }));
  return trimBelow(b);
}

/** Pinheiro: tronco reto e camadas de "saias" de agulhas que diminuem até a ponta, com neve opcional. */
export function pine(seed: number, height: number, snow = false): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const bark = barkPaint(BARK_PINE, seed);
  limb(b, [0, 0, 0], [0, height * 0.9, 0], 3, 1.2, bark);
  roots(b, 4, 6, 2, bark, rand);
  const needles = ["#183c28", "#1f4a32", "#265a3a", "#2e6a42", "#3a7a4c"];
  // Camadas de "saias": cada uma é um cone baixo cuja borda cai e passa por cima da de baixo,
  // deixando uma faixa de sombra entre elas.
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const base = height * (0.2 + t * 0.62);
    const radius = height * (0.36 - t * 0.27) + 3;
    const tall = height * 0.14;
    for (let dy = 0; dy < tall; dy++) {
      const r = radius * (1 - dy / tall) + 1;
      for (let x = Math.floor(-r); x <= Math.ceil(r); x++)
        for (let z = Math.floor(-r); z <= Math.ceil(r); z++) {
          const d = Math.hypot(x + 0.5, z + 0.5);
          const edge = r * (0.86 + noise3(x / 3.5, base / 3.5, z / 3.5, seed + i) * 0.24);
          if (d > edge) continue;
          // A ponta dos galhos cai: a borda desce bem mais que o miolo.
          const droop = d > r * 0.45 ? Math.floor((d - r * 0.45) * 0.5) : 0;
          const yy = Math.round(base + dy - droop);
          // Embaixo de cada saia fica escuro; em cima, claro.
          const shade = Math.max(0, Math.min(0.999, (dy / tall) * 0.8 + (noise3(x / 4, yy / 4, z / 4, seed) - 0.5) * 0.35 + 0.1));
          b.set(x, yy, z, pickTone(needles, shade));
        }
    }
  }
  limb(b, [0, height * 0.9, 0], [0, height + 4, 0], 1.6, 0.5, (x, y, z) => pickTone(needles.slice(2), hash3(x, y, z, seed)));
  if (snow) coatTop(b, (x, y, z) => (y > height * 0.25 && noise3(x / 3, y / 3, z / 3, seed + 9) > 0.35 ? (hash3(x, y, z) < 0.5 ? "#f4f6fa" : "#e2e8f0") : null));
  return trimBelow(b);
}

/** Arbusto: uma bolha baixa de folhas, às vezes com frutinhas vermelhas. */
export function bush(seed: number, berries: boolean): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const leaves = ["#2e5e2a", "#3a7230", "#4a8638", "#5c9a42", "#8cc05a"];
  const paint = leafPaint(leaves, 0, 14, seed);
  for (let i = 0; i < 3; i++) {
    const c: Vec3 = [(rand() - 0.5) * 10, 5 + rand() * 3, (rand() - 0.5) * 10];
    blob(b, c, [8 + rand() * 3, 6 + rand() * 2, 8 + rand() * 3], paint, { rough: 0.25, grain: 4, seed: seed + i, floor: 0 });
  }
  if (berries) coatTop(b, (x, y, z) => (hash3(x, y, z, seed + 3) < 0.05 ? "#c0303a" : null));
  return trimBelow(b);
}

/**
 * Árvore morta do pântano: tronco retorcido e escuro, galhos que se dividem e terminam em pontas
 * secas, com barba-de-velho (musgo cinza-esverdeado) pendurada embaixo dos galhos.
 */
export function deadTree(seed: number, height: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const bark = barkPaint(["#2a221c", "#352a21", "#41342a", "#4d3e31"], seed);
  // Tronco que serpenteia.
  const trunk: Vec3[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    trunk.push([Math.sin(t * 3 + seed) * 3 * t, height * 0.85 * t, Math.cos(t * 2.3 + seed) * 3 * t]);
  }
  bough(b, trunk, 4, 1.8, bark);
  roots(b, 5, 9, 2.4, bark, rand);
  // Galhos recursivos: cada um pode se dividir em dois mais finos.
  const grow = (from: Vec3, dir: Vec3, len: number, r: number, depth: number): void => {
    const bend = (rand() - 0.5) * 0.6;
    const mid: Vec3 = [from[0] + dir[0] * len * 0.5 + bend * len * 0.3, from[1] + dir[1] * len * 0.5, from[2] + dir[2] * len * 0.5 - bend * len * 0.3];
    const to: Vec3 = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
    bough(b, [from, mid, to], r, Math.max(0.6, r * 0.55), bark);
    if (depth === 0 || r < 0.9) return;
    for (const s of [-1, 1]) {
      const a = Math.atan2(dir[2], dir[0]) + s * (0.5 + rand() * 0.4);
      const up = Math.min(0.9, dir[1] + 0.15 + rand() * 0.2);
      const flat = Math.sqrt(1 - up * up);
      grow(to, [Math.cos(a) * flat, up, Math.sin(a) * flat], len * 0.6, r * 0.6, depth - 1);
    }
  };
  const count = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    const t = 0.45 + (i / count) * 0.45;
    const at = trunk[Math.round(t * 4)]!;
    const a = (i / count) * Math.PI * 2 + rand();
    grow(at, [Math.cos(a) * 0.8, 0.45 + rand() * 0.2, Math.sin(a) * 0.8], height * (0.28 + rand() * 0.1), 2, 2);
  }
  grow(trunk[4]!, [0.2, 0.95, 0.1], height * 0.2, 1.7, 1);
  // Barba-de-velho: fios que pendem de alguns pontos dos galhos.
  const mossTones = ["#5a6b4a", "#6b7a56", "#7d8a66"];
  const hangs: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    if (y > height * 0.4 && !b.has(x, y - 1, z) && hash3(x, y, z, seed + 5) < 0.06) hangs.push([x, y, z]);
  });
  for (const [x, y, z] of hangs) {
    const len = 4 + Math.floor(hash3(x, z, y, seed) * 10);
    for (let d = 1; d <= len; d++) if (!b.has(x, y - d, z)) b.set(x, y - d, z, mossTones[(d + x) % 3]!);
  }
  return trimBelow(b);
}
