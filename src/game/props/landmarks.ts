import { VoxelBuilder } from "../voxel";
import { blob, bough, coatSurface, coatTop, hash3, limb, noise3, pickTone, rng, trimBelow, type Paint, type Vec3 } from "./sculpt";

/**
 * Adereços de bioma e marcos das arenas, em voxels de 1/12 m: cogumelos do pântano, cactos e ossadas
 * do deserto, os pilares do santuário, os totens goblin, os casulos da Rainha e os obeliscos.
 */

/** Cogumelos gigantes: um grande e dois pequenos, chapéu roxo com pintas e lamelas por baixo. */
export function mushrooms(seed: number, glow = false): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const stem: Paint = (x, y, z) => pickTone(["#e2d4b4", "#ece0c4", "#f4ead4"], hash3(x, Math.floor(y / 2), z, seed));
  const caps = [
    { at: [0, 0, 0] as Vec3, h: 22, r: 13 },
    { at: [12, 0, 6] as Vec3, h: 11, r: 7 },
    { at: [-9, 0, 9] as Vec3, h: 8, r: 5 },
  ];
  for (const [i, c] of caps.entries()) {
    const lean = (rand() - 0.5) * 4;
    const top: Vec3 = [c.at[0] + lean, c.h, c.at[2] + lean * 0.5];
    limb(b, c.at, top, c.r * 0.24, c.r * 0.17, stem);
    // Anel no caule.
    limb(b, [top[0] * 0.7 + c.at[0] * 0.3, c.h * 0.7, top[2] * 0.7 + c.at[2] * 0.3], [top[0] * 0.7 + c.at[0] * 0.3, c.h * 0.7 + 1, top[2] * 0.7 + c.at[2] * 0.3], c.r * 0.4, c.r * 0.4, () => "#bfb294");
    // Chapéu: meia bolha achatada; por baixo, lamelas claras.
    const capPaint: Paint = (x, y, z) => {
      if (y <= c.h + 1) return pickTone(["#d8c8a8", "#c4b090"], hash3(x, y, z, seed + i));
      if (noise3(x / 2.5, y / 2.5, z / 2.5, seed + i * 7) > 0.74) return "#f0e6cc";
      return pickTone(glow ? ["#1e5a8a", "#2a6aa0", "#3a80b8", "#5aa8e0"] : ["#5e2a78", "#6e3388", "#7d3f98", "#8f4da8"], Math.min(0.999, (y - c.h) / (c.r * 0.7) * 0.6 + hash3(x, y, z, seed) * 0.4));
    };
    blob(b, [top[0], c.h, top[2]], [c.r, c.r * 0.62, c.r], capPaint, { rough: 0.08, grain: 4, seed: seed + i, floor: c.h });
  }
  return trimBelow(b);
}

/**
 * Cacto saguaro: caule com gomos (listras verticais claras e escuras pela volta), espinhos claros
 * na superfície, braços que sobem em curva e flores rosadas no topo.
 */
export function cactus(seed: number, height: number, arms: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const rand = rng(seed);
  const ribs: Paint = (x, _y, z) => {
    const a = Math.atan2(z + 0.5, x + 0.5);
    return Math.sin(a * 8) > 0.2 ? "#4f8f3a" : "#3c7330";
  };
  limb(b, [0, 0, 0], [0, height, 0], 4.2, 3.6, ribs);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rand() * 0.8;
    const y0 = height * (0.35 + rand() * 0.2);
    const out = 9 + rand() * 3;
    const elbow: Vec3 = [Math.cos(a) * out, y0 + 2, Math.sin(a) * out];
    const up: Vec3 = [elbow[0], y0 + height * (0.3 + rand() * 0.15), elbow[2]];
    const armPaint: Paint = (x, _y, z) => {
      const aa = Math.atan2(z - elbow[2] + 0.5, x - elbow[0] + 0.5);
      return Math.sin(aa * 6) > 0.2 ? "#4a8a36" : "#38702e";
    };
    bough(b, [[0, y0, 0], [elbow[0] * 0.6, y0 - 1, elbow[2] * 0.6], elbow], 2.8, 2.8, armPaint);
    limb(b, elbow, up, 2.8, 2.4, armPaint);
  }
  coatSurface(b, (x, y, z) => (hash3(x, y, z, seed) < 0.05 ? "#e8e0b0" : null));
  coatTop(b, (x, y, z) => (y > height - 1 && hash3(x, y, z, seed + 1) < 0.5 ? (hash3(x, z, y) < 0.5 ? "#f0a8c0" : "#ffd0dc") : null));
  return trimBelow(b);
}

/** Ossada do deserto: crânio de boi com chifres e costelas meio enterradas na areia. */
export function bones(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const bone: Paint = (x, y, z) => pickTone(["#d8ceb6", "#e6dcc6", "#f0e8d6"], hash3(x, y, z, seed));
  // Espinha e costelas em arco.
  limb(b, [-16, 1, 0], [10, 2, 0], 1.3, 1.3, bone);
  for (let i = 0; i < 6; i++) {
    const x = -13 + i * 4;
    for (const s of [-1, 1]) bough(b, [[x, 2, 0], [x + 1, 6 - i * 0.4, s * 5], [x + 2, 2, s * 8]], 0.9, 0.7, bone);
  }
  // Crânio: focinho comprido, órbitas escuras, chifres curvos.
  blob(b, [17, 4, 0], [6, 4, 4], bone, { rough: 0.05, seed });
  limb(b, [17, 3, 0], [25, 2, 0], 3, 2, bone);
  b.box(17, 4, -4, 19, 6, -2, "#3a3028").box(17, 4, 2, 19, 6, 4, "#3a3028");
  b.box(24, 1, -1, 26, 3, 1, "#3a3028");
  for (const s of [-1, 1]) bough(b, [[15, 7, s * 3], [14, 9, s * 9], [17, 13, s * 12]], 1.2, 0.6, (x, y, z) => pickTone(["#c8b898", "#b8a888"], hash3(x, y, z)));
  return trimBelow(b);
}

/**
 * Pilar do santuário: base, fuste com caneluras e capitel, com lascas nas quinas e musgo no pé.
 * O topo fica exatamente a 1,5 m (18 voxels), onde os braseiros se apoiam.
 */
export function shrinePillar(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const stone: Paint = (x, y, z) => pickTone(["#c4bca8", "#d2cab6", "#ddd6c4", "#e8e2d2"], Math.min(0.999, noise3(x / 4, y / 4, z / 4, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));
  b.box(-6, 0, -6, 6, 2, 6, "#b8b09c");
  b.box(-5, 2, -5, 5, 3, 5, "#c8c0ac");
  for (let y = 3; y < 15; y++)
    for (let x = -4; x < 4; x++)
      for (let z = -4; z < 4; z++) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        const a = Math.atan2(z + 0.5, x + 0.5);
        const flute = Math.cos(a * 8) > 0.45 ? 1.3 : 0; // caneluras
        if (r <= 4 - flute) b.set(x, y, z, stone(x, y, z));
      }
  b.box(-5, 15, -5, 5, 16, 5, "#c8c0ac");
  b.box(-6, 16, -6, 6, 18, 6, "#d6cebc");
  // Lascas: tira alguns voxels das quinas do capitel e da base.
  const rand = rng(seed);
  for (let i = 0; i < 10; i++) {
    const x = rand() < 0.5 ? -6 : 5, z = Math.floor(rand() * 12) - 6;
    const y = rand() < 0.5 ? Math.floor(rand() * 2) : 16 + Math.floor(rand() * 2);
    if (rand() < 0.5) b.remove(x, y, z);
    else b.remove(z, y, x);
  }
  // Um pouco de musgo nas frestas da base.
  coatSurface(b, (x, y, z) => (y < 4 && noise3(x / 2.5, y / 2, z / 2.5, seed + 4) > 0.7 ? pickTone(["#4d7a30", "#5c8a38", "#6e9a42"], hash3(x, y, z)) : null));
  return trimBelow(b);
}

/** Totem goblin: mastro de madeira com amarras, um crânio com chifres no topo e tiras de pano vermelho. */
export function goblinTotem(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const wood: Paint = (x, y, z) => pickTone(["#4a3020", "#5a3d2b", "#6a4a34"], noise3(x / 1.5, y / 5, z / 1.5, seed));
  limb(b, [0, 0, 0], [0, 26, 0], 2.6, 2.2, wood);
  for (const y of [8, 9, 18, 19]) limb(b, [0, y, 0], [0, y + 0.5, 0], 3.1, 3.1, () => "#8a7050"); // amarras
  // Crânio com órbitas e mandíbula.
  const bone: Paint = (x, y, z) => pickTone(["#d8ccb0", "#e8dcc0", "#f2e8d0"], hash3(x, y, z, seed));
  blob(b, [0, 30, 0], [5, 5, 5], bone, { rough: 0.04, seed });
  b.box(-4, 25, -4, 4, 27, 3, "#d8ccb0");
  for (const s of [-1, 1]) {
    b.box(s < 0 ? -3 : 1, 29, -6, s < 0 ? -1 : 3, 32, -3, "#1b1612"); // órbitas
    bough(b, [[s * 4, 32, 0], [s * 8, 34, -1], [s * 9, 39, -2]], 1.4, 0.6, (x, y, z) => pickTone(["#3a2e26", "#4a3e32"], hash3(x, y, z)));
  }
  for (let x = -3; x < 3; x += 2) b.set(x, 26, -5, "#f2e8d0"); // dentes
  // Pano vermelho preso nas amarras, caindo.
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + seed;
    const x = Math.round(Math.cos(a) * 3), z = Math.round(Math.sin(a) * 3);
    for (let y = 18; y > 10 - i * 2; y--) b.set(x + Math.round(Math.sin(y * 0.6) * 0.6), y, z, y % 3 ? "#8a1f2b" : "#a82a36");
  }
  return trimBelow(b);
}

/** Casulo de teia: estaca escura com um embrulho de seda enrolado em espiral e fios soltos. */
export function cocoon(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  limb(b, [0, 0, 0], [1, 26, 0], 1.6, 1.2, (x, y, z) => pickTone(["#2a221c", "#3b2f25"], hash3(x, y, z, seed)));
  const silk: Paint = (x, y, z) => {
    const a = Math.atan2(z + 0.5, x - 0.5);
    const band = Math.sin(y * 0.9 + a * 2) > 0.55;
    return band ? "#cfc8b8" : pickTone(["#e4e0d4", "#ece8de", "#f4f1ea"], hash3(x, y, z, seed));
  };
  blob(b, [1, 17, 0], [5, 9, 5], silk, { rough: 0.12, grain: 3, seed });
  // Fios que descem até o chão e prendem em volta.
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + seed;
    limb(b, [1, 10, 0], [Math.cos(a) * 9, 0, Math.sin(a) * 9], 0.75, 0.6, () => "#e8e4da");
  }
  b.set(0, 20, -5, "#b8322f").set(2, 20, -5, "#b8322f"); // olhos de algo lá dentro
  return trimBelow(b);
}

/** Obelisco de arenito com hieróglifos em relevo e ponta de ouro; a versão quebrada tem o topo caído. */
export function obelisk(seed: number, broken: boolean): VoxelBuilder {
  const b = new VoxelBuilder();
  const sand: Paint = (x, y, z) => pickTone(["#c8a468", "#d4b274", "#dcbc80", "#e4c68a"], Math.min(0.999, noise3(x / 3, y / 3, z / 3, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));
  b.box(-8, 0, -8, 8, 3, 8, "#b89458").box(-7, 3, -7, 7, 5, 7, "#c4a064");
  const height = broken ? 18 : 34;
  for (let y = 5; y < height; y++) {
    const half = Math.round(5 - (y - 5) * 0.06);
    b.box(-half, y, -half, half, y + 1, half, sand(0, y, 0));
    for (let x = -half; x < half; x++) for (const z of [-half, half - 1]) b.set(x, y, z, sand(x, y, z));
  }
  // Hieróglifos escuros em colunas nas quatro faces.
  const glyph = (u: number, y: number) => hash3(u, Math.floor(y / 3), 0, seed) < 0.45 && y % 3 !== 0;
  for (let y = 8; y < height - 3; y++)
    for (let u = -2; u < 2; u++) {
      if (!glyph(u, y)) continue;
      const half = Math.round(5 - (y - 5) * 0.06);
      b.set(u, y, -half - 1 + 1, "#6a4a2a").set(u, y, half - 1, "#6a4a2a").set(-half, y, u, "#6a4a2a").set(half - 1, y, u, "#6a4a2a");
    }
  if (broken) {
    // Topo quebrado em degraus e o pedaço caído ao lado.
    const rand = rng(seed);
    for (let i = 0; i < 18; i++) b.remove(Math.floor(rand() * 8) - 4, height - 1 - Math.floor(rand() * 3), Math.floor(rand() * 8) - 4);
    for (let x = 0; x < 14; x++) b.box(9 + x, 0, 3, 10 + x, 5 - (x > 10 ? 1 : 0), 9, sand(x, 2, 5));
    b.box(9, 5, 4, 12, 6, 8, "#d4b274");
  } else {
    // Pirâmide de ouro na ponta.
    for (let i = 0; i < 4; i++) b.box(-3 + i, height + i, -3 + i, 3 - i, height + i + 1, 3 - i, i === 3 ? "#f0d070" : i % 2 ? "#e0b840" : "#d4a92a");
  }
  return trimBelow(b);
}

/**
 * Baú do santuário: tábuas de madeira com frestas, tampa abaulada, cintas e cantoneiras de ferro e
 * fechadura dourada na frente (-Z). Cabe nele o que não cabe na mochila.
 */
export function stashChest(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const wood: Paint = (x, y, z) => (x % 4 === 0 ? "#5a3a20" : pickTone(["#7a5230", "#86603a", "#8f6a40"], noise3(x / 2, y / 6, z / 2, seed)));
  const iron = "#4a4a52", ironLight = "#6a6a74";
  // Caixa.
  for (let x = -9; x < 9; x++) for (let y = 1; y < 9; y++) for (let z = -6; z < 6; z++) b.set(x, y, z, wood(x, y, z));
  // Tampa abaulada.
  for (let x = -9; x < 9; x++)
    for (let z = -6; z < 6; z++)
      for (let y = 9; y < 13; y++) {
        const r = Math.hypot((z + 0.5) / 6, (y - 8) / 4.2);
        if (r <= 1) b.set(x, y, z, wood(x, y, z));
      }
  // Pés, cintas e cantoneiras de ferro.
  for (const x of [-9, 8]) for (const z of [-6, 5]) b.set(x, 0, z, iron);
  for (const x of [-6, 5]) {
    for (let y = 1; y < 13; y++) for (let z = -7; z < 7; z++) if (b.has(x, y, z) && (!b.has(x, y, z - 1) || !b.has(x, y, z + 1) || !b.has(x, y + 1, z))) b.set(x, y, z, y % 3 ? iron : ironLight);
  }
  for (const x of [-9, 8]) for (let y = 1; y < 9; y++) for (const z of [-6, 5]) b.set(x, y, z, ironLight);
  // Fechadura e fresta da tampa.
  b.box(-2, 6, -7, 2, 10, -6, "#c9a23a").box(-1, 7, -7, 1, 9, -6, "#f0d070").set(0, 7, -7, "#2a2018");
  for (let x = -9; x < 9; x++) if (Math.abs(x) > 2) b.set(x, 9, -6, "#3a2414");
  return b;
}

/**
 * Pedra de Teleporte: um monólito de pedra escura, afunilado, sobre dois degraus redondos, com runas
 * entalhadas que brilham em azul e um encaixe no topo. O cristal que flutua acima é da apresentação
 * (`game/waystone.ts`), para poder girar e acender quando a pedra é ativada.
 */
export function waystone(seed: number): VoxelBuilder {
  const b = new VoxelBuilder();
  const stone: Paint = (x, y, z) => pickTone(["#4a4f5c", "#555b68", "#606776", "#6c7484"], Math.min(0.999, noise3(x / 3, y / 4, z / 3, seed) * 0.7 + hash3(x, y, z, seed) * 0.3));
  const step: Paint = (x, y, z) => pickTone(["#8a8478", "#9a9488", "#aaa496"], Math.min(0.999, noise3(x / 4, y / 4, z / 4, seed + 1) * 0.7 + hash3(x, y, z, seed) * 0.3));
  for (let x = -12; x <= 12; x++)
    for (let z = -12; z <= 12; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d < 11.5) for (let y = 0; y < 2; y++) b.set(x, y, z, step(x, y, z));
      if (d < 8.5) for (let y = 2; y < 4; y++) b.set(x, y, z, step(x, y, z));
    }
  // Monólito afunilado, com a borda irregular de pedra lascada.
  for (let y = 4; y < 34; y++) {
    const t = (y - 4) / 30;
    const hw = 5.5 - t * 2.2, hd = 3.6 - t * 1.4;
    for (let x = -6; x <= 6; x++)
      for (let z = -4; z <= 4; z++) {
        const rough = hash3(x, y, z, seed + 3) * 0.9;
        if (Math.abs(x + 0.5) <= hw - (Math.abs(z + 0.5) > hd - 1 ? rough : 0) && Math.abs(z + 0.5) <= hd) b.set(x, y, z, stone(x, y, z));
      }
  }
  // Encaixe do cristal: um anel mais claro no topo, aberto no meio.
  for (let x = -3; x <= 2; x++) for (let z = -2; z <= 1; z++) if (Math.abs(x + 0.5) > 1 || Math.abs(z + 0.5) > 1) b.set(x, 34, z, "#7c8494");
  // Runas na frente e atrás: traços verticais e cruzados, em azul vivo.
  const rune = (y: number, x: number, glyph: number) => {
    for (const zf of [-4, 3]) {
      const z = zf;
      b.set(x, y, z, "#5ad0ff").set(x, y + 1, z, "#5ad0ff").set(x, y + 2, z, "#5ad0ff");
      if (glyph % 2) b.set(x - 1, y + 1, z, "#9ae8ff").set(x + 1, y + 1, z, "#9ae8ff");
      else b.set(x + 1, y + 2, z, "#9ae8ff").set(x - 1, y, z, "#9ae8ff");
    }
  };
  for (let i = 0; i < 5; i++) rune(8 + i * 5, i % 2 ? 1 : -1, i);
  // Musgo nos degraus e na base do monólito.
  coatTop(b, (x, y, z) => (y <= 6 && noise3(x / 3, y, z / 3, seed + 2) > 0.7 ? pickTone(["#4d7a30", "#5c8a38"], hash3(x, y, z)) : null));
  return b;
}
