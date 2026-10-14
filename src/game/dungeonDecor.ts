import { VoxelBuilder } from "./voxel";
import { blob, bough, hash3, limb, noise3, pickTone, trimBelow, type Paint } from "./props/sculpt";

/**
 * Adereços da cripta, esculpidos em voxels de 1/12 m como o cenário do vale: sarcófagos, barris,
 * pilhas de ossos, velas, estandartes, teias, entulho e urnas. Só enfeitam (não bloqueiam o caminho):
 * ficam encostados nas paredes, onde ninguém precisa passar. Frente para -Z.
 */
export const DECOR_VOXEL = 1 / 12;

export type DecorKind = "coffin" | "barrel" | "bones" | "candles" | "banner" | "cobweb" | "rubble" | "urn" | "spikes" | "shrine" | "brazier";

const stone: (seed: number) => Paint = (seed) => (x, y, z) => pickTone(["#5e5a64", "#6a6670", "#76727c", "#827e88"], Math.min(0.999, noise3(x / 3, y / 3, z / 3, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));

function coffin(): VoxelBuilder {
  const b = new VoxelBuilder();
  const s = stone(3);
  for (let x = -6; x < 6; x++) for (let z = -12; z < 12; z++) for (let y = 0; y < 7; y++) b.set(x, y, z, s(x, y, z));
  // Tampa um pouco maior e mais clara, com uma cruz em relevo e uma rachadura.
  for (let x = -7; x < 7; x++) for (let z = -13; z < 13; z++) b.set(x, 7, z, pickTone(["#8a8690", "#96929c"], hash3(x, 7, z)));
  for (let z = -9; z < 9; z++) b.set(-1, 8, z, "#a8a4ae").set(0, 8, z, "#a8a4ae");
  for (let x = -4; x < 4; x++) b.set(x, 8, -4, "#a8a4ae").set(x, 8, -3, "#a8a4ae");
  for (let z = 4; z < 10; z++) b.set(z % 2 ? 3 : 4, 7, z, "#3a363e");
  return b;
}

function barrel(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let y = 0; y < 14; y++) {
    const r = 4.2 + Math.sin((y / 13) * Math.PI) * 1.1;
    for (let x = -6; x <= 6; x++)
      for (let z = -6; z <= 6; z++) {
        if (Math.hypot(x + 0.5, z + 0.5) > r) continue;
        const band = y === 2 || y === 11;
        b.set(x, y, z, band ? "#4a4a52" : (Math.floor(Math.atan2(z + 0.5, x + 0.5) * 3) & 1) ? "#7a5230" : "#6a4626");
      }
  }
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4) b.set(x, 13, z, "#8a6038");
  return b;
}

function bones(): VoxelBuilder {
  const b = new VoxelBuilder();
  const bone: Paint = (x, y, z) => pickTone(["#cfc4ac", "#ddd2ba", "#e8dfca"], hash3(x, y, z, 7));
  blob(b, [0, 0, 0], [7, 3, 6], bone, { rough: 0.35, grain: 2, seed: 4, floor: 0 });
  // Crânio por cima e alguns ossos longos atravessados.
  blob(b, [1, 4, -1], [2.6, 2.4, 2.6], bone, { rough: 0.05, seed: 2 });
  b.set(0, 4, -4, "#2a2420").set(2, 4, -4, "#2a2420");
  limb(b, [-7, 1, 2], [6, 2, 5], 0.8, 0.8, bone);
  limb(b, [-5, 1, -5], [3, 3, 4], 0.8, 0.8, bone);
  return trimBelow(b);
}

function candles(): VoxelBuilder {
  const b = new VoxelBuilder();
  const wax = ["#e8e0c8", "#f0e8d4", "#ddd4bc"];
  const spots: [number, number, number][] = [[0, 0, 7], [3, 1, 5], [-3, -1, 4], [1, 3, 3], [-2, 2, 6]];
  for (const [x, z, h] of spots) {
    b.box(x, 0, z, x + 2, h, z + 2, wax[(x + z + 9) % 3]!);
    b.set(x, h, z, "#ffd36a").set(x, h + 1, z, "#ffb43a"); // chama
  }
  // Cera escorrida no chão.
  blob(b, [0, 0, 1], [5, 0.6, 4], () => "#e8dcc0", { rough: 0.3, seed: 3, floor: 0 });
  return b;
}

function banner(): VoxelBuilder {
  // Pendurado na parede: ocupa z em [0, 2), voltado para -Z; topo em y = 0 (pendurado para baixo).
  const b = new VoxelBuilder();
  b.box(-8, -1, 0, 8, 0, 2, "#3a2a1a"); // haste
  for (let y = -20; y < -1; y++)
    for (let x = -6; x < 6; x++) {
      const tip = y < -16 && Math.abs(x + 0.5) > (y + 20) * 1.5; // ponta em V
      if (tip) continue;
      const edge = x === -6 || x === 5;
      b.set(x, y, 1, edge ? "#c9a23a" : pickTone(["#6a1a22", "#7a1f2b", "#8a2632"], hash3(x, y, 1, 5)));
    }
  // Emblema: caveira dourada.
  for (const [x, y] of [[-2, -7], [-1, -7], [0, -7], [1, -7], [-2, -8], [1, -8], [-2, -9], [-1, -9], [0, -9], [1, -9], [-1, -10], [0, -10]] as const) b.set(x, y, 0, "#e0b840");
  return b;
}

function cobweb(): VoxelBuilder {
  // Num canto, no alto: fios em leque entre duas paredes (x+ e z+ são as paredes).
  const b = new VoxelBuilder();
  for (let k = 0; k < 5; k++) {
    const a = (k / 4) * (Math.PI / 2);
    for (let r = 0; r < 14; r++) b.set(Math.round(Math.cos(a) * r) - 13, -Math.round(Math.sin(a) * r * 0.4), Math.round(Math.sin(a) * r) - 13, "#d8d4cc");
  }
  for (const r of [5, 9, 13])
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * (Math.PI / 2);
      b.set(Math.round(Math.cos(a) * r) - 13, -Math.round(Math.sin(a) * r * 0.4), Math.round(Math.sin(a) * r) - 13, "#c8c4bc");
    }
  return b;
}

function rubble(): VoxelBuilder {
  const b = new VoxelBuilder();
  const s = stone(9);
  blob(b, [0, 1, 0], [5, 3, 4], s, { rough: 0.3, grain: 2.5, seed: 9, floor: 0 });
  blob(b, [6, 1, 3], [3, 2, 3], s, { rough: 0.3, grain: 2, seed: 5, floor: 0 });
  blob(b, [-5, 0, 4], [2, 1.5, 2], s, { rough: 0.2, grain: 2, seed: 6, floor: 0 });
  // Pedaço de coluna caído.
  limb(b, [-7, 2, -5], [3, 2, -7], 2.2, 2.2, (x, y, z) => pickTone(["#8a8690", "#9a96a0"], hash3(x, y, z)));
  return trimBelow(b);
}

function urn(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let y = 0; y < 13; y++) {
    const r = y < 9 ? 2.5 + Math.sin((y / 9) * Math.PI) * 2.2 : 2 + (y - 9) * 0.4;
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++) {
        const d = Math.hypot(x + 0.5, z + 0.5);
        if (d > r || (y > 10 && d < r - 1)) continue;
        b.set(x, y, z, y === 5 || y === 6 ? "#c9a23a" : pickTone(["#7a4a30", "#8a5638"], hash3(x, y, z)));
      }
  }
  return b;
}

/** Espinhos da armadilha: um tufo de lanças de ferro por célula (sobem do chão). */
function spikes(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let x = -5; x < 6; x += 3)
    for (let z = -5; z < 6; z += 3) {
      const h = 6 + ((x * 7 + z * 13 + 100) % 3);
      b.box(x, 0, z, x + 2, h - 2, z + 2, "#6a6a74").box(x, h - 2, z, x + 2, h - 1, z + 2, "#8a8a94").set(x, h - 1, z, "#c8c8d0");
    }
  return b;
}

/** Santuário: bacia de pedra sobre um pedestal, com um cristal azul que brilha (e apaga depois de usado). */
function shrine(): VoxelBuilder {
  const b = new VoxelBuilder();
  const s = stone(12);
  for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) for (let y = 0; y < 2; y++) b.set(x, y, z, s(x, y, z));
  for (let x = -3; x < 3; x++) for (let z = -3; z < 3; z++) for (let y = 2; y < 9; y++) b.set(x, y, z, s(x, y, z));
  for (let x = -6; x < 6; x++)
    for (let z = -6; z < 6; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d < 6) b.set(x, 9, z, s(x, 9, z));
      if (d < 6 && d >= 4.6) b.set(x, 10, z, s(x, 10, z));
      if (d < 4.6) b.set(x, 10, z, "#2a6aa8"); // água
    }
  for (let y = 11; y < 20; y++) {
    const r = y < 15 ? (y - 10) * 0.7 : (20 - y) * 0.6;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.abs(x + 0.5) + Math.abs(z + 0.5) <= r) b.set(x, y, z, x - z > 0 ? "#9ad8ff" : "#5aa8f0");
  }
  return b;
}

/** Braseiro de ferro com brasas, nos cantos da sala do chefe e da escada. */
function brazier(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]] as const) b.box(x, 0, z, x + 1, 8, z + 1, "#3a3a42");
  for (let x = -5; x < 5; x++) for (let z = -5; z < 5; z++) if (Math.hypot(x + 0.5, z + 0.5) < 5) b.set(x, 8, z, "#4a4a52");
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4) b.set(x, 9, z, hash3(x, 9, z) < 0.5 ? "#ff7a1a" : "#ffb43a");
  bough(b, [[0, 9, 0], [1, 12, 0], [0, 14, 1]], 1.6, 0.4, () => "#ffd36a");
  return b;
}

export const DECOR_BUILDERS: Record<DecorKind, () => VoxelBuilder> = { coffin, barrel, bones, candles, banner, cobweb, rubble, urn, spikes, shrine, brazier };
