import { VoxelBuilder } from "../voxel";
import { blob, coatSurface, coatTop, hash3, limb, noise3, pickTone, rng, trimBelow, type Paint, type Vec3 } from "./sculpt";
import { stonePaint } from "./rocks";
import { deadTree } from "./trees";

/**
 * Adereços dos Picos Gelados: pedras azuladas com neve acumulada em cima, aglomerados de cristal de
 * gelo, pináculos de gelo da arena do Gigante, árvores mortas nevadas, as cabanas de toras da vila e a
 * boca da Caverna de Gelo.
 */
const SLATE = ["#4e5664", "#5a6270", "#66707e", "#727c8a", "#808a96"];
const SNOW = ["#e4ebf2", "#eef3f8", "#f6f9fc"];
const ICE = ["#8fcbe8", "#a6d8ee", "#bfe4f4", "#d8f0fa"];

/** Neve no topo: cobre tudo que está exposto para cima, escorrendo um pouco nas bordas. */
function snowCap(b: VoxelBuilder, seed: number, depth = 2): void {
  coatTop(b, (x, y, z, d) => (d === 0 || noise3(x / 3, y / 3, z / 3, seed + 9) > 0.45 ? pickTone(SNOW, hash3(x, y, z, seed)) : null), depth);
}

/** Pedra nevada: ardósia azulada com rachaduras e um chapéu de neve. */
export function snowRock(seed: number, size: Vec3): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, size[1] * 0.45, 0], size, stonePaint(SLATE, seed), { rough: 0.2, grain: 6, seed, floor: 0 });
  snowCap(b, seed, 3);
  return b;
}

/** Cristais de gelo: prismas inclinados que saem de um ponto, com aresta clara e miolo mais fundo. */
export function iceCrystal(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const tilt = i === 0 ? 0 : 0.25 + rand() * 0.45;
    const len = i === 0 ? 30 : 12 + rand() * 14;
    const r = i === 0 ? 3.6 : 2 + rand() * 1.4;
    const dir: Vec3 = [Math.cos(a) * tilt, 1, Math.sin(a) * tilt];
    const base: Vec3 = [Math.cos(a) * (i ? 3 : 0), 0, Math.sin(a) * (i ? 3 : 0)];
    const tip: Vec3 = [base[0] + dir[0] * len, len, base[2] + dir[2] * len];
    const paint: Paint = (x, y, z) => {
      const t = y / len;
      return pickTone(ICE, Math.min(0.999, t * 0.6 + hash3(x, y, z, seed + i) * 0.4));
    };
    limb(b, base, [base[0] + (tip[0] - base[0]) * 0.8, len * 0.8, base[2] + (tip[2] - base[2]) * 0.8], r, r * 0.9, paint);
    limb(b, [base[0] + (tip[0] - base[0]) * 0.8, len * 0.8, base[2] + (tip[2] - base[2]) * 0.8], tip, r * 0.9, 0.5, paint);
  }
  coatSurface(b, (x, y, z) => (hash3(x, y, z, seed + 5) < 0.08 ? "#f4fcff" : null));
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if (Math.hypot(x, z) < 6 && !b.has(x, 0, z)) b.set(x, 0, z, pickTone(SNOW, hash3(x, 0, z, seed)));
  return trimBelow(b);
}

/** Pináculo de gelo: uma lança torta e alta de gelo, com camadas e neve presa nas saliências. */
export function iceSpire(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const h = 62;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = 7 * (1 - t) ** 1.2 + 0.6;
    const ox = Math.sin(t * 3 + seed) * 2.5, oz = Math.cos(t * 2 + seed) * 2;
    for (let x = -9; x <= 9; x++)
      for (let z = -9; z <= 9; z++) {
        const d = Math.hypot(x - ox, z - oz) + noise3(x / 3, y / 4, z / 3, seed) * 2.2;
        if (d > r) continue;
        const band = Math.floor(y / 5) % 2 ? 0.25 : 0;
        b.set(x, y, z, pickTone(ICE, Math.min(0.999, band + hash3(x, y, z, seed) * 0.4 + (d / r) * 0.35)));
      }
  }
  snowCap(b, seed, 1);
  return b;
}

/** Árvore morta nevada: a do pântano, com neve em cima dos galhos e da barba-de-velho. */
export function frozenTree(seed: number, height: number): VoxelBuilder {
  const b = deadTree(seed, height);
  snowCap(b, seed, 1);
  return b;
}

/**
 * Cabana de toras da vila: paredes de troncos deitados com as pontas cruzadas nos cantos, telhado de
 * duas águas coberto de neve, porta na frente (-Z), janela acesa e chaminé de pedra.
 */
export function cabin(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const W = 22, D = 17, H = 18; // meia largura, meia profundidade, altura da parede
  const log: Paint = (x, y, z) => {
    const row = Math.floor(y / 3);
    const ring = y % 3 === 0 ? 0.0 : 0.5;
    return pickTone(["#4a3420", "#5a4028", "#684a30", "#76563a"], Math.min(0.999, ring * 0.5 + hash3(Math.floor(x / 6), row, Math.floor(z / 6), seed) * 0.6));
  };
  for (let y = 0; y < H; y++)
    for (let x = -W; x <= W; x++)
      for (let z = -D; z <= D; z++) {
        const wall = Math.abs(x) >= W - 1 || Math.abs(z) >= D - 1;
        if (wall) b.set(x, y, z, log(x, y, z));
      }
  // Pontas das toras saindo dos cantos, alternadas por fileira.
  for (let y = 0; y < H; y += 3)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const alongX = (y / 3) % 2 === 0;
        for (let k = 1; k <= 2; k++) b.box(alongX ? sx * (W + k) : sx * W, y, alongX ? sz * D : sz * (D + k), (alongX ? sx * (W + k) : sx * W) + 1, y + 2, (alongX ? sz * D : sz * (D + k)) + 1, "#3e2c1a");
      }
  // Porta e janelas.
  for (let y = 0; y < 13; y++) for (let x = -4; x <= 4; x++) b.set(x, y, -D, y === 12 || Math.abs(x) === 4 ? "#3a2614" : "#5a3a20");
  b.set(3, 6, -D - 1, "#c9a23a");
  for (const wx of [-14, 14]) {
    for (let y = 7; y < 12; y++) for (let x = wx - 3; x <= wx + 3; x++) b.set(x, y, -D, Math.abs(x - wx) === 3 || y === 7 || y === 11 || x === wx || y === 9 ? "#3a2614" : "#ffcf7a");
  }
  // Telhado de duas águas (cumeeira ao longo de x), coberto de neve, com beiral.
  for (let k = 0; k <= D + 4; k++) {
    const y = H + Math.floor((D + 4 - k) * 0.75);
    for (let x = -W - 3; x <= W + 3; x++)
      for (const sz of [-1, 1]) {
        const z = sz * k;
        b.set(x, y, z, "#4a3a2a");
        b.set(x, y + 1, z, pickTone(SNOW, hash3(x, y, z, seed)));
        if (k === D + 4 && hash3(x, 0, z, seed + 2) < 0.35) for (let d = 1; d < 3 + Math.floor(hash3(x, 1, z, seed) * 3); d++) b.set(x, y - d, z, "#bfe4f4"); // pingentes
      }
  }
  // Empena (o triângulo das paredes da frente e de trás).
  for (let y = H; y < H + 18; y++) {
    const reach = D + 4 - Math.ceil((y - H) / 0.75);
    for (let z = -reach; z <= reach; z++) if (Math.abs(z) <= D) for (const x of [-W, W]) b.set(x, y, z, log(x, y, z));
  }
  // Chaminé de pedra.
  for (let y = 0; y < H + 22; y++) for (let x = 12; x < 17; x++) for (let z = 6; z < 11; z++) if (y > H + 6 || x === 12 || x === 16 || z === 6 || z === 10) b.set(x, y, z, pickTone(SLATE, hash3(x, y, z, seed)));
  for (let x = 12; x < 17; x++) for (let z = 6; z < 11; z++) b.set(x, H + 22, z, pickTone(SNOW, hash3(x, 0, z, seed)));
  return b;
}

/**
 * Boca da Caverna de Gelo: um morro de ardósia com um arco escuro na frente (-Z), a borda coberta de
 * gelo, pingentes pendurados no arco e neve em cima.
 */
export function caveMouth(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, 14, 10], [44, 32, 26], stonePaint(SLATE, seed), { rough: 0.22, grain: 6, seed, floor: 0 });
  // Arco: escava um túnel até o meio do morro.
  const archR = 15;
  const carve: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    const inArch = Math.hypot(x, Math.max(0, y - 6)) < archR && y >= 0 && z < 18;
    if (inArch) carve.push([x, y, z]);
  });
  for (const [x, y, z] of carve) b.remove(x, y, z);
  // Fundo escuro (sem saída: é a porta da dungeon) e gelo na moldura.
  for (let x = -archR; x <= archR; x++) for (let y = 0; y < archR + 6; y++) if (Math.hypot(x, Math.max(0, y - 6)) < archR) b.set(x, y, 18, y < 3 ? "#1a2230" : "#0c1018");
  coatSurface(b, (x, y, z) => {
    const r = Math.hypot(x, Math.max(0, y - 6));
    if (z < 18 && r >= archR - 0.5 && r < archR + 2.5) return pickTone(ICE, hash3(x, y, z, seed));
    return null;
  });
  // Pingentes no arco.
  for (let x = -archR + 2; x <= archR - 2; x += 2) {
    const top = Math.round(6 + Math.sqrt(Math.max(0, archR * archR - x * x)));
    const len = 2 + Math.floor(hash3(x, 0, 0, seed) * 6);
    for (let d = 0; d < len; d++) b.set(x, top - d, -6 + (x % 3), d === len - 1 ? "#e6f6ff" : "#a6d8ee");
  }
  snowCap(b, seed, 2);
  return b;
}
