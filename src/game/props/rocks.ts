import { VoxelBuilder } from "../voxel";
import { blob, coatSurface, coatTop, hash3, noise3, pickTone, rng, type Paint, type Vec3 } from "./sculpt";

/**
 * Pedras esculpidas em voxels de 1/12 m. Pedras da campina e do pântano têm rachaduras, líquen e
 * musgo no topo (que escorre um pouco pelas laterais); as do deserto são de arenito em camadas.
 */

const GRANITE = ["#5f5d58", "#6c6a64", "#7a7871", "#88857d", "#96938a"];
const MOSS = ["#3f6a2a", "#4d7a30", "#5c8a38", "#6e9a42"];

/** Pedra com faces irregulares (ruído grosso) e rachaduras finas mais escuras. */
function stonePaint(tones: string[], seed: number): Paint {
  return (x, y, z) => {
    const crack = Math.abs(noise3(x / 5, y / 5, z / 5, seed + 11) - 0.5);
    if (crack < 0.018) return "#3f3d3a";
    return pickTone(tones, Math.min(0.999, noise3(x / 6, y / 6, z / 6, seed) * 0.8 + hash3(x, y, z, seed) * 0.2));
  };
}

/** Musgo no topo e escorrendo pelas bordas, em manchas; pontinhos de líquen pelo resto. */
function mossAndLichen(b: VoxelBuilder, seed: number, amount: number): void {
  coatTop(b, (x, y, z, depth) => {
    const n = noise3(x / 5, y / 5, z / 5, seed + 3);
    if (n < 1 - amount - depth * 0.12) return null;
    return pickTone(MOSS, Math.min(0.999, (n - (1 - amount)) / amount * 0.7 + hash3(x, y, z, seed) * 0.3));
  }, 3);
  coatSurface(b, (x, y, z) => {
    const h = hash3(x, y, z, seed + 21);
    if (h < 0.012) return "#c8c49a";
    if (h < 0.02) return "#a8b080";
    return null;
  });
}

export interface BoulderOptions {
  seed: number;
  size: Vec3;
  moss: number;
  tones?: string[];
}

/** Pedregulho: uma bolha achatada embaixo, com a borda facetada. */
export function boulder({ seed, size, moss, tones = GRANITE }: BoulderOptions): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, size[1] * 0.45, 0], size, stonePaint(tones, seed), { rough: 0.16, grain: 7, seed, floor: 0 });
  if (moss > 0) mossAndLichen(b, seed, moss);
  return b;
}

/** Grupo de pedras: uma grande e duas ou três menores encostadas. */
export function rockCluster(seed: number, moss: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const paint = stonePaint(GRANITE, seed);
  blob(b, [0, 6, 0], [13, 12, 11], paint, { rough: 0.16, grain: 7, seed, floor: 0 });
  const small = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < small; i++) {
    const a = rand() * Math.PI * 2;
    const r = 6 + rand() * 4;
    blob(b, [Math.cos(a) * 15, r * 0.35, Math.sin(a) * 15], [r, r * 0.8, r * 0.9], paint, { rough: 0.18, grain: 5, seed: seed + i + 1, floor: 0 });
  }
  if (moss > 0) mossAndLichen(b, seed, moss);
  return b;
}

/** Laje: pedra baixa e larga, quase toda coberta de musgo, com uma poça de sombra embaixo. */
export function slab(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, 1, 0], [20, 7, 14], stonePaint(GRANITE, seed), { rough: 0.12, grain: 8, seed, floor: 0 });
  mossAndLichen(b, seed, 0.55);
  return b;
}

const SANDSTONE = ["#b8875a", "#c4955f", "#d0a468", "#dcb478", "#e6c488"];

/** Arenito do deserto: camadas horizontais de tons diferentes, gastas pelo vento. */
export function sandstone(seed: number, size: Vec3): VoxelBuilder {
  const b = new VoxelBuilder();
  const paint: Paint = (x, y, z) => {
    const layer = Math.floor((y + noise3(x / 9, 0, z / 9, seed) * 3) / 3);
    const t = (hash3(layer, 0, 0, seed) * 0.8 + noise3(x / 4, y / 4, z / 4, seed) * 0.2);
    return pickTone(SANDSTONE, Math.min(0.999, t));
  };
  // O vento come mais embaixo: a pedra fica um pouco mais estreita no pé (forma de cogumelo).
  blob(b, [0, size[1] * 0.55, 0], size, paint, { rough: 0.14, grain: 6, seed, floor: 0 });
  // Topo plano, como uma mesa de arenito; a última camada fica mais clara (sol e areia).
  const flat = Math.round(size[1] * 1.15);
  const above: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    if (y >= flat) above.push([x, y, z]);
  });
  for (const [x, y, z] of above) b.remove(x, y, z);
  coatTop(b, (x, y, z) => (y === flat - 1 ? pickTone(["#e6c488", "#ecd098"], hash3(x, y, z, seed)) : null));
  const pinch = Math.round(size[1] * 0.35);
  for (let y = 0; y < pinch; y++) {
    const cut = (1 - y / pinch) * 0.25;
    const rx = size[0] * (1 - cut), rz = size[2] * (1 - cut);
    for (let x = -Math.ceil(size[0] * 1.2); x <= Math.ceil(size[0] * 1.2); x++)
      for (let z = -Math.ceil(size[2] * 1.2); z <= Math.ceil(size[2] * 1.2); z++)
        if ((x / rx) ** 2 + (z / rz) ** 2 > 1) b.remove(x, y, z);
  }
  return b;
}
