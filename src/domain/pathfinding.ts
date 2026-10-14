import { isFloorTile, tileOf, type DungeonLayout } from "./dungeonLayout";
import { directionXZ, type Vec2, type Vec3 } from "./math";

/**
 * Caminho dentro da dungeon por **campo de fluxo**: em vez de cada inimigo calcular sua rota, a planta
 * guarda a distância (andando) de cada célula até o herói, como água descendo um morro. Cada inimigo só
 * olha os vizinhos e desce para o menor número. O mapa é refeito quando o herói muda de célula, e serve
 * para todos os inimigos ao mesmo tempo.
 *
 * - Diagonais custam √2 e não cortam quina (as duas células laterais precisam ser chão).
 * - Células coladas em parede custam um pouco mais: os inimigos andam pelo meio do corredor em vez de
 *   raspar na pedra (e não enroscam nas quinas).
 */
export interface FlowField {
  /** Célula alvo (onde o herói está), como j * width + i. */
  target: number;
  dist: Float32Array;
  width: number;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const WALL_HUG_COST = 0.6;

/** Fila de prioridade mínima (heap binário) de índices de célula. */
class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, key: number): void {
    const it = this.items, ks = this.keys;
    let i = it.length;
    it.push(item);
    ks.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p]! <= key) break;
      it[i] = it[p]!;
      ks[i] = ks[p]!;
      i = p;
    }
    it[i] = item;
    ks[i] = key;
  }
  pop(): number {
    const it = this.items, ks = this.keys;
    const top = it[0]!;
    const lastItem = it.pop()!;
    const lastKey = ks.pop()!;
    if (it.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        let mk = lastKey;
        if (l < it.length && ks[l]! < mk) [m, mk] = [l, ks[l]!];
        if (r < it.length && ks[r]! < mk) [m, mk] = [r, ks[r]!];
        if (m === i) break;
        it[i] = it[m]!;
        ks[i] = ks[m]!;
        i = m;
      }
      it[i] = lastItem;
      ks[i] = lastKey;
    }
    return top;
  }
}

const hugCache = new WeakMap<DungeonLayout, Float32Array>();

/** Custo extra por encostar em parede, calculado uma vez por planta. */
function wallHugCost(layout: DungeonLayout): Float32Array {
  let hug = hugCache.get(layout);
  if (hug) return hug;
  const W = layout.width, H = layout.height;
  hug = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!isFloorTile(tileOf(layout, i, j))) continue;
      let walls = 0;
      for (const [di, dj] of DIRS) if (!isFloorTile(tileOf(layout, i + di, j + dj))) walls++;
      hug[j * W + i] = walls ? WALL_HUG_COST : 0;
    }
  hugCache.set(layout, hug);
  return hug;
}

/** Distância andando de toda célula até `target` (Dijkstra a partir do alvo). */
export function buildFlowField(layout: DungeonLayout, ti: number, tj: number): FlowField {
  const W = layout.width, H = layout.height;
  const dist = new Float32Array(W * H).fill(Infinity);
  const target = tj * W + ti;
  const walk = (i: number, j: number) => isFloorTile(tileOf(layout, i, j));
  if (!walk(ti, tj)) return { target, dist, width: W };
  const hug = wallHugCost(layout);
  const heap = new MinHeap();
  dist[target] = 0;
  heap.push(target, 0);
  while (heap.size) {
    const k = heap.pop();
    const i = k % W, j = (k - i) / W;
    const d = dist[k]!;
    for (const [di, dj, cost] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (!walk(ni, nj)) continue;
      if (di !== 0 && dj !== 0 && (!walk(i + di, j) || !walk(i, j + dj))) continue; // não corta quina
      const nk = nj * W + ni;
      const nd = d + cost + hug[nk]!;
      if (nd < dist[nk]!) {
        dist[nk] = nd;
        heap.push(nk, nd);
      }
    }
  }
  return { target, dist, width: W };
}

/**
 * Para onde andar a partir de `pos` (em coordenadas da planta, células de 1 m). Segue a descida do
 * campo algumas células à frente e mira na mais distante que ainda dá para ver em linha reta, o que
 * deixa o movimento suave (sem zigue-zague de célula em célula). Sem caminho, devolve null.
 */
export function flowDirection(layout: DungeonLayout, field: FlowField, pos: Vec3, origin: { x: number; z: number }): Vec2 | null {
  const W = field.width;
  let i = Math.floor(pos.x - origin.x), j = Math.floor(pos.z - origin.z);
  if (!Number.isFinite(field.dist[j * W + i] ?? Infinity)) return null;
  let aim: { i: number; j: number } | null = null;
  for (let step = 0; step < 6; step++) {
    let best = field.dist[j * W + i]!;
    let next: { i: number; j: number } | null = null;
    for (const [di, dj] of DIRS) {
      const d = field.dist[(j + dj) * W + (i + di)];
      if (d === undefined || i + di < 0 || i + di >= W) continue;
      if (di !== 0 && dj !== 0 && (!isFloorTile(tileOf(layout, i + di, j)) || !isFloorTile(tileOf(layout, i, j + dj)))) continue;
      if (d < best) [best, next] = [d, { i: i + di, j: j + dj }];
    }
    if (!next) break;
    [i, j] = [next.i, next.j];
    if (step === 0 || clearLine(layout, pos, origin, i, j)) aim = next;
    else break;
  }
  if (!aim) return null;
  return directionXZ(pos, { x: origin.x + aim.i + 0.5, y: 0, z: origin.z + aim.j + 0.5 });
}

/** O segmento até o centro da célula passa só por chão (amostras a cada 0,4 m)? */
function clearLine(layout: DungeonLayout, pos: Vec3, origin: { x: number; z: number }, ci: number, cj: number): boolean {
  const tx = origin.x + ci + 0.5, tz = origin.z + cj + 0.5;
  const d = Math.hypot(tx - pos.x, tz - pos.z);
  const n = Math.max(1, Math.ceil(d / 0.4));
  for (let s = 1; s <= n; s++) {
    const x = pos.x + ((tx - pos.x) * s) / n, z = pos.z + ((tz - pos.z) * s) / n;
    if (!isFloorTile(tileOf(layout, Math.floor(x - origin.x), Math.floor(z - origin.z)))) return false;
  }
  return true;
}
