import { VoxelBuilder } from "./voxel";
import { blob, bough, hash3, limb, noise3, pickTone, trimBelow, type Paint } from "./props/sculpt";

/**
 * Adereços da cripta, esculpidos em voxels de 1/12 m como o cenário do vale: sarcófagos, barris,
 * pilhas de ossos, velas, estandartes, teias, entulho e urnas. Só enfeitam (não bloqueiam o caminho):
 * ficam encostados nas paredes, onde ninguém precisa passar. Frente para -Z.
 */
export const DECOR_VOXEL = 1 / 12;

export type DecorKind =
  | "coffin" | "barrel" | "bones" | "candles" | "banner" | "cobweb" | "rubble" | "urn" | "spikes" | "shrine" | "brazier"
  // Caverna de Gelo.
  | "iceCluster" | "snowdrift" | "icicles" | "iceLamp" | "frozenBones" | "iceSpikes" | "iceBrazier"
  // Santuário Élfico.
  | "vines" | "glowShrooms" | "elvenBanner" | "moonBrazier" | "thornSpikes" | "planter"
  // Forja Vulcânica.
  | "anvil" | "chains" | "forgeBanner" | "crucible" | "coalPile" | "fireVent";

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


const ICE = ["#8fcbe8", "#a6d8ee", "#bfe4f4", "#d8f0fa"];
const SNOW = ["#dfe9f2", "#eaf2f8", "#f4f9fc"];

/** Aglomerado de cristais de gelo encostado na parede. */
function iceCluster(): VoxelBuilder {
  const b = new VoxelBuilder();
  const paint: Paint = (x, y, z) => pickTone(ICE, Math.min(0.999, y / 22 * 0.5 + hash3(x, y, z, 3) * 0.5));
  for (const [x, z, h, lean] of [[0, 2, 22, 0], [-4, 0, 14, -0.3], [4, 1, 16, 0.35], [1, -3, 10, 0.2], [-2, 4, 12, -0.15]] as const) {
    limb(b, [x, 0, z], [x + lean * h, h * 0.8, z + 1], 2.2, 1.6, paint);
    limb(b, [x + lean * h, h * 0.8, z + 1], [x + lean * h * 1.2, h, z + 1], 1.6, 0.4, paint);
  }
  blob(b, [0, 0, 1], [6, 1, 5], (x, y, z) => pickTone(SNOW, hash3(x, y, z)), { rough: 0.3, seed: 2, floor: 0 });
  return b;
}

/** Monte de neve que entrou pelas frestas. */
function snowdrift(): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, 0, 2], [8, 3.5, 6], (x, y, z) => pickTone(SNOW, Math.min(0.999, noise3(x / 3, y, z / 3, 4) * 0.6 + hash3(x, y, z) * 0.4)), { rough: 0.2, grain: 3, seed: 6, floor: 0 });
  blob(b, [5, 0, -2], [4, 2, 4], (x, y, z) => pickTone(SNOW, hash3(x, y, z, 2)), { rough: 0.2, seed: 7, floor: 0 });
  return trimBelow(b);
}

/** Pingentes num canto do teto (como as teias da cripta: x+ e z+ são as paredes). */
function icicles(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let k = 0; k < 16; k++) {
    const x = -2 - Math.floor(hash3(k, 0, 0, 3) * 12), z = -2 - Math.floor(hash3(k, 1, 0, 3) * 12);
    if (x + z < -18) continue;
    const len = 4 + Math.floor(hash3(k, 2, 0, 3) * 12);
    for (let d = 0; d < len; d++) b.set(x, -d, z, d === len - 1 ? "#f4fcff" : pickTone(ICE, d / len));
  }
  return b;
}

/** Lamparina de cristal: pedra baixa com um cristal azul que brilha no lugar das velas. */
function iceLamp(): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, 1, 0], [4, 2, 4], stone(5), { rough: 0.2, seed: 5, floor: 0 });
  for (let y = 3; y < 11; y++) {
    const r = y < 7 ? (y - 2) * 0.6 : (11 - y) * 0.6;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) + Math.abs(z) <= r) b.set(x, y, z, x + z > 0 ? "#bfeeff" : "#5ad0ff");
  }
  return b;
}

/** Ossada presa no gelo: os ossos da cripta com uma crosta azul por cima. */
function frozenBones(): VoxelBuilder {
  const b = bones();
  const tops: [number, number, number][] = [];
  b.forEach((x, y, z) => {
    if (!b.has(x, y + 1, z) && hash3(x, y, z, 8) < 0.5) tops.push([x, y, z]);
  });
  for (const [x, y, z] of tops) b.set(x, y + 1, z, pickTone(ICE, hash3(x, y, z)));
  return b;
}

/** Espinhos de gelo da armadilha. */
function iceSpikes(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let x = -5; x < 6; x += 3)
    for (let z = -5; z < 6; z += 3) {
      const h = 6 + ((x * 7 + z * 13 + 100) % 3);
      b.box(x, 0, z, x + 2, h - 2, z + 2, "#8fcbe8").box(x, h - 2, z, x + 2, h - 1, z + 2, "#bfe4f4").set(x, h - 1, z, "#f4fcff");
    }
  return b;
}

/** Braseiro de chama fria: bacia de ferro com fogo azul. */
function iceBrazier(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]] as const) b.box(x, 0, z, x + 1, 8, z + 1, "#3a4252");
  for (let x = -5; x < 5; x++) for (let z = -5; z < 5; z++) if (Math.hypot(x + 0.5, z + 0.5) < 5) b.set(x, 8, z, "#4a5262");
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4) b.set(x, 9, z, hash3(x, 9, z) < 0.5 ? "#3a9ae8" : "#7ad0ff");
  bough(b, [[0, 9, 0], [1, 12, 0], [0, 14, 1]], 1.6, 0.4, () => "#cfefff");
  return b;
}

const LEAF = ["#2f5a2c", "#3d6e34", "#4d823c", "#5e9646"];

/** Trepadeiras num canto do teto, caindo pelas paredes (x+ e z+ são as paredes). */
function vines(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let k = 0; k < 14; k++) {
    const x = -1 - Math.floor(hash3(k, 0, 0, 5) * 12), z = -1 - Math.floor(hash3(k, 1, 0, 5) * 12);
    if (x > -2 === z > -2) continue; // só rente a uma das paredes
    const len = 8 + Math.floor(hash3(k, 2, 0, 5) * 18);
    for (let d = 0; d < len; d++) b.set(x + (d % 5 === 2 ? 1 : 0), -d, z, pickTone(LEAF, hash3(k, d, 0)));
    if (hash3(k, 3, 0, 5) < 0.4) b.set(x, -len, z, "#e8d8ff"); // florzinha
  }
  return b;
}

/** Cogumelos que brilham em verde-azulado: a luz das salas do santuário. */
function glowShrooms(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (const [x, z, h, r] of [[0, 0, 7, 3], [4, 2, 4, 2], [-3, 3, 5, 2], [2, -3, 3, 1.6]] as const) {
    b.box(x, 0, z, x + 1, h, z + 1, "#d8e8d0");
    for (let dx = -Math.ceil(r); dx <= r; dx++) for (let dz = -Math.ceil(r); dz <= r; dz++) if (Math.hypot(dx, dz) <= r) b.set(x + dx, h, z + dz, Math.hypot(dx, dz) < r - 0.8 ? "#9affd8" : "#3ad8b0");
  }
  blob(b, [0, 0, 1], [5, 0.6, 4], (x, y, z) => pickTone(["#2f5a2c", "#3d6e34"], hash3(x, y, z)), { rough: 0.3, seed: 3, floor: 0 });
  return b;
}

/** Estandarte élfico: pano verde com folha dourada, ponta em V. */
function elvenBanner(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(-8, -1, 0, 8, 0, 2, "#c9b27a");
  for (let y = -20; y < -1; y++)
    for (let x = -6; x < 6; x++) {
      if (y < -16 && Math.abs(x + 0.5) > (y + 20) * 1.5) continue;
      b.set(x, y, 1, x === -6 || x === 5 ? "#d8c070" : pickTone(["#1f5a3a", "#256a44", "#2c7a4e"], hash3(x, y, 1, 7)));
    }
  for (const [x, y] of [[0, -6], [-1, -7], [0, -7], [1, -7], [-1, -8], [0, -8], [1, -8], [-2, -9], [0, -9], [2, -9], [0, -10], [0, -11]] as const) b.set(x, y, 0, "#e8c860");
  return b;
}

/** Braseiro lunar: taça de pedra clara com chama branco-azulada. */
function moonBrazier(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let y = 0; y < 8; y++) {
    const r = y < 2 ? 4 : y < 6 ? 1.6 : 4.5;
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (Math.hypot(x + 0.5, z + 0.5) < r) b.set(x, y, z, pickTone(["#c8c4b4", "#d8d4c4", "#e4e0d0"], hash3(x, y, z)));
  }
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4) b.set(x, 8, z, hash3(x, 8, z) < 0.5 ? "#7ad8ff" : "#d8f4ff");
  bough(b, [[0, 8, 0], [1, 11, 0], [0, 14, 1]], 1.6, 0.4, () => "#f0faff");
  return b;
}

/** Espinhos de raiz da armadilha: galhos pontudos que saem do chão. */
function thornSpikes(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let x = -5; x < 6; x += 3)
    for (let z = -5; z < 6; z += 3) {
      const h = 6 + ((x * 7 + z * 13 + 100) % 3);
      b.box(x, 0, z, x + 2, h - 2, z + 2, "#4e3522").box(x, h - 2, z, x + 2, h - 1, z + 2, "#6e4f33").set(x, h - 1, z, "#3d6e34");
    }
  return b;
}

/** Floreira de pedra com samambaias, no lugar dos sarcófagos. */
function planter(): VoxelBuilder {
  const b = new VoxelBuilder();
  const s = stone(14);
  for (let x = -7; x < 7; x++) for (let z = -5; z < 5; z++) for (let y = 0; y < 5; y++) if (Math.abs(x + 0.5) > 5.5 || Math.abs(z + 0.5) > 3.5 || y === 0) b.set(x, y, z, s(x, y, z));
  for (let x = -6; x < 6; x++) for (let z = -4; z < 4; z++) b.set(x, 4, z, "#3a2a1a");
  for (let k = 0; k < 9; k++) {
    const x = -5 + Math.floor(hash3(k, 0, 0, 2) * 10), z = -3 + Math.floor(hash3(k, 1, 0, 2) * 6);
    limb(b, [x, 5, z], [x + (hash3(k, 2, 0) - 0.5) * 6, 11 + hash3(k, 3, 0) * 4, z + (hash3(k, 4, 0) - 0.5) * 4], 0.9, 0.5, (px, py, pz) => pickTone(LEAF, hash3(px, py, pz)));
  }
  return b;
}

const IRON = ["#2e2c30", "#3a383c", "#46444a"];
const EMBERS = ["#ff7a1a", "#ffa03a", "#ffc24a"];

/** Bigorna sobre um toco, com um martelo apoiado e uma lâmina em brasa. */
function anvil(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(-4, 0, -4, 4, 6, 4, "#4a3220").box(-4, 5, -4, 4, 6, 4, "#5a3e28"); // toco
  b.box(-7, 6, -3, 7, 8, 3, IRON[1]!).box(-3, 8, -2, 3, 10, 2, IRON[0]!).box(-8, 10, -3, 8, 13, 3, IRON[2]!).box(8, 11, -1, 11, 12, 1, IRON[2]!); // bigorna com bico
  b.box(-5, 13, -1, 3, 14, 0, "#ff8a2a").box(-5, 13, -1, -3, 14, 0, "#ffc24a"); // lâmina em brasa
  b.box(5, 0, 5, 6, 10, 6, "#5a3e28").box(3, 10, 4, 8, 13, 7, IRON[2]!); // martelo encostado
  return b;
}

/** Correntes penduradas num canto do teto (x+ e z+ são as paredes). */
function chains(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let k = 0; k < 4; k++) {
    const x = -3 - k * 3, z = -2 - ((k * 5) % 9);
    const len = 12 + ((k * 7) % 10);
    for (let d = 0; d < len; d++) b.set(x + (d % 2), -d, z, d % 3 === 0 ? IRON[2]! : IRON[0]!);
    b.box(x - 1, -len - 2, z - 1, x + 2, -len, z + 1, IRON[1]!); // gancho
  }
  return b;
}

/** Estandarte da forja: pano preto e vermelho com uma bigorna dourada. */
function forgeBanner(): VoxelBuilder {
  const b = new VoxelBuilder();
  b.box(-8, -1, 0, 8, 0, 2, IRON[1]!);
  for (let y = -20; y < -1; y++)
    for (let x = -6; x < 6; x++) {
      if (y < -16 && Math.abs(x + 0.5) > (y + 20) * 1.5) continue;
      b.set(x, y, 1, x === -6 || x === 5 ? "#8a1a14" : pickTone(["#1a1414", "#221a1a", "#2a2020"], hash3(x, y, 1, 5)));
    }
  for (const [x0, x1, y] of [[-3, 3, -7], [-1, 1, -8], [-1, 1, -9], [-2, 2, -10]] as const) for (let x = x0; x <= x1; x++) b.set(x, y, 0, "#d4a92a");
  return b;
}

/** Cadinho: panela de ferro sobre brasas, cheia de metal derretido que brilha. */
function crucible(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4) b.set(x, 0, z, pickTone(EMBERS, hash3(x, 0, z)));
  for (let y = 2; y < 8; y++) {
    const r = 3 + Math.sin(((y - 2) / 6) * Math.PI) * 1.2;
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d < r && (d > r - 1 || y === 2)) b.set(x, y, z, IRON[(x + y + z + 30) % 3]!);
    }
  }
  for (let x = -3; x < 3; x++) for (let z = -3; z < 3; z++) if (Math.hypot(x + 0.5, z + 0.5) < 3) b.set(x, 7, z, hash3(x, 7, z) < 0.5 ? "#ffc24a" : "#ff8a2a");
  for (const [x, z] of [[-4, -4], [3, -4], [-4, 3], [3, 3]] as const) b.box(x, 0, z, x + 1, 3, z + 1, IRON[0]!);
  return b;
}

/** Monte de carvão com algumas brasas acesas. */
function coalPile(): VoxelBuilder {
  const b = new VoxelBuilder();
  blob(b, [0, 0, 1], [7, 4, 6], (x, y, z) => (hash3(x, y, z, 3) < 0.06 ? pickTone(EMBERS, hash3(x, y, z)) : pickTone(["#141214", "#1c1a1c", "#242224"], hash3(x, y, z, 1))), { rough: 0.35, grain: 2, seed: 4, floor: 0 });
  return trimBelow(b);
}

/** Respiro de fogo da armadilha: grade de ferro com chamas que sobem. */
function fireVent(): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let x = -5; x < 6; x += 3)
    for (let z = -5; z < 6; z += 3) {
      const h = 6 + ((x * 7 + z * 13 + 100) % 3);
      b.box(x, 0, z, x + 2, h - 3, z + 2, "#ff7a1a").box(x, h - 3, z, x + 2, h - 1, z + 2, "#ffb43a").set(x, h - 1, z, "#ffe08a");
    }
  return b;
}

export const DECOR_BUILDERS: Record<DecorKind, () => VoxelBuilder> = {
  anvil, chains, forgeBanner, crucible, coalPile, fireVent,
  vines, glowShrooms, elvenBanner, moonBrazier, thornSpikes, planter,
  coffin, barrel, bones, candles, banner, cobweb, rubble, urn, spikes, shrine, brazier,
  iceCluster, snowdrift, icicles, iceLamp, frozenBones, iceSpikes, iceBrazier,
};
