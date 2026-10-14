import { VoxelBuilder } from "../voxel";
import { blob, coatSurface, coatTop, hash3, noise3, pickTone, rng } from "./sculpt";
import { stonePaint } from "./rocks";
import { deadTree } from "./trees";
import { cabin, caveMouth } from "./peaks";

/**
 * Adereços das Terras Vulcânicas: colunas de basalto hexagonais, rochas de obsidiana com veios em brasa,
 * árvores carbonizadas, respiros de lava, as casas de pedra do Bastião e a boca da Forja Vulcânica.
 */
const BASALT = ["#2e2a2c", "#363234", "#3e3a3c", "#484446"];
const ASH = ["#5e5856", "#6a6462", "#78726e"];
const EMBER = ["#ff7a1a", "#ffa03a", "#ffc24a"];

/** Colunas de basalto: prismas hexagonais de alturas diferentes, tampas mais claras. */
export function basaltColumns(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const hex = (cx: number, cz: number, r: number, h: number) => {
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) * 0.87 + Math.abs(z) * 0.5 > r || Math.abs(z) > r) continue;
        for (let y = 0; y < h; y++) b.set(cx + x, y, cz + z, y === h - 1 ? "#5a5658" : pickTone(BASALT, hash3(cx + x, Math.floor(y / 4), cz + z, seed)));
      }
  };
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + rand();
    const d = k === 0 ? 0 : 6 + rand() * 6;
    hex(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 4, 10 + Math.floor(rand() * 32));
  }
  return b;
}

/** Rocha de obsidiana: preta e lisa, com veios em brasa e cinza no topo. */
export function obsidianRock(seed: number, size: [number, number, number]): VoxelBuilder {
  const b = new VoxelBuilder();
  const paint = stonePaint(["#141216", "#1c1a1e", "#242226", "#2e2c30"], seed);
  blob(b, [0, size[1] * 0.45, 0], size, (x, y, z) => (Math.abs(noise3(x / 4, y / 4, z / 4, seed + 4) - 0.5) < 0.03 ? pickTone(EMBER, hash3(x, y, z)) : paint(x, y, z)), { rough: 0.25, grain: 5, seed, floor: 0 });
  coatTop(b, (x, y, z) => (noise3(x / 3, y, z / 3, seed + 2) > 0.62 ? pickTone(ASH, hash3(x, y, z, seed)) : null));
  return b;
}

/** Árvore carbonizada: a árvore morta, toda preta, com brasas nas pontas. */
export function charredTree(seed: number, height: number): VoxelBuilder {
  const t = deadTree(seed, height);
  const out = new VoxelBuilder();
  t.forEach((x, y, z) => {
    const ember = hash3(x, y, z, seed) < 0.02;
    out.set(x, y, z, ember ? pickTone(EMBER, hash3(x, y, z)) : pickTone(["#1a1614", "#221c18", "#2a221c"], hash3(x, Math.floor(y / 3), z, seed)));
  });
  return out;
}

/** Respiro de lava: um cone baixo de basalto com a boca em brasa e escorridos acesos. */
export function lavaVent(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let y = 0; y < 14; y++) {
    const r = 11 - y * 0.6;
    for (let x = -12; x <= 12; x++)
      for (let z = -12; z <= 12; z++) {
        const d = Math.hypot(x, z) + noise3(x / 3, y / 3, z / 3, seed) * 1.5;
        if (d > r) continue;
        if (y > 10 && d < 2.5) continue; // boca
        b.set(x, y, z, pickTone(BASALT, hash3(x, y, z, seed)));
      }
  }
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.hypot(x, z) < 2.6) b.set(x, 10, z, pickTone(EMBER, hash3(x, 0, z)));
  coatSurface(b, (x, y, z) => (Math.abs(Math.sin(Math.atan2(z, x) * 3 + seed)) < 0.12 && y > 2 ? pickTone(EMBER, hash3(x, y, z, seed)) : null));
  return b;
}

/** Casa de pedra do Bastião: a cabana dos Picos em blocos de basalto, telhado coberto de cinza. */
export function stoneHut(seed: number): VoxelBuilder {
  return cabin(seed, { wall: ["#4a4446", "#545052", "#5e5a5c", "#686466"], dark: "#2a2224", roof: "#3a2a22", cover: ASH, drip: null, chimney: BASALT });
}

/** Boca da Forja Vulcânica: morro de basalto com a moldura em brasa e o fundo alaranjado. */
export function forgeMouth(seed: number): VoxelBuilder {
  return caveMouth(seed, { rock: BASALT, rim: EMBER, deep: ["#ff7a1a", "#3a1408"], drip: null, cover: ASH });
}
