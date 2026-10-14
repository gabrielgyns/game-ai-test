import * as THREE from "three";
import { DUNGEON_ORIGIN, trapPhase, type DungeonRun, type DungeonThemeId } from "../domain/dungeon";
import { isFloorTile, roomAt, Tile, tileOf, type DungeonLayout } from "../domain/dungeonLayout";
import { DECOR_BUILDERS, DECOR_VOXEL, type DecorKind } from "./dungeonDecor";
import { createPortal, type Portal } from "./portal";
import { hash3, noise3, pickTone } from "./props/sculpt";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/**
 * A cripta desenhada a partir da planta do domínio. Cada andar vira poucas malhas grandes, esculpidas em
 * voxels de 1/6 m (6 por célula):
 * - estrutura: a "pele" das paredes (blocos de pedra em relevo, argamassa funda, musgo na base), o topo
 *   das paredes, arcos sobre as entradas das salas, pilares com caneluras e o poço da escada;
 * - piso: lajes com juntas, musgo perto das paredes, grades nas armadilhas e tapetes nos salões;
 * - adereços instanciados (sarcófagos, barris, ossadas, velas, estandartes, teias, entulho, urnas);
 * - tochas, braseiros e santuários com luz colorida (as mais próximas do herói ganham luz de verdade),
 *   poeira no ar, espinhos que sobem, portais e baús.
 */
const CV = 6;
const V = 1 / CV;
const WALL_H = 18; // 3 m

/**
 * Paleta e adereços de cada tema: a mesma planta vira cripta de pedra (musgo, tapetes vermelhos,
 * tochas) ou caverna de gelo (blocos azuis, neve nas frestas, pingentes, chama fria).
 */
interface DungeonStyle {
  wall: string[];
  /** Mancha na base das paredes (musgo ou geada). */
  wallBase: string[];
  crack: string;
  plinth: [string, string];
  mortar: string;
  top: [string, string, string, string];
  arch: [string, string, string, string];
  pillar: string[];
  pillarCap: string;
  stairRim: [string, string];
  steps: [string, string];
  pit: [string, string];
  floor: string[];
  joint: string;
  floorAccent: string[];
  trap: [string, string];
  rug: [string, string, string];
  speck: string;
  /** Adereço de cada "papel" (o da cripta é o próprio nome). */
  decor: Record<"coffin" | "barrel" | "bones" | "candles" | "banner" | "cobweb" | "rubble" | "urn" | "spikes" | "brazier", DecorKind>;
  flame: [string, string, string];
  torchLight: string;
  brazierLight: string;
  candleLight: string;
  dust: string;
  snow: boolean;
  portal: string;
}

const STYLES: Record<DungeonThemeId, DungeonStyle> = {
  crypt: {
    wall: ["#4e4a52", "#58545c", "#625e66", "#6c6870", "#5c5048"],
    wallBase: ["#3e5a30", "#4a6a36", "#56763c"],
    crack: "#2e2a30",
    plinth: ["#3e3a40", "#36323a"],
    mortar: "#2a272c",
    top: ["#77737c", "#3a363e", "#86828b", "#4a464e"],
    arch: ["#4a464e", "#86828b", "#6a6670", "#76727c"],
    pillar: ["#6e6a76", "#78747f", "#827e88"],
    pillarCap: "#7a7682",
    stairRim: ["#5a5660", "#76727c"],
    steps: ["#4a464e", "#56525a"],
    pit: ["#08080a", "#2a272c"],
    floor: ["#46434c", "#4e4b54", "#55525c", "#5c5862"],
    joint: "#2e2c32",
    floorAccent: ["#3e5a30", "#4a6a36"],
    trap: ["#141216", "#3a3a42"],
    rug: ["#c9a23a", "#5a1018", "#7a1a24"],
    speck: "#cfc4ac",
    decor: { coffin: "coffin", barrel: "barrel", bones: "bones", candles: "candles", banner: "banner", cobweb: "cobweb", rubble: "rubble", urn: "urn", spikes: "spikes", brazier: "brazier" },
    flame: ["#ff7a1a", "#ffb43a", "#ffe08a"],
    torchLight: "#ffa04a",
    brazierLight: "#ff7a3a",
    candleLight: "#ffc46a",
    dust: "#d8c8a8",
    snow: false,
    portal: "#9a5aff",
  },
  elvenSanctum: {
    wall: ["#8a8a7a", "#96968a", "#a29f92", "#aeab9c", "#7e8070"],
    wallBase: ["#3e6a32", "#4a7a3a", "#5a8a44"],
    crack: "#5a5a4e",
    plinth: ["#6a6a5e", "#5e5e52"],
    mortar: "#4e4e44",
    top: ["#c8c4b0", "#6a6a5e", "#d8d4c0", "#7a7a6c"],
    arch: ["#6a6a5e", "#d8d4c0", "#b8b4a2", "#c4c0ae"],
    pillar: ["#c8c4b4", "#d4d0c0", "#e0dccc"],
    pillarCap: "#d8c070",
    stairRim: ["#7a7a6c", "#a8a698"],
    steps: ["#6a6a5e", "#7a7a6c"],
    pit: ["#060a08", "#1e2a22"],
    floor: ["#7a7c6c", "#848676", "#8e9080", "#98988a"],
    joint: "#4e5046",
    floorAccent: ["#3e6a32", "#4a7a3a"],
    trap: ["#1e1a14", "#4e3a28"],
    rug: ["#d8c070", "#1f5a3a", "#256a44"],
    speck: "#e8d8ff",
    decor: { coffin: "planter", barrel: "rubble", bones: "planter", candles: "glowShrooms", banner: "elvenBanner", cobweb: "vines", rubble: "rubble", urn: "urn", spikes: "thornSpikes", brazier: "moonBrazier" },
    flame: ["#5ad8b0", "#9affd8", "#e8fff4"],
    torchLight: "#8affc8",
    brazierLight: "#9ad8ff",
    candleLight: "#5affc0",
    dust: "#c8ffd8",
    snow: false,
    portal: "#5ad88a",
  },
  volcanicForge: {
    wall: ["#2e2a2c", "#363234", "#3e3a3c", "#464244", "#3a2e2a"],
    wallBase: ["#ff7a1a", "#e05a14", "#ffa03a"],
    crack: "#ff8a2a",
    plinth: ["#2a2224", "#221c1e"],
    mortar: "#1a1416",
    top: ["#5a5254", "#2a2426", "#6a6264", "#3a3436"],
    arch: ["#2a2426", "#6a6264", "#4a4446", "#545052"],
    pillar: ["#3a3638", "#444042", "#4e4a4c"],
    pillarCap: "#8a6a3a",
    stairRim: ["#3a3436", "#5a5254"],
    steps: ["#2a2426", "#363032"],
    pit: ["#ff6a14", "#5a1a08"],
    floor: ["#3a3436", "#423c3e", "#4a4446", "#524c4e"],
    joint: "#1e1a1c",
    floorAccent: ["#5a2a1a", "#6a3220"],
    trap: ["#1a1416", "#5a2a1a"],
    rug: ["#ffc24a", "#c0400a", "#e0601a"],
    speck: "#ff9a3a",
    decor: { coffin: "anvil", barrel: "coalPile", bones: "coalPile", candles: "crucible", banner: "forgeBanner", cobweb: "chains", rubble: "rubble", urn: "crucible", spikes: "fireVent", brazier: "brazier" },
    flame: ["#ff7a1a", "#ffb43a", "#ffe08a"],
    torchLight: "#ff8a3a",
    brazierLight: "#ff6a2a",
    candleLight: "#ff9a3a",
    dust: "#ff9a4a",
    snow: false,
    portal: "#ff7a2a",
  },
  iceCave: {
    wall: ["#6a98ba", "#7aa8c8", "#8ab8d6", "#9ac6e0", "#aed4ea"],
    wallBase: ["#dceef8", "#e8f4fa", "#f4fafd"],
    crack: "#4a7898",
    plinth: ["#5a7a98", "#4e6e8a"],
    mortar: "#3e6280",
    top: ["#c8e4f2", "#5a84a4", "#e4f2fa", "#7aa0bc"],
    arch: ["#5a84a4", "#e4f2fa", "#9ac6e0", "#aed4ea"],
    pillar: ["#a6d8ee", "#b8e2f2", "#cceaf6"],
    pillarCap: "#e4f4fa",
    stairRim: ["#6a90ae", "#9ac0d8"],
    steps: ["#5a7a98", "#6a8aa8"],
    pit: ["#060a10", "#2a3e52"],
    floor: ["#b0c8da", "#bcd2e2", "#c8dcea", "#d4e4f0"],
    joint: "#8aa6bc",
    floorAccent: ["#e8f4fa", "#f4fafd"],
    trap: ["#1a2a3a", "#6a8aa8"],
    rug: ["#e8f6ff", "#1e3a66", "#2a4a7a"],
    speck: "#ffffff",
    decor: { coffin: "iceCluster", barrel: "snowdrift", bones: "frozenBones", candles: "iceLamp", banner: "iceCluster", cobweb: "icicles", rubble: "snowdrift", urn: "iceCluster", spikes: "iceSpikes", brazier: "iceBrazier" },
    flame: ["#3a9ae8", "#7ad0ff", "#e0f8ff"],
    torchLight: "#7ac8ff",
    brazierLight: "#5ab0ff",
    candleLight: "#8ad8ff",
    dust: "#ffffff",
    snow: true,
    portal: "#5ad0ff",
  },
};

const isWall = (L: DungeonLayout, i: number, j: number) => tileOf(L, i, j) === Tile.Void;
const walkable = (L: DungeonLayout, i: number, j: number) => isFloorTile(tileOf(L, i, j));

/** Pedra das paredes: tom por bloco (linhas de 4 voxels, juntas a cada 5, alternadas por fileira). */
function wallStone(vx: number, vy: number, vz: number, alongX: boolean, st: DungeonStyle): { color: string; mortar: boolean } {
  const row = Math.floor(vy / 4);
  const u = alongX ? vx : vz;
  const off = (row % 2) * 2 + (row % 3);
  const block = Math.floor((u + off) / 5);
  const mortar = vy % 4 === 0 || (u + off) % 5 === 0;
  const tone = hash3(block, row, alongX ? vz : vx, 11);
  let color = pickTone(st.wall, tone);
  if (vy < 4 && noise3(vx / 4, vy / 3, vz / 4, 5) > 0.62) color = pickTone(st.wallBase, hash3(vx, vy, vz));
  if (hash3(vx, vy, vz, 3) < 0.015) color = st.crack; // rachadura
  return { color, mortar };
}

/** Estrutura do andar: paredes (só a pele que dá para o chão), topo, arcos, pilares e o poço da escada. */
function buildStructure(L: DungeonLayout, run: DungeonRun, st: DungeonStyle = STYLES[run.theme]): VoxelBuilder {
  const b = new VoxelBuilder();
  const stairCells = stairsCells(run);
  for (let j = 0; j < L.height; j++)
    for (let i = 0; i < L.width; i++) {
      if (!isWall(L, i, j)) continue;
      // Lados (e cantos) desta célula de parede que encostam em chão.
      const near: [number, number][] = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && walkable(L, i + di, j + dj)) near.push([di, dj]);
      if (!near.length) continue;
      for (let lx = 0; lx < CV; lx++)
        for (let lz = 0; lz < CV; lz++) {
          // Profundidade a partir da face mais próxima que dá para o chão (0 = face).
          let depth = Infinity;
          let alongX = true;
          for (const [di, dj] of near) {
            const dx = di > 0 ? CV - 1 - lx : di < 0 ? lx : Infinity;
            const dz = dj > 0 ? CV - 1 - lz : dj < 0 ? lz : Infinity;
            const d = di && dj ? Math.max(dx, dz) : Math.min(dx, dz);
            if (d < depth) [depth, alongX] = [d, dj !== 0 && !di];
          }
          const vx = i * CV + lx, vz = j * CV + lz;
          if (depth <= 1) {
            for (let vy = 0; vy < WALL_H - 2; vy++) {
              const s = wallStone(vx, vy, vz, alongX, st);
              const plinth = vy < 2;
              if (depth === 0 && s.mortar && !plinth) continue; // argamassa funda: relevo dos blocos
              b.set(vx, vy, vz, plinth ? (vy === 1 ? st.plinth[0] : st.plinth[1]) : depth === 1 && s.mortar ? st.mortar : s.color);
            }
          }
          // Topo da parede: tampa a célula inteira, com borda mais clara.
          b.set(vx, WALL_H - 2, vz, depth <= 1 ? st.top[0] : st.top[1]).set(vx, WALL_H - 1, vz, depth === 0 ? st.top[2] : st.top[3]);
        }
    }

  // Arcos sobre as entradas das salas: verga de pedra sobre as células de corredor que encostam na sala.
  for (let j = 0; j < L.height; j++)
    for (let i = 0; i < L.width; i++) {
      if (!walkable(L, i, j) || roomAt(L, i, j)) continue;
      const mouth = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => roomAt(L, i + di!, j + dj!) && walkable(L, i + di!, j + dj!));
      if (!mouth) continue;
      for (let lx = 0; lx < CV; lx++)
        for (let lz = 0; lz < CV; lz++)
          for (let vy = 13; vy < WALL_H; vy++) b.set(i * CV + lx, vy, j * CV + lz, vy === 13 ? st.arch[0] : vy === WALL_H - 1 ? st.arch[1] : pickTone([st.arch[2], st.arch[3]], hash3(i, vy, j)));
    }

  // Pilares 2×2 (exceto o poço da escada): base, fuste com caneluras e capitel.
  for (let j = 0; j < L.height; j++)
    for (let i = 0; i < L.width; i++) {
      if (tileOf(L, i, j) !== Tile.Pillar || stairCells.has(j * L.width + i)) continue;
      if (tileOf(L, i - 1, j) === Tile.Pillar || tileOf(L, i, j - 1) === Tile.Pillar) continue;
      const cx = i * CV + CV, cz = j * CV + CV; // centro do bloco 2×2, em voxels
      for (let x = -CV; x < CV; x++)
        for (let z = -CV; z < CV; z++) {
          const r = Math.hypot(x + 0.5, z + 0.5);
          const flute = Math.cos(Math.atan2(z + 0.5, x + 0.5) * 8) > 0.5 ? 0.8 : 0;
          for (let vy = 0; vy < WALL_H; vy++) {
            const base = vy < 2 && Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) <= CV - 0.5;
            const capital = vy >= WALL_H - 3 && Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) <= CV - 0.5 - (vy === WALL_H - 3 ? 1 : 0);
            const shaft = r <= 4 - flute;
            if (!(base || capital || shaft)) continue;
            b.set(cx + x, vy, cz + z, base || capital ? st.pillarCap : pickTone(st.pillar, noise3((cx + x) / 3, vy / 5, (cz + z) / 3, 2)));
          }
        }
    }

  // Poço da escada: borda de pedra e degraus descendo para o escuro.
  if (run.stairs) {
    const sx = Math.round((run.stairs.x - DUNGEON_ORIGIN.x) * CV), sz = Math.round((run.stairs.z - DUNGEON_ORIGIN.z) * CV);
    for (let x = -CV - 1; x < CV + 1; x++)
      for (let z = -CV - 1; z < CV + 1; z++) {
        const rim = x < -CV + 1 || x >= CV - 1 || z < -CV + 1 || z >= CV - 1;
        if (rim) {
          b.set(sx + x, 0, sz + z, st.stairRim[0]).set(sx + x, 1, sz + z, st.stairRim[1]);
          continue;
        }
        // Degraus: descem ao longo de x, do lado -x para o +x; o fundo é preto.
        const step = Math.floor((x + CV - 1) / 1.5);
        const floorY = -1 - step;
        b.set(sx + x, floorY, sz + z, step % 2 ? st.steps[0] : st.steps[1]);
        for (let y = floorY - 1; y >= -10; y--) b.set(sx + x, y, sz + z, y < -8 ? st.pit[0] : st.pit[1]);
      }
  }
  return b;
}

const stairsCells = (run: DungeonRun): Set<number> => {
  const out = new Set<number>();
  if (!run.stairs) return out;
  const si = Math.round(run.stairs.x - DUNGEON_ORIGIN.x) - 1, sj = Math.round(run.stairs.z - DUNGEON_ORIGIN.z) - 1;
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) out.add((sj + dj) * run.layout.width + si + di);
  return out;
};

/** Piso: lajes 3×3 com juntas, grades nas armadilhas, tapete vermelho nos salões e na arena. */
function buildFloor(L: DungeonLayout, st: DungeonStyle = STYLES.crypt): VoxelBuilder {
  const b = new VoxelBuilder();
  for (let j = 0; j < L.height; j++)
    for (let i = 0; i < L.width; i++) {
      const t = tileOf(L, i, j);
      if (t === Tile.Void) continue;
      const room = roomAt(L, i, j);
      const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => isWall(L, i + di!, j + dj!));
      let rug = false;
      if (room && (room.shape === "hall" || room.kind === "boss")) {
        const long = room.i1 - room.i0 >= room.j1 - room.j0;
        const c = long ? (room.j0 + room.j1) / 2 : (room.i0 + room.i1) / 2;
        rug = Math.abs((long ? j : i) + 0.5 - c) < 1.6 && (long ? i > room.i0 + 1 && i < room.i1 - 2 : j > room.j0 + 1 && j < room.j1 - 2);
      }
      for (let lx = 0; lx < CV; lx++)
        for (let lz = 0; lz < CV; lz++) {
          const vx = i * CV + lx, vz = j * CV + lz;
          let color: string;
          if (t === Tile.Trap) {
            color = (lx + lz) % 2 === 0 && lx % 2 === 0 ? st.trap[0] : st.trap[1];
          } else if (rug) {
            const edge = lx === 0 && (Math.abs((i + 0.5) - ((room!.i0 + room!.i1) / 2)) > 1);
            color = edge ? st.rug[0] : hash3(vx, 0, vz, 4) < 0.08 ? st.rug[1] : st.rug[2];
          } else {
            const joint = vx % 3 === 0 || vz % 3 === 0;
            const slab = hash3(Math.floor(vx / 3), 0, Math.floor(vz / 3), 7);
            color = joint ? st.joint : pickTone(st.floor, slab);
            if (!joint && nearWall && noise3(vx / 4, 0, vz / 4, 9) > 0.66) color = pickTone(st.floorAccent, hash3(vx, 1, vz));
            if (!joint && hash3(vx, 2, vz, 5) < 0.01) color = st.speck; // ossinho perdido (ou floco de neve)
          }
          b.set(vx, 0, vz, color);
        }
    }
  return b;
}

/** Onde vai cada adereço: encostado nas paredes das salas, longe das entradas e do caminho. */
function decorPlacements(L: DungeonLayout, run: DungeonRun): { kind: DecorKind; x: number; z: number; yaw: number; y?: number }[] {
  const out: { kind: DecorKind; x: number; z: number; yaw: number; y?: number }[] = [];
  const D = STYLES[run.theme].decor;
  const rand = (i: number, j: number, s: number) => hash3(i, j, run.floor * 31 + s, run.seed % 9973);
  for (const room of L.rooms) {
    const ci = (room.i0 + room.i1) / 2, cj = (room.j0 + room.j1) / 2;
    for (let j = room.j0; j < room.j1; j++)
      for (let i = room.i0; i < room.i1; i++) {
        if (tileOf(L, i, j) !== Tile.Floor) continue;
        // Longe das linhas centrais (por onde chegam os corredores).
        if (Math.abs(i + 0.5 - ci) < 2.5 || Math.abs(j + 0.5 - cj) < 2.5) continue;
        const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => isWall(L, i + di!, j + dj!)) as [number, number][];
        if (!walls.length) continue;
        const [di, dj] = walls[0]!;
        const x = DUNGEON_ORIGIN.x + i + 0.5, z = DUNGEON_ORIGIN.z + j + 0.5;
        const facing = Math.atan2(di, dj); // -Z local aponta para longe da parede
        const r = rand(i, j, 1);
        if (walls.length >= 2 && rand(i, j, 2) < 0.6) {
          out.push({ kind: D.cobweb, x: x + walls.reduce((n, w) => n + w[0], 0) * 0.5, z: z + walls.reduce((n, w) => n + w[1], 0) * 0.5, yaw: Math.atan2(-walls.reduce((n, w) => n + w[0], 0), -walls.reduce((n, w) => n + w[1], 0)) + Math.PI / 4, y: 2.8 });
          continue;
        }
        if (r < 0.05) out.push({ kind: D.banner, x: x + di * 0.45, z: z + dj * 0.45, yaw: facing, y: 2.6 });
        else if (r < 0.08) out.push({ kind: D.coffin, x: x - di * 0.1, z: z - dj * 0.1, yaw: facing + Math.PI / 2 });
        else if (r < 0.12) out.push({ kind: D.barrel, x, z, yaw: r * 40 });
        else if (r < 0.16) out.push({ kind: D.bones, x, z, yaw: r * 50 });
        else if (r < 0.19) out.push({ kind: D.candles, x, z, yaw: r * 30 });
        else if (r < 0.21) out.push({ kind: D.urn, x, z, yaw: r * 20 });
        else if (r < 0.24) out.push({ kind: D.rubble, x, z, yaw: r * 60 });
      }
    // Braseiros nos cantos das salas grandes (chefe e escada).
    if (room.kind === "boss" || room.kind === "stairs") {
      for (const [fi, fj] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]] as const) {
        const i = Math.floor(room.i0 + (room.i1 - room.i0) * fi), j = Math.floor(room.j0 + (room.j1 - room.j0) * fj);
        if (tileOf(L, i, j) === Tile.Floor) out.push({ kind: D.brazier, x: DUNGEON_ORIGIN.x + i + 0.5, z: DUNGEON_ORIGIN.z + j + 0.5, yaw: 0 });
      }
    }
  }
  return out;
}

const decorCache = new Map<DecorKind, THREE.BufferGeometry>();
function decorGeometry(kind: DecorKind): THREE.BufferGeometry {
  let g = decorCache.get(kind);
  if (!g) {
    g = DECOR_BUILDERS[kind]().build(DECOR_VOXEL, { jitter: 0, aoStrength: 0.5 });
    g.userData.shared = true;
    decorCache.set(kind, g);
  }
  return g;
}

/**
 * Recorte de paredes: o shader descarta os pixels de parede que ficam dentro de um funil entre a câmera
 * e o herói, para a parede da frente nunca tapar a luta (o mesmo truque de jogos vistos de cima).
 */
const cutUniforms = { uCutCam: { value: new THREE.Vector3() }, uCutPlayer: { value: new THREE.Vector3(0, -999, 0) } };

function cutawayMaterial(): THREE.MeshStandardMaterial {
  const m = voxelMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCutCam = cutUniforms.uCutCam;
    shader.uniforms.uCutPlayer = cutUniforms.uCutPlayer;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutWorld;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vec4 cutWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cutWorld = instanceMatrix * cutWorld;
#endif
vCutWorld = (modelMatrix * cutWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutWorld;\nuniform vec3 uCutCam;\nuniform vec3 uCutPlayer;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
vec3 cutSeg = uCutPlayer - uCutCam;
float cutT = clamp(dot(vCutWorld - uCutCam, cutSeg) / max(dot(cutSeg, cutSeg), 0.001), 0.0, 1.0);
float cutD = length(vCutWorld - (uCutCam + cutSeg * cutT));
// Funil: largo perto da câmera, estreito perto do herói (só a parede "da frente" some).
if (cutT < 0.94 && cutD < mix(9.0, 1.7, cutT) && vCutWorld.y > 0.3) discard;`,
      );
  };
  m.customProgramCacheKey = () => "dungeon-cutaway";
  return m;
}

function chestGeometry(lid: boolean): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const wood = "#7a4a2a", dark = "#5a3420", gold = "#d4a92a";
  if (!lid) {
    b.box(-6, 0, -4, 6, 6, 4, wood).box(-6, 0, -4, 6, 1, 4, dark);
    for (const x of [-6, -1, 4]) b.box(x, 0, -4, x + 2, 6, 4, gold);
    b.box(-1, 3, -5, 1, 5, -4, gold).set(0, 3, -5, "#1b1b1b"); // fechadura
  } else {
    b.box(-6, 0, -8, 6, 3, 0, wood).box(-6, 2, -8, 6, 3, 0, "#8a5a32");
    for (const x of [-6, -1, 4]) b.box(x, 0, -8, x + 2, 3, 0, gold);
  }
  return b.build(1 / 8, { grain: 0.05, grainScale: 2 });
}

function sconceGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(-1, 0, 0, 1, 1, 3, "#3a3632").box(-1, 1, 2, 1, 3, 4, "#4a4540"); // haste e copo
  return b.build(1 / 8, { jitter: 0, ao: false });
}

function flameGeometry(colors: [string, string, string]): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 2, 1, colors[0])
    .box(-1, 2, 0, 1, 3, 1, colors[1])
    .set(0, 3, 0, colors[2])
    .build(1 / 8, { jitter: 0, ao: false });
}

interface LightSpot {
  pos: THREE.Vector3;
  color: THREE.Color;
  power: number;
}

const DUST = 380;

export class DungeonView {
  readonly group = new THREE.Group();
  private run: DungeonRun | null = null;
  private layout: DungeonLayout | null = null;
  private torches: THREE.Vector3[] = [];
  private lightSpots: LightSpot[] = [];
  private flames: THREE.InstancedMesh | null = null;
  private readonly lights: THREE.PointLight[] = [];
  private startPortal: Portal | null = null;
  private exitPortal: Portal | null = null;
  private chests: { lid: THREE.Object3D; state: { opened: boolean } }[] = [];
  private bossChestBuilt = false;
  private shrines: { mesh: THREE.Mesh; state: { used: boolean }; material: THREE.MeshStandardMaterial }[] = [];
  private spikes: THREE.InstancedMesh | null = null;
  private spikeCells: THREE.Vector3[] = [];
  private warnPlates: THREE.InstancedMesh | null = null;
  private readonly warnMaterial = new THREE.MeshBasicMaterial({ color: "#ff3a2a", transparent: true, opacity: 0, depthWrite: false });
  private readonly dust: THREE.Points;
  private readonly dummy = new THREE.Object3D();
  private readonly structureMaterial = cutawayMaterial();
  /** Caverna de gelo: a "poeira" vira neve que cai devagar. */
  private snowing = false;
  /** Quanto tempo levou para montar o último andar (para medir). */
  lastBuildMs = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    // Luzes: sempre na cena (para não recompilar shaders), apagadas fora da cripta.
    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight("#ffa04a", 0, 13, 1.3);
      this.lights.push(l);
      scene.add(l);
    }
    // Poeira em suspensão: pontinhos que flutuam em volta do herói e pegam a luz das tochas.
    const pos = new Float32Array(DUST * 3);
    for (let k = 0; k < DUST; k++) {
      pos[k * 3] = (Math.random() - 0.5) * 24;
      pos[k * 3 + 1] = Math.random() * 3;
      pos[k * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: "#d8c8a8", size: 0.05, transparent: true, opacity: 0.45, depthWrite: false }));
    this.dust.visible = false;
    scene.add(this.dust);
  }

  get active(): boolean {
    return this.run !== null;
  }

  update(run: DungeonRun | undefined, focus: THREE.Vector3, time: number, camera?: THREE.Camera): void {
    if ((run ?? null) !== this.run || run?.layout !== this.layout) this.rebuild(run ?? null);
    if (camera) {
      cutUniforms.uCutCam.value.copy(camera.position);
      cutUniforms.uCutPlayer.value.set(focus.x, focus.y + 1.2, focus.z);
    }
    this.dust.visible = !!this.run;
    if (!this.run) {
      for (const l of this.lights) l.intensity = 0;
      return;
    }
    const r = this.run;
    // Poeira: acompanha o herói e sobe devagar.
    this.dust.position.set(focus.x, this.snowing ? 3 - ((time * 0.5) % 3) : 0, focus.z);
    this.dust.rotation.y = time * (this.snowing ? 0.05 : 0.02);
    (this.dust.material as THREE.PointsMaterial).opacity = 0.35 + Math.sin(time * 0.7) * 0.08;

    // As luzes mais próximas do herói ganham luz de verdade; as outras só brilham.
    const nearest = this.lightSpots
      .map((s) => ({ s, d: (s.pos.x - focus.x) ** 2 + (s.pos.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length);
    this.lights.forEach((l, i) => {
      const n = nearest[i];
      if (!n) return void (l.intensity = 0);
      l.position.copy(n.s.pos).add(new THREE.Vector3(0, 0.4, 0));
      l.color.copy(n.s.color);
      l.intensity = n.s.power * (1 + Math.sin(time * 11 + i * 2.1) * 0.12 + Math.sin(time * 17 + i) * 0.06);
    });
    if (this.flames) {
      this.torches.forEach((t, i) => {
        this.dummy.position.copy(t);
        this.dummy.rotation.set(0, time * 1.3 + i, 0);
        this.dummy.scale.set(1, 1 + Math.sin(time * 9 + i * 1.7) * 0.15, 1);
        this.dummy.updateMatrix();
        this.flames!.setMatrixAt(i, this.dummy.matrix);
      });
      this.flames.instanceMatrix.needsUpdate = true;
    }

    // Espinhos: sobem e descem no ciclo do domínio; o aviso acende as grades em vermelho.
    if (this.spikes && this.warnPlates) {
      const phase = trapPhase(r.trapClock);
      this.spikeCells.forEach((c, k) => {
        this.dummy.position.set(c.x, -0.62 + phase.raise * 0.62, c.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.spikes!.setMatrixAt(k, this.dummy.matrix);
      });
      this.spikes.instanceMatrix.needsUpdate = true;
      this.warnMaterial.opacity = phase.warning ? 0.1 + Math.max(0, Math.sin(time * 18)) * 0.22 : phase.active ? 0.1 : 0;
    }

    for (const s of this.shrines) {
      const glow = s.state.used ? 0.35 : 1 + Math.sin(time * 2.5) * 0.15;
      s.material.color.setScalar(glow);
    }

    this.startPortal?.update(time);
    if (r.exitPortal && !this.exitPortal) {
      this.exitPortal = createPortal("#5ad8a0");
      this.exitPortal.group.position.set(r.exitPortal.x, 0, r.exitPortal.z);
      this.exitPortal.group.rotation.y = Math.PI / 2;
      this.group.add(this.exitPortal.group);
    }
    this.exitPortal?.update(time);
    if (r.chest && !this.bossChestBuilt) {
      this.bossChestBuilt = true;
      this.addChest(r.chest, 1);
    }
    for (const c of this.chests) if (c.state.opened) c.lid.rotation.x += (-1.9 - c.lid.rotation.x) * 0.15; // tampa abre
  }

  private addChest(state: { position: { x: number; z: number }; opened: boolean }, scale: number): void {
    const chest = new THREE.Group();
    const body = new THREE.Mesh(chestGeometry(false), voxelMaterial());
    const lid = new THREE.Mesh(chestGeometry(true), voxelMaterial());
    body.castShadow = lid.castShadow = true;
    const hinge = new THREE.Group();
    hinge.position.set(0, 6 / 8, 4 / 8);
    hinge.add(lid);
    chest.add(body, hinge);
    chest.position.set(state.position.x, 0, state.position.z);
    chest.scale.setScalar(scale);
    this.chests.push({ lid: hinge, state });
    this.group.add(chest);
  }

  private clear(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry && !(m.geometry as { userData?: { shared?: boolean } }).userData?.shared) m.geometry.dispose();
      });
    }
    this.torches = [];
    this.lightSpots = [];
    this.flames = null;
    this.startPortal = this.exitPortal = null;
    this.chests = [];
    this.bossChestBuilt = false;
    this.shrines = [];
    this.spikes = this.warnPlates = null;
    this.spikeCells = [];
  }

  private rebuild(run: DungeonRun | null): void {
    const t0 = performance.now();
    this.clear();
    this.run = run;
    this.layout = run?.layout ?? null;
    if (!run) return;
    const L = run.layout;
    const st = STYLES[run.theme];
    const dustMat = this.dust.material as THREE.PointsMaterial;
    dustMat.color.set(st.dust);
    dustMat.size = st.snow ? 0.08 : 0.05;
    this.snowing = st.snow;

    // Estrutura (com recorte) e piso, cada um numa malha só.
    const structure = new THREE.Mesh(buildStructure(L, run, st).build(V, { jitter: 0, aoStrength: 0.55 }), this.structureMaterial);
    structure.position.set(DUNGEON_ORIGIN.x, 0, DUNGEON_ORIGIN.z);
    structure.castShadow = structure.receiveShadow = true;
    const floor = new THREE.Mesh(buildFloor(L, st).build(V, { jitter: 0, ao: false, skipGroundFaces: true }), voxelMaterial());
    floor.position.set(DUNGEON_ORIGIN.x, -V, DUNGEON_ORIGIN.z);
    floor.receiveShadow = true;
    this.group.add(structure, floor);

    // Adereços, instanciados por tipo.
    const byKind = new Map<DecorKind, { x: number; z: number; yaw: number; y?: number }[]>();
    for (const d of decorPlacements(L, run)) {
      let list = byKind.get(d.kind);
      if (!list) byKind.set(d.kind, (list = []));
      list.push(d);
    }
    const material = voxelMaterial();
    for (const [kind, list] of byKind) {
      const mesh = new THREE.InstancedMesh(decorGeometry(kind), material, list.length);
      list.forEach((d, k) => {
        this.dummy.position.set(d.x, d.y ?? 0, d.z);
        this.dummy.rotation.set(0, d.yaw, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(k, this.dummy.matrix);
        if (kind === st.decor.brazier) this.lightSpots.push({ pos: new THREE.Vector3(d.x, 1.3, d.z), color: new THREE.Color(st.brazierLight), power: 11 });
        if (kind === st.decor.candles) this.lightSpots.push({ pos: new THREE.Vector3(d.x, 0.7, d.z), color: new THREE.Color(st.candleLight), power: 4 });
      });
      mesh.castShadow = kind !== "cobweb" && kind !== "banner" && kind !== "icicles" && kind !== "vines" && kind !== "elvenBanner" && kind !== "chains" && kind !== "forgeBanner";
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }

    // Tochas: em paredes com chão ao lado, espaçadas pela grade (fora das salas laterais pequenas).
    const torchSpots: { pos: THREE.Vector3; yaw: number }[] = [];
    for (let j = 0; j < L.height; j++)
      for (let i = 0; i < L.width; i++) {
        if (!isWall(L, i, j) || (i * 3 + j * 5) % 9 !== 0) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (tileOf(L, i + di, j + dj) !== Tile.Floor) continue;
          const x = DUNGEON_ORIGIN.x + i + 0.5, z = DUNGEON_ORIGIN.z + j + 0.5;
          torchSpots.push({ pos: new THREE.Vector3(x + di * 0.55, 1.9, z + dj * 0.55), yaw: Math.atan2(di, dj) });
          break;
        }
      }
    const sconces = new THREE.InstancedMesh(sconceGeometry(), voxelMaterial(), torchSpots.length);
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    flameMat.color.setScalar(2.2); // acima de 1: brilha no bloom
    this.flames = new THREE.InstancedMesh(flameGeometry(st.flame), flameMat, torchSpots.length);
    torchSpots.forEach((s, k) => {
      this.dummy.position.copy(s.pos).add(new THREE.Vector3(-Math.sin(s.yaw) * 0.45, -0.3, -Math.cos(s.yaw) * 0.45));
      this.dummy.rotation.set(0, s.yaw, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      sconces.setMatrixAt(k, this.dummy.matrix);
      const p = s.pos.clone().add(new THREE.Vector3(0, 0.05, 0));
      this.torches.push(p);
      this.lightSpots.push({ pos: p, color: new THREE.Color(st.torchLight), power: 9 });
    });
    sconces.computeBoundingSphere();
    this.group.add(sconces, this.flames);

    // Armadilhas: tufos de espinhos por célula e placas de aviso.
    for (let j = 0; j < L.height; j++)
      for (let i = 0; i < L.width; i++) if (tileOf(L, i, j) === Tile.Trap) this.spikeCells.push(new THREE.Vector3(DUNGEON_ORIGIN.x + i + 0.5, 0, DUNGEON_ORIGIN.z + j + 0.5));
    if (this.spikeCells.length) {
      this.spikes = new THREE.InstancedMesh(decorGeometry(st.decor.spikes), voxelMaterial(), this.spikeCells.length);
      this.spikes.frustumCulled = false;
      this.warnPlates = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), this.warnMaterial, this.spikeCells.length);
      this.spikeCells.forEach((c, k) => {
        this.dummy.position.set(c.x, 0.02, c.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.warnPlates!.setMatrixAt(k, this.dummy.matrix);
      });
      this.warnPlates.computeBoundingSphere();
      this.group.add(this.spikes, this.warnPlates);
    }

    // Santuários (luz azul), baús laterais (luz dourada) e a escada (brilho roxo do fundo).
    for (const s of run.shrines) {
      const m = voxelMaterial();
      const mesh = new THREE.Mesh(decorGeometry("shrine"), m);
      mesh.position.set(s.position.x, 0, s.position.z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.shrines.push({ mesh, state: s, material: m });
      this.lightSpots.push({ pos: new THREE.Vector3(s.position.x, 1.6, s.position.z), color: new THREE.Color("#5ab0ff"), power: 12 });
    }
    for (const c of run.sideChests) {
      this.addChest(c, 0.85);
      this.lightSpots.push({ pos: new THREE.Vector3(c.position.x, 1.2, c.position.z), color: new THREE.Color("#ffd36a"), power: 8 });
    }
    if (run.stairs) this.lightSpots.push({ pos: new THREE.Vector3(run.stairs.x, -0.6, run.stairs.z), color: new THREE.Color("#9a6aff"), power: 10 });

    if (run.floor === 1) {
      this.startPortal = createPortal(st.portal);
      this.startPortal.group.position.set(run.startPortal.x, 0, run.startPortal.z);
      this.startPortal.group.rotation.y = Math.PI / 2;
      this.group.add(this.startPortal.group);
    }
    this.lastBuildMs = performance.now() - t0;
  }
}

/** Para o lab e testes: monta só as malhas de estrutura e piso de um andar. */
export function buildDungeonMeshes(run: DungeonRun): { structure: THREE.BufferGeometry; floor: THREE.BufferGeometry } {
  return { structure: buildStructure(run.layout, run).build(V, { jitter: 0, aoStrength: 0.55 }), floor: buildFloor(run.layout, STYLES[run.theme]).build(V, { jitter: 0, ao: false, skipGroundFaces: true }) };
}
