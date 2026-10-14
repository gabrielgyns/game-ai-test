import { seededRandom } from "./worldgen";

/**
 * Planta de uma dungeon: uma grade de células de 1 m com chão, pilares e o vazio (que vira parede).
 * Gerada por seed: salas retangulares encadeadas por corredores retos, da sala inicial (oeste) até a
 * sala do chefe. É o "molde" que o domínio usa para colisão e a apresentação usa para desenhar.
 */
export const Tile = { Void: 0, Floor: 1, Pillar: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type RoomKind = "start" | "combat" | "boss";

export interface DungeonRoom {
  id: number;
  kind: RoomKind;
  /** Retângulo em células, [i0, i1) × [j0, j1). */
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

export interface DungeonLayout {
  seed: number;
  width: number;
  height: number;
  /** Linha a linha (j * width + i). */
  tiles: Uint8Array;
  rooms: DungeonRoom[];
}

export const LAYOUT_SIZE = 96;
export const COMBAT_ROOMS = 5;

export const roomCenter = (r: DungeonRoom): { i: number; j: number } => ({ i: (r.i0 + r.i1) / 2, j: (r.j0 + r.j1) / 2 });

export function tileOf(layout: DungeonLayout, i: number, j: number): Tile {
  if (i < 0 || j < 0 || i >= layout.width || j >= layout.height) return Tile.Void;
  return layout.tiles[j * layout.width + i] as Tile;
}

type Dir = "E" | "N" | "S";

/** Gera a planta. Se o encadeamento não couber, tenta de novo com outra semente derivada. */
export function generateLayout(seed: number): DungeonLayout {
  for (let attempt = 0; attempt < 50; attempt++) {
    const layout = tryLayout(seed, seededRandom(seed * 31 + attempt * 977 + 5));
    if (layout) return layout;
  }
  throw new Error("Não foi possível gerar a dungeon");
}

function tryLayout(seed: number, rand: () => number): DungeonLayout | null {
  const W = LAYOUT_SIZE, H = LAYOUT_SIZE;
  const tiles = new Uint8Array(W * H);
  const rooms: DungeonRoom[] = [];
  const corridors: { i0: number; j0: number; i1: number; j1: number }[] = [];
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]!;

  const start: DungeonRoom = { id: 0, kind: "start", i0: 3, j0: H / 2 - 5, i1: 14, j1: H / 2 + 6 };
  rooms.push(start);

  const overlaps = (a: { i0: number; j0: number; i1: number; j1: number }, margin: number, ignore: DungeonRoom[]) =>
    rooms.some((r) => !ignore.includes(r) && a.i0 < r.i1 + margin && a.i1 > r.i0 - margin && a.j0 < r.j1 + margin && a.j1 > r.j0 - margin);

  let prev = start;
  for (let n = 1; n <= COMBAT_ROOMS + 1; n++) {
    const boss = n === COMBAT_ROOMS + 1;
    let placed = false;
    // Leste é o rumo principal; norte e sul fazem o caminho serpentear.
    const dirs: Dir[] = ["E", "E", "N", "S"];
    for (let tries = 0; tries < 30 && !placed; tries++) {
      const dir = pick(dirs);
      const w = boss ? 21 : pick([11, 13, 15, 17]);
      const h = boss ? 21 : pick([11, 13, 15, 17]);
      const len = 4 + Math.floor(rand() * 5);
      const pc = roomCenter(prev);
      let room: DungeonRoom;
      let corr: { i0: number; j0: number; i1: number; j1: number };
      if (dir === "E") {
        const i0 = prev.i1 + len;
        const cj = Math.round(pc.j);
        const j0 = cj - Math.floor(h / 2) + Math.round((rand() - 0.5) * 4);
        room = { id: n, kind: boss ? "boss" : "combat", i0, j0, i1: i0 + w, j1: j0 + h };
        const lo = Math.max(prev.j0 + 2, room.j0 + 2), hi = Math.min(prev.j1 - 3, room.j1 - 3);
        if (lo > hi) continue;
        const c = lo + Math.floor(rand() * (hi - lo + 1));
        corr = { i0: prev.i1, j0: c - 1, i1: room.i0, j1: c + 2 };
      } else {
        const sign = dir === "N" ? -1 : 1;
        const ci = Math.round(pc.i);
        const i0 = ci - Math.floor(w / 2) + Math.round((rand() - 0.5) * 4);
        const j0 = sign > 0 ? prev.j1 + len : prev.j0 - len - h;
        room = { id: n, kind: boss ? "boss" : "combat", i0, j0, i1: i0 + w, j1: j0 + h };
        const lo = Math.max(prev.i0 + 2, room.i0 + 2), hi = Math.min(prev.i1 - 3, room.i1 - 3);
        if (lo > hi) continue;
        const c = lo + Math.floor(rand() * (hi - lo + 1));
        corr = sign > 0 ? { i0: c - 1, j0: prev.j1, i1: c + 2, j1: room.j0 } : { i0: c - 1, j0: room.j1, i1: c + 2, j1: prev.j0 };
      }
      if (room.i0 < 2 || room.j0 < 2 || room.i1 > W - 2 || room.j1 > H - 2) continue;
      if (overlaps(room, 3, [])) continue;
      if (overlaps(corr, 1, [prev])) continue;
      if (corridors.some((c) => corr.i0 < c.i1 + 1 && corr.i1 > c.i0 - 1 && corr.j0 < c.j1 + 1 && corr.j1 > c.j0 - 1)) continue;
      rooms.push(room);
      corridors.push(corr);
      prev = room;
      placed = true;
    }
    if (!placed) return null;
  }

  const fill = (r: { i0: number; j0: number; i1: number; j1: number }, t: Tile) => {
    for (let j = r.j0; j < r.j1; j++) for (let i = r.i0; i < r.i1; i++) tiles[j * W + i] = t;
  };
  for (const r of rooms) fill(r, Tile.Floor);
  for (const c of corridors) fill(c, Tile.Floor);

  // Pilares 2×2 nas salas grandes, longe das portas (os corredores chegam pelo meio das paredes).
  for (const r of rooms) {
    const w = r.i1 - r.i0, h = r.j1 - r.j0;
    if (r.kind === "start" || w < 15 || h < 15) continue;
    const inset = r.kind === "boss" ? 4 : 3;
    for (const [pi, pj] of [[r.i0 + inset, r.j0 + inset], [r.i1 - inset - 2, r.j0 + inset], [r.i0 + inset, r.j1 - inset - 2], [r.i1 - inset - 2, r.j1 - inset - 2]] as const) {
      fill({ i0: pi, j0: pj, i1: pi + 2, j1: pj + 2 }, Tile.Pillar);
    }
  }
  return { seed, width: W, height: H, tiles, rooms };
}

/** Busca em largura pelas células de chão: usada nos testes para garantir que tudo se conecta. */
export function reachable(layout: DungeonLayout, from: { i: number; j: number }): Set<number> {
  const seen = new Set<number>();
  const queue = [from];
  while (queue.length) {
    const { i, j } = queue.shift()!;
    const k = j * layout.width + i;
    if (seen.has(k) || tileOf(layout, i, j) !== Tile.Floor) continue;
    seen.add(k);
    queue.push({ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 });
  }
  return seen;
}
