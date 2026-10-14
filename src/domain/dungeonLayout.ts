import { seededRandom } from "./worldgen";

/**
 * Planta de um andar de dungeon: uma grade de células de 1 m com chão, pilares, armadilhas e o vazio
 * (que vira parede). Gerada por seed: salas de formas variadas (retângulo, redonda, em cruz, salão com
 * colunas) encadeadas por corredores, do início até a escada (andar de cima) ou o chefe (último andar),
 * com salas laterais de tesouro e santuário penduradas no caminho. É o "molde" que o domínio usa para
 * colisão, caminho e eventos, e que a apresentação usa para desenhar.
 */
export const Tile = { Void: 0, Floor: 1, Pillar: 2, Trap: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Dá para pisar: chão comum ou armadilha (que fere, mas não bloqueia). */
export const isFloorTile = (t: Tile): boolean => t === Tile.Floor || t === Tile.Trap;

export type RoomKind = "start" | "combat" | "boss" | "stairs" | "treasure" | "shrine";
export type RoomShape = "rect" | "round" | "cross" | "hall";
/** O que acontece numa sala de combate. */
export type RoomEvent = "normal" | "ambush" | "waves" | "traps";

export interface DungeonRoom {
  id: number;
  kind: RoomKind;
  shape: RoomShape;
  event: RoomEvent;
  /** Retângulo em células, [i0, i1) × [j0, j1). */
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

export interface DungeonLayout {
  seed: number;
  floor: number;
  width: number;
  height: number;
  /** Linha a linha (j * width + i). */
  tiles: Uint8Array;
  rooms: DungeonRoom[];
}

export const LAYOUT_SIZE = 128;
export const DUNGEON_FLOORS = 2;
/** Salas de combate no caminho principal de cada andar. */
export const COMBAT_ROOMS_PER_FLOOR = [5, 4] as const;
export const SIDE_ROOMS_PER_FLOOR = 2;

export const roomCenter = (r: DungeonRoom): { i: number; j: number } => ({ i: (r.i0 + r.i1) / 2, j: (r.j0 + r.j1) / 2 });

export function tileOf(layout: DungeonLayout, i: number, j: number): Tile {
  if (i < 0 || j < 0 || i >= layout.width || j >= layout.height) return Tile.Void;
  return layout.tiles[j * layout.width + i] as Tile;
}

/** Sala em que a célula está (pelo retângulo), se houver. */
export function roomAt(layout: DungeonLayout, i: number, j: number): DungeonRoom | undefined {
  return layout.rooms.find((r) => i >= r.i0 && i < r.i1 && j >= r.j0 && j < r.j1);
}

type Dir = "E" | "N" | "S" | "W";
interface Rect { i0: number; j0: number; i1: number; j1: number }

/** Gera a planta de um andar. Se o encadeamento não couber, tenta de novo com outra semente derivada. */
export function generateLayout(seed: number, floor = 1): DungeonLayout {
  for (let attempt = 0; attempt < 80; attempt++) {
    const layout = tryLayout(seed, floor, seededRandom(seed * 31 + floor * 7907 + attempt * 977 + 5));
    if (layout && allConnected(layout)) return layout;
  }
  throw new Error("Não foi possível gerar a dungeon");
}

function sizeFor(kind: RoomKind, shape: RoomShape, rand: () => number): { w: number; h: number } {
  const pick = (list: number[]) => list[Math.floor(rand() * list.length)]!;
  if (kind === "boss") return { w: 23, h: 23 };
  if (kind === "stairs") return { w: 15, h: 15 };
  if (kind === "start") return { w: 11, h: 11 };
  if (kind === "treasure" || kind === "shrine") return { w: 9, h: 9 };
  if (shape === "hall") return rand() < 0.5 ? { w: 23, h: 11 } : { w: 11, h: 21 };
  if (shape === "round") {
    const s = pick([15, 17]);
    return { w: s, h: s };
  }
  if (shape === "cross") {
    const s = pick([17, 19]);
    return { w: s, h: s };
  }
  return { w: pick([11, 13, 15, 17]), h: pick([11, 13, 15]) };
}

function tryLayout(seed: number, floor: number, rand: () => number): DungeonLayout | null {
  const W = LAYOUT_SIZE, H = LAYOUT_SIZE;
  const tiles = new Uint8Array(W * H);
  const rooms: DungeonRoom[] = [];
  const corridors: Rect[] = [];
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const last = floor >= DUNGEON_FLOORS;
  const combatCount = COMBAT_ROOMS_PER_FLOOR[Math.min(floor, COMBAT_ROOMS_PER_FLOOR.length) - 1]!;

  // Eventos das salas de combate: a primeira é sempre calma; nas outras, um de cada tipo e o resto sorteado.
  const events: RoomEvent[] = ["ambush", "waves", "traps"];
  while (events.length < combatCount - 1) events.push(pick(["normal", "ambush", "waves", "traps"] as const));
  for (let k = events.length - 1; k > 0; k--) {
    const m = Math.floor(rand() * (k + 1));
    [events[k], events[m]] = [events[m]!, events[k]!];
  }
  events.unshift("normal");

  const start: DungeonRoom = { id: 0, kind: "start", shape: "rect", event: "normal", i0: 4, j0: H / 2 - 5, i1: 15, j1: H / 2 + 6 };
  rooms.push(start);

  const overlaps = (a: Rect, margin: number, ignore: DungeonRoom[] = []) =>
    rooms.some((r) => !ignore.includes(r) && a.i0 < r.i1 + margin && a.i1 > r.i0 - margin && a.j0 < r.j1 + margin && a.j1 > r.j0 - margin);
  const hitsCorridor = (c: Rect) => corridors.some((o) => c.i0 < o.i1 + 1 && c.i1 > o.i0 - 1 && c.j0 < o.j1 + 1 && c.j1 > o.j0 - 1);
  const inside = (r: Rect) => r.i0 >= 2 && r.j0 >= 2 && r.i1 <= W - 2 && r.j1 <= H - 2;

  /** Tenta pendurar uma sala nova em `prev`, numa das direções, ligada por um corredor de 3 de largura. */
  const attach = (prev: DungeonRoom, kind: RoomKind, shape: RoomShape, event: RoomEvent, dirs: Dir[], margin: number): DungeonRoom | null => {
    for (let tries = 0; tries < 30; tries++) {
      const dir = pick(dirs);
      const { w, h } = sizeFor(kind, shape, rand);
      const len = 4 + Math.floor(rand() * 4);
      const pc = roomCenter(prev);
      let room: DungeonRoom;
      let corr: Rect;
      if (dir === "E" || dir === "W") {
        const cj = Math.round(pc.j);
        const j0 = cj - Math.floor(h / 2) + Math.round((rand() - 0.5) * 4);
        const i0 = dir === "E" ? prev.i1 + len : prev.i0 - len - w;
        room = { id: rooms.length, kind, shape, event, i0, j0, i1: i0 + w, j1: j0 + h };
        const lo = Math.max(prev.j0 + 3, room.j0 + 3), hi = Math.min(prev.j1 - 4, room.j1 - 4);
        if (lo > hi) continue;
        const c = Math.round((lo + hi) / 2);
        corr = dir === "E" ? { i0: prev.i1, j0: c - 1, i1: room.i0, j1: c + 2 } : { i0: room.i1, j0: c - 1, i1: prev.i0, j1: c + 2 };
      } else {
        const sign = dir === "S" ? 1 : -1;
        const ci = Math.round(pc.i);
        const i0 = ci - Math.floor(w / 2) + Math.round((rand() - 0.5) * 4);
        const j0 = sign > 0 ? prev.j1 + len : prev.j0 - len - h;
        room = { id: rooms.length, kind, shape, event, i0, j0, i1: i0 + w, j1: j0 + h };
        const lo = Math.max(prev.i0 + 3, room.i0 + 3), hi = Math.min(prev.i1 - 4, room.i1 - 4);
        if (lo > hi) continue;
        const c = Math.round((lo + hi) / 2);
        corr = sign > 0 ? { i0: c - 1, j0: prev.j1, i1: c + 2, j1: room.j0 } : { i0: c - 1, j0: room.j1, i1: c + 2, j1: prev.j0 };
      }
      if (!inside(room) || overlaps(room, margin) || overlaps(corr, 1, [prev]) || hitsCorridor(corr)) continue;
      rooms.push(room);
      corridors.push(corr);
      return room;
    }
    return null;
  };

  let prev = start;
  const chain: DungeonRoom[] = [];
  for (let n = 1; n <= combatCount + 1; n++) {
    const end = n === combatCount + 1;
    const kind: RoomKind = end ? (last ? "boss" : "stairs") : "combat";
    const shape: RoomShape = kind === "boss" ? "round" : kind === "stairs" ? "rect" : pick(["rect", "round", "cross", "hall"] as const);
    const room = attach(prev, kind, shape, end ? "normal" : events[n - 1]!, ["E", "E", "N", "S"], 3);
    if (!room) return null;
    chain.push(room);
    prev = room;
  }

  // Salas laterais (tesouro e santuário), penduradas em salas de combate por um corredor próprio.
  const sideKinds: RoomKind[] = ["treasure", "shrine"];
  for (let s = 0; s < SIDE_ROOMS_PER_FLOOR; s++) {
    const hosts = chain.filter((r) => r.kind === "combat");
    let placed = false;
    for (let t = 0; t < 12 && !placed; t++) {
      const host = pick(hosts);
      placed = attach(host, sideKinds[s % sideKinds.length]!, rand() < 0.5 ? "rect" : "round", "normal", ["N", "S"], 2) !== null;
    }
    if (!placed) return null;
  }

  // Pinta as salas na forma de cada uma, depois os corredores (que entram até o centro, para que salas
  // redondas e em cruz sempre tenham passagem).
  for (const r of rooms) paintRoom(tiles, W, r);
  corridors.forEach((c) => {
    for (let j = c.j0; j < c.j1; j++) for (let i = c.i0; i < c.i1; i++) tiles[j * W + i] = Tile.Floor;
  });
  for (const c of corridors) extendIntoRooms(tiles, W, rooms, c);

  for (const r of rooms) decorateRoom(tiles, W, r, rand);
  return { seed, floor, width: W, height: H, tiles, rooms };
}

/** Preenche a sala conforme a forma. */
function paintRoom(tiles: Uint8Array, W: number, r: DungeonRoom): void {
  const w = r.i1 - r.i0, h = r.j1 - r.j0;
  const ci = (r.i0 + r.i1) / 2, cj = (r.j0 + r.j1) / 2;
  for (let j = r.j0; j < r.j1; j++)
    for (let i = r.i0; i < r.i1; i++) {
      const u = (i + 0.5 - ci) / (w / 2), v = (j + 0.5 - cj) / (h / 2);
      let floor = true;
      if (r.shape === "round") floor = u * u + v * v <= 1.02;
      if (r.shape === "cross") floor = Math.abs(u) <= 0.38 || Math.abs(v) <= 0.38 || u * u + v * v <= 0.42;
      if (floor) tiles[j * W + i] = Tile.Floor;
    }
}

/** Leva o corredor até o centro das salas que ele toca (as pontas de corredor nunca dão em parede). */
function extendIntoRooms(tiles: Uint8Array, W: number, rooms: DungeonRoom[], c: Rect): void {
  const horizontal = c.i1 - c.i0 > c.j1 - c.j0;
  for (const r of rooms) {
    const touches = horizontal
      ? (c.i0 === r.i1 || c.i1 === r.i0) && c.j0 >= r.j0 && c.j1 <= r.j1
      : (c.j0 === r.j1 || c.j1 === r.j0) && c.i0 >= r.i0 && c.i1 <= r.i1;
    if (!touches) continue;
    const cc = roomCenter(r);
    if (horizontal) {
      const [a, b] = c.i1 === r.i0 ? [r.i0, Math.ceil(cc.i)] : [Math.floor(cc.i), r.i1];
      for (let j = c.j0; j < c.j1; j++) for (let i = a; i < b; i++) if (tiles[j * W + i] === Tile.Void) tiles[j * W + i] = Tile.Floor;
    } else {
      const [a, b] = c.j1 === r.j0 ? [r.j0, Math.ceil(cc.j)] : [Math.floor(cc.j), r.j1];
      for (let j = a; j < b; j++) for (let i = c.i0; i < c.i1; i++) if (tiles[j * W + i] === Tile.Void) tiles[j * W + i] = Tile.Floor;
    }
  }
}

/** Pilares e armadilhas, sempre longe do centro (onde corredores chegam e ninguém pode ficar preso). */
function decorateRoom(tiles: Uint8Array, W: number, r: DungeonRoom, rand: () => number): void {
  const w = r.i1 - r.i0, h = r.j1 - r.j0;
  const ci = Math.floor((r.i0 + r.i1) / 2), cj = Math.floor((r.j0 + r.j1) / 2);
  const set = (i: number, j: number, t: Tile) => {
    if (tiles[j * W + i] === Tile.Floor) tiles[j * W + i] = t;
  };
  const block = (i: number, j: number, t: Tile) => {
    set(i, j, t);
    set(i + 1, j, t);
    set(i, j + 1, t);
    set(i + 1, j + 1, t);
  };
  if (r.shape === "hall") {
    // Salão: duas fileiras de colunas ao longo do comprimento.
    const long = w > h;
    const len = long ? w : h;
    for (let k = 3; k < len - 4; k += 4) {
      if (long) {
        block(r.i0 + k, r.j0 + 2, Tile.Pillar);
        block(r.i0 + k, r.j1 - 4, Tile.Pillar);
      } else {
        block(r.i0 + 2, r.j0 + k, Tile.Pillar);
        block(r.i1 - 4, r.j0 + k, Tile.Pillar);
      }
    }
  } else if (r.kind === "boss") {
    // Anel de seis colunas em volta da arena.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      block(Math.round(ci + Math.cos(a) * 7.5) - 1, Math.round(cj + Math.sin(a) * 7.5) - 1, Tile.Pillar);
    }
  } else if (r.shape === "rect" && (r.kind === "combat" || r.kind === "stairs") && w >= 15 && h >= 15) {
    for (const [pi, pj] of [[r.i0 + 3, r.j0 + 3], [r.i1 - 5, r.j0 + 3], [r.i0 + 3, r.j1 - 5], [r.i1 - 5, r.j1 - 5]] as const) block(pi, pj, Tile.Pillar);
  }
  if (r.event === "traps") {
    // Blocos 2×2 de espinhos espalhados, a pelo menos 2 células do centro.
    for (let j = r.j0 + 2; j < r.j1 - 3; j += 3)
      for (let i = r.i0 + 2; i < r.i1 - 3; i += 3) {
        if (Math.abs(i - ci) < 3 && Math.abs(j - cj) < 3) continue;
        if (rand() < 0.55) block(i, j, Tile.Trap);
      }
  }
}

/** Busca em largura pelas células de chão (comum ou armadilha). */
export function reachable(layout: DungeonLayout, from: { i: number; j: number }): Set<number> {
  const seen = new Set<number>();
  const queue = [from];
  while (queue.length) {
    const { i, j } = queue.pop()!;
    const k = j * layout.width + i;
    if (seen.has(k) || !isFloorTile(tileOf(layout, i, j))) continue;
    seen.add(k);
    queue.push({ i: i + 1, j }, { i: i - 1, j }, { i, j: j + 1 }, { i, j: j - 1 });
  }
  return seen;
}

/** Todas as salas alcançáveis a partir da inicial (garantia da geração). */
function allConnected(layout: DungeonLayout): boolean {
  const s = roomCenter(layout.rooms[0]!);
  const seen = reachable(layout, { i: Math.floor(s.i), j: Math.floor(s.j) });
  return layout.rooms.every((r) => {
    const c = roomCenter(r);
    return seen.has(Math.floor(c.j) * layout.width + Math.floor(c.i));
  });
}
