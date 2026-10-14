import { VoxelBuilder } from "../voxel";

/**
 * Ferramentas de escultura para o cenário em alta resolução. Em vez de empilhar caixas, o cenário é
 * "esculpido" como argila: troncos e galhos são cápsulas que afinam, copas e pedras são bolhas com a
 * borda irregular por ruído, e depois uma demão de tinta (musgo, líquen, neve) cai no que olha para
 * cima. Tudo por seed, então o mesmo modelo sai igual em toda execução.
 */
export type Vec3 = readonly [number, number, number];
/** Cor de cada voxel pintado, a partir da posição (para listras de casca, manchas de folha etc.). */
export type Paint = (x: number, y: number, z: number) => string;

/** Aleatório com seed (mulberry32), em [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valor pseudoaleatório fixo por célula inteira, em [0, 1). */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor 3D suave, em [0, 1). */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const h = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k, seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), sx), x10 = lerp(h(0, 1, 0), h(1, 1, 0), sx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), sx), x11 = lerp(h(0, 1, 1), h(1, 1, 1), sx);
  return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz);
}

/** Escolhe um tom de uma lista com um valor em [0, 1). */
export const pickTone = (tones: readonly string[], t: number): string => tones[Math.min(tones.length - 1, Math.floor(t * tones.length))]!;

/**
 * Tronco ou galho: uma cápsula de `from` até `to` cujo raio vai de `r0` a `r1`. As coordenadas são
 * em voxels e podem ser fracionárias; o voxel entra se o centro dele cai dentro da cápsula.
 */
export function limb(b: VoxelBuilder, from: Vec3, to: Vec3, r0: number, r1: number, paint: Paint): void {
  const r = Math.max(r0, r1);
  const [ax, ay, az] = from;
  const abx = to[0] - ax, aby = to[1] - ay, abz = to[2] - az;
  const len2 = abx * abx + aby * aby + abz * abz || 1;
  for (let x = Math.floor(Math.min(ax, to[0]) - r); x <= Math.ceil(Math.max(ax, to[0]) + r); x++)
    for (let y = Math.floor(Math.min(ay, to[1]) - r); y <= Math.ceil(Math.max(ay, to[1]) + r); y++)
      for (let z = Math.floor(Math.min(az, to[2]) - r); z <= Math.ceil(Math.max(az, to[2]) + r); z++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, pz = z + 0.5 - az;
        const t = Math.max(0, Math.min(1, (px * abx + py * aby + pz * abz) / len2));
        const dx = px - abx * t, dy = py - aby * t, dz = pz - abz * t;
        const rt = r0 + (r1 - r0) * t;
        if (dx * dx + dy * dy + dz * dz <= rt * rt) b.set(x, y, z, paint(x, y, z));
      }
}

/** Galho em vários segmentos que seguem uma curva (pontos de controle), afinando ao longo dela. */
export function bough(b: VoxelBuilder, points: Vec3[], r0: number, r1: number, paint: Paint): void {
  for (let i = 0; i < points.length - 1; i++) {
    const ta = i / (points.length - 1), tb = (i + 1) / (points.length - 1);
    limb(b, points[i]!, points[i + 1]!, r0 + (r1 - r0) * ta, r0 + (r1 - r0) * tb, paint);
  }
}

export interface BlobOptions {
  /** Quanto a borda oscila (0 = elipsoide liso; 0,3 = bem irregular). */
  rough?: number;
  /** Tamanho das ondulações da borda, em voxels. */
  grain?: number;
  seed?: number;
  /** Corta tudo abaixo desta altura (pedras e arbustos apoiados no chão). */
  floor?: number;
  /** Só preenche onde ainda não há voxel (folhas não engolem o galho). */
  under?: boolean;
}

/** Bolha: elipsoide com a borda deformada por ruído. Copas, pedras, arbustos. */
export function blob(b: VoxelBuilder, c: Vec3, r: Vec3, paint: Paint, opts: BlobOptions = {}): void {
  const rough = opts.rough ?? 0.2, grain = opts.grain ?? 4, seed = opts.seed ?? 1;
  const grow = 1 + rough;
  for (let x = Math.floor(c[0] - r[0] * grow); x <= Math.ceil(c[0] + r[0] * grow); x++)
    for (let y = Math.floor(c[1] - r[1] * grow); y <= Math.ceil(c[1] + r[1] * grow); y++) {
      if (opts.floor !== undefined && y < opts.floor) continue;
      for (let z = Math.floor(c[2] - r[2] * grow); z <= Math.ceil(c[2] + r[2] * grow); z++) {
        const nx = (x + 0.5 - c[0]) / r[0], ny = (y + 0.5 - c[1]) / r[1], nz = (z + 0.5 - c[2]) / r[2];
        const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (d > grow) continue;
        const limit = 1 + (noise3(x / grain, y / grain, z / grain, seed) - 0.5) * 2 * rough;
        if (d > limit) continue;
        if (opts.under && b.has(x, y, z)) continue;
        b.set(x, y, z, paint(x, y, z));
      }
    }
}

/**
 * Pinta a "pele de cima": todo voxel sem nada logo acima recebe a cor que `paint` decidir (ou fica
 * como está, se `paint` devolver null). É assim que o musgo cresce no topo das pedras.
 */
export function coatTop(b: VoxelBuilder, paint: (x: number, y: number, z: number, depth: number) => string | null, depth = 1): void {
  const tops: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    if (!b.has(x, y + 1, z)) tops.push([x, y, z]);
  });
  for (const [x, y, z] of tops)
    for (let d = 0; d < depth && b.has(x, y - d, z); d++) {
      const c = paint(x, y - d, z, d);
      if (c) b.set(x, y - d, z, c);
    }
}

/** Repinta voxels da superfície (com algum lado exposto) que `paint` escolher. */
export function coatSurface(b: VoxelBuilder, paint: (x: number, y: number, z: number) => string | null): void {
  const hits: [number, number, number, string][] = [];
  b.forEach((x, y, z) => {
    const exposed = !b.has(x + 1, y, z) || !b.has(x - 1, y, z) || !b.has(x, y + 1, z) || !b.has(x, y - 1, z) || !b.has(x, y, z + 1) || !b.has(x, y, z - 1);
    if (!exposed) return;
    const c = paint(x, y, z);
    if (c) hits.push([x, y, z, c]);
  });
  for (const [x, y, z, c] of hits) b.set(x, y, z, c);
}

/** Corta tudo abaixo de `y` (raízes e troncos que entrariam no chão). */
export function trimBelow(b: VoxelBuilder, y = 0): VoxelBuilder {
  const under: [number, number, number][] = [];
  b.forEach((x, vy, z) => {
    if (vy < y) under.push([x, vy, z]);
  });
  for (const [x, vy, z] of under) b.remove(x, vy, z);
  return b;
}
