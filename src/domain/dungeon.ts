import { createSkeletonLord } from "./boss";
import type { Entity, EntityId } from "./components";
import { generateLayout, isFloorTile, roomCenter, Tile, tileOf, DUNGEON_FLOORS, type DungeonLayout, type DungeonRoom } from "./dungeonLayout";
import { createEnemy, type EnemyKind } from "./factories";
import { createEquipment, createPotion, rollRarity } from "./items";
import { directionXZ, distanceXZ, type Vec2, type Vec3 } from "./math";
import { buildFlowField, flowDirection, type FlowField } from "./pathfinding";
import { stockTier } from "./shop";
import { DUNGEON_REGION_X, terrainHeight } from "./terrain";
import { seededRandom } from "./worldgen";
import { applyDamage } from "./systems/combat";
import type { World } from "./world";
import { zoneAt } from "./zones";

/**
 * Dungeons instanciadas, no estilo Minecraft Dungeons: um portal no mapa leva a uma cripta gerada na
 * hora (planta nova a cada entrada), com dois andares. No primeiro, salas de combate com eventos
 * (emboscada, ondas, armadilhas), salas laterais de tesouro e santuário, e uma escada guardada por um
 * minichefe; no segundo, mais salas e o chefe, com o baú de loot garantido. Três vidas para a cripta
 * inteira. Ao sair (vitória, desistência ou sem vidas), tudo que era da cripta some.
 *
 * A cripta vive no mesmo `World`, numa região distante (x ≥ 1000), como um set de filmagem montado
 * nos fundos do estúdio: os sistemas continuam os mesmos, só passam a respeitar paredes.
 */
export const DUNGEON_NAME = "Cripta Esquecida";
export const DUNGEON_ORIGIN = { x: 1000, z: -64 };
/** Portal de entrada no mapa (campina a nordeste do santuário). */
export const DUNGEON_ENTRANCE = { x: 24, z: -30 };
export const DUNGEON_LIVES = 3;
export const PORTAL_RANGE = 2.6;
/** Armadilhas: ciclo, aviso e janela de dano (segundos), e quanto da vida máxima tiram. */
export const TRAP = { cycle: 3.2, warn: 1.0, active: 0.5, damageFraction: 0.14 };
/** Bênção do santuário: dano extra e duração. */
export const SHRINE_BLESSING = { multiplier: 1.25, seconds: 60 };
/** Minichefe que guarda a escada do primeiro andar. */
export const GUARDIAN = { name: "Cavaleiro Sepulcral", health: 4.5, damage: 1.4, xp: 6 };

export interface DungeonChest {
  position: Vec3;
  opened: boolean;
}

export interface DungeonRun {
  seed: number;
  level: number;
  floor: number;
  floors: number;
  layout: DungeonLayout;
  livesLeft: number;
  /** Onde o herói volta ao sair (na frente do portal de entrada). */
  returnPoint: Vec3;
  /** Inimigos de cada sala de combate deste andar (índice da sala → ids). */
  roomEnemies: Record<number, EntityId[]>;
  clearedRooms: number[];
  /** Salas com inimigos ainda por vir: emboscada (esperando o herói entrar) ou ondas seguintes. */
  pending: Record<number, { event: "ambush" | "waves"; count: number; wavesLeft: number }>;
  /** Minichefe do primeiro andar (abre a escada) e chefe do último. */
  guardianId: EntityId | null;
  bossId: EntityId | null;
  bossDefeated: boolean;
  /** Escada para o próximo andar (no centro da sala da escada), aberta quando o guardião cai. */
  stairs: Vec3 | null;
  stairsOpen: boolean;
  chest: DungeonChest | null;
  sideChests: DungeonChest[];
  shrines: { position: Vec3; used: boolean }[];
  /** Relógio das armadilhas e quem já foi ferido nesta ativação. */
  trapClock: number;
  trapHit: EntityId[];
  /** Portal de saída da sala inicial (sempre ativo) e da sala do chefe (depois da vitória). */
  startPortal: Vec3;
  exitPortal: Vec3 | null;
  failed: boolean;
  /** Campo de fluxo até o herói (refeito quando ele muda de célula). */
  flow: FlowField | null;
}

/** Centro, no mundo, de uma célula da planta. */
export function cellToWorld(i: number, j: number): Vec3 {
  return { x: DUNGEON_ORIGIN.x + i + 0.5, y: 0, z: DUNGEON_ORIGIN.z + j + 0.5 };
}

export function roomCenterWorld(r: DungeonRoom): Vec3 {
  const c = roomCenter(r);
  return { x: DUNGEON_ORIGIN.x + Math.floor(c.i) + 0.5, y: 0, z: DUNGEON_ORIGIN.z + Math.floor(c.j) + 0.5 };
}

export const inDungeonSpace = (x: number): boolean => x >= DUNGEON_REGION_X;

const cellOf = (x: number, z: number) => ({ i: Math.floor(x - DUNGEON_ORIGIN.x), j: Math.floor(z - DUNGEON_ORIGIN.z) });

/** Dá para pisar aqui? Fora da região da cripta, sempre; dentro, só no chão da planta ativa. */
export function isWalkable(world: World, x: number, z: number): boolean {
  if (!inDungeonSpace(x)) return true;
  const run = world.dungeon;
  if (!run) return false;
  const c = cellOf(x, z);
  return isFloorTile(tileOf(run.layout, c.i, c.j));
}

/** Um corpo de raio `r` cabe aqui (os quatro cantos pisam no chão)? */
export function canStand(world: World, x: number, z: number, r = 0.3): boolean {
  return isWalkable(world, x - r, z - r) && isWalkable(world, x + r, z - r) && isWalkable(world, x - r, z + r) && isWalkable(world, x + r, z + r);
}

/** Linha de visão: amostra o segmento a cada meio metro procurando parede. */
export function hasLineOfSight(world: World, a: Vec3, b: Vec3): boolean {
  if (!inDungeonSpace(a.x) && !inDungeonSpace(b.x)) return true;
  const d = distanceXZ(a, b);
  const steps = Math.max(1, Math.ceil(d / 0.5));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if (!isWalkable(world, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

/** Caminho livre para um corpo: a linha do centro e as duas laterais (±0,35 m) não batem em parede. */
function clearPath(world: World, a: Vec3, b: Vec3): boolean {
  if (!hasLineOfSight(world, a, b)) return false;
  const d = directionXZ(a, b);
  const ox = -d.z * 0.35, oz = d.x * 0.35;
  return (
    hasLineOfSight(world, { x: a.x + ox, y: 0, z: a.z + oz }, { x: b.x + ox, y: 0, z: b.z + oz }) &&
    hasLineOfSight(world, { x: a.x - ox, y: 0, z: a.z - oz }, { x: b.x - ox, y: 0, z: b.z - oz })
  );
}

/**
 * Direção para um inimigo ir atrás do herói. No vale (ou com caminho livre), em linha reta; atrás de
 * parede, pelo campo de fluxo da cripta, que contorna pilares e quinas.
 */
export function steerToward(world: World, from: Vec3, to: Vec3): Vec2 {
  const run = world.dungeon;
  if (!run || !inDungeonSpace(from.x) || clearPath(world, from, to)) return directionXZ(from, to);
  const player = world.player;
  if (run.flow && player && distanceXZ(to, player.transform.position) < 1) {
    const dir = flowDirection(run.layout, run.flow, from, DUNGEON_ORIGIN);
    if (dir) return dir;
  }
  return directionXZ(from, to);
}

/** Força dos inimigos conforme o nível da cripta (nível 3 = base). */
export const levelScale = (level: number): number => 0.7 + 0.1 * Math.max(1, level);

const ROOM_MIX: { kind: EnemyKind; weight: number }[] = [
  { kind: "skeleton", weight: 5 },
  { kind: "skeletonArcher", weight: 3 },
  { kind: "spider", weight: 1.5 },
  { kind: "bogZombie", weight: 1 },
];

function pickKind(rand: () => number): EnemyKind {
  const total = ROOM_MIX.reduce((n, m) => n + m.weight, 0);
  let r = rand() * total;
  for (const m of ROOM_MIX) if ((r -= m.weight) <= 0) return m.kind;
  return "skeleton";
}

/** Células de chão comum de uma sala, longe das bordas (onde chegam os corredores). */
function spawnCells(layout: DungeonLayout, r: DungeonRoom): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  for (let j = r.j0 + 2; j < r.j1 - 2; j++)
    for (let i = r.i0 + 2; i < r.i1 - 2; i++) if (tileOf(layout, i, j) === Tile.Floor) out.push({ i, j });
  return out;
}

/** Cria um inimigo da cripta no nível dela. */
function spawnDungeonEnemy(world: World, run: DungeonRun, kind: EnemyKind, at: Vec3): Entity {
  const scale = levelScale(run.level);
  const e = world.spawn((id) => createEnemy(id, kind, at));
  e.health.baseMax = e.health.max = e.health.current = Math.round(e.health.max * scale);
  e.level = run.level; // a cripta acompanha o herói
  e.combat.baseDamage = e.combat.damage = Math.round(e.combat.damage * scale);
  const ai = e.ai!;
  ai.xpReward = Math.round(ai.xpReward * scale);
  ai.goldReward = Math.round(ai.goldReward * scale);
  ai.respawnSeconds = Infinity; // instanciado: quem morre aqui não volta
  ai.leashRange = 22;
  ai.aggroRange = Math.min(ai.aggroRange, 11);
  ai.needsSight = true;
  ai.lootTier = stockTier(run.level);
  return e;
}

/** Espalha `count` inimigos nas células de spawn, longe de `avoid` (o herói, numa emboscada). */
function spawnInRoom(world: World, run: DungeonRun, room: DungeonRoom, count: number, rand: () => number, avoid?: Vec3): EntityId[] {
  let cells = spawnCells(run.layout, room);
  if (avoid) {
    const far = cells.filter((c) => distanceXZ(cellToWorld(c.i, c.j), avoid) >= 3.5);
    if (far.length >= count) cells = far;
  }
  const ids: EntityId[] = [];
  for (let n = 0; n < count && cells.length; n++) {
    const cell = cells.splice(Math.floor(rand() * cells.length), 1)[0]!;
    ids.push(spawnDungeonEnemy(world, run, pickKind(rand), cellToWorld(cell.i, cell.j)).id);
  }
  return ids;
}

/** Monta um andar: inimigos e eventos por sala, guardião ou chefe, baús laterais, santuários, armadilhas. */
function populateFloor(world: World, run: DungeonRun): void {
  const { layout } = run;
  const rand = seededRandom(run.seed * 13 + run.floor * 101);
  run.roomEnemies = {};
  run.clearedRooms = [];
  run.pending = {};
  run.sideChests = [];
  run.shrines = [];
  run.guardianId = run.bossId = null;
  run.stairs = null;
  run.stairsOpen = false;
  run.exitPortal = null;
  run.chest = null;
  run.flow = null;

  layout.rooms.forEach((room, index) => {
    const base = 3 + Math.floor(rand() * 3) + (run.floor > 1 || index >= 4 ? 1 : 0);
    if (room.kind === "combat") {
      if (room.event === "ambush") {
        run.roomEnemies[room.id] = [];
        run.pending[room.id] = { event: "ambush", count: base + 1, wavesLeft: 0 };
      } else if (room.event === "waves") {
        run.roomEnemies[room.id] = spawnInRoom(world, run, room, Math.max(2, base - 1), rand);
        run.pending[room.id] = { event: "waves", count: base, wavesLeft: 1 };
      } else {
        run.roomEnemies[room.id] = spawnInRoom(world, run, room, room.event === "traps" ? Math.max(2, base - 1) : base, rand);
      }
    }
    if (room.kind === "treasure") run.sideChests.push({ position: roomCenterWorld(room), opened: false });
    if (room.kind === "shrine") run.shrines.push({ position: roomCenterWorld(room), used: false });
    if (room.kind === "stairs") {
      const c = roomCenterWorld(room);
      // A escada ocupa um poço de 2×2 células a leste do centro (sólido: ninguém anda por cima).
      const si = Math.floor(c.x - DUNGEON_ORIGIN.x) + 2, sj = Math.floor(c.z - DUNGEON_ORIGIN.z) - 1;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) layout.tiles[(sj + dj) * layout.width + si + di] = Tile.Pillar;
      run.stairs = { x: DUNGEON_ORIGIN.x + si + 1, y: 0, z: DUNGEON_ORIGIN.z + sj + 1 };
      // O guardião espera no meio da sala, com dois esqueletos de escolta.
      const g = spawnDungeonEnemy(world, run, "skeleton", { x: c.x - 1, y: 0, z: c.z });
      g.name = GUARDIAN.name;
      g.miniboss = true;
      g.level = run.level + 1;
      g.health.baseMax = g.health.max = g.health.current = Math.round(g.health.max * GUARDIAN.health);
      g.combat.baseDamage = g.combat.damage = Math.round(g.combat.damage * GUARDIAN.damage);
      g.ai!.xpReward *= GUARDIAN.xp;
      g.ai!.goldReward *= 4;
      g.ai!.aggroRange = 9;
      run.guardianId = g.id;
      run.roomEnemies[room.id] = [g.id, ...spawnInRoom(world, run, room, 2, rand)];
    }
    if (room.kind === "boss") {
      const boss = world.spawn((id) => createSkeletonLord(id, roomCenterWorld(room), run.level));
      run.bossId = boss.id;
    }
  });
  const startRoom = layout.rooms.find((r) => r.kind === "start")!;
  const start = roomCenterWorld(startRoom);
  run.startPortal = { x: start.x - 3.5, y: 0, z: start.z };
}

/** Abre a cripta: gera o primeiro andar, povoa as salas e leva o herói para dentro. */
export function enterDungeon(world: World, player: Entity, seed = Math.floor(world.random() * 1e9)): DungeonRun {
  if (world.dungeon) closeDungeon(world);
  const level = Math.max(1, player.progression?.level ?? 1);
  const run: DungeonRun = {
    seed,
    level,
    floor: 1,
    floors: DUNGEON_FLOORS,
    layout: generateLayout(seed, 1),
    livesLeft: DUNGEON_LIVES,
    returnPoint: { x: DUNGEON_ENTRANCE.x, y: terrainHeight(DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z + 3), z: DUNGEON_ENTRANCE.z + 3 },
    roomEnemies: {},
    clearedRooms: [],
    pending: {},
    guardianId: null,
    bossId: null,
    bossDefeated: false,
    stairs: null,
    stairsOpen: false,
    chest: null,
    sideChests: [],
    shrines: [],
    trapClock: 0,
    trapHit: [],
    startPortal: { x: 0, y: 0, z: 0 },
    exitPortal: null,
    failed: false,
    flow: null,
  };
  world.dungeon = run;
  populateFloor(world, run);
  placeAtStart(player, run);
  world.emit({ type: "dungeonEnter", level, rooms: combatRooms(run).length });
  return run;
}

const combatRooms = (run: DungeonRun) => run.layout.rooms.filter((r) => r.kind === "combat" || r.kind === "stairs");

function placeAtStart(player: Entity, run: DungeonRun): void {
  player.transform.position = roomCenterWorld(run.layout.rooms[0]!);
  player.transform.yaw = -Math.PI / 2; // olhando para o leste, rumo às salas
}

/** Tira da região da cripta tudo que não é o herói (inimigos, drops, poças e projéteis). */
function clearDungeonSpace(world: World): void {
  for (const e of [...world.entities.values()]) {
    if (e.kind !== "player" && inDungeonSpace(e.transform.position.x)) world.despawn(e.id);
  }
  for (const d of [...world.drops.values()]) if (inDungeonSpace(d.position.x)) world.drops.delete(d.id);
  for (const h of [...world.hazards.values()]) if (inDungeonSpace(h.position.x)) world.hazards.delete(h.id);
  for (const p of [...world.projectiles.values()]) if (inDungeonSpace(p.position.x)) world.projectiles.delete(p.id);
}

/** Desce a escada: o andar de cima some (inclusive o loot no chão) e o próximo é gerado. */
export function descend(world: World, player: Entity): boolean {
  const run = world.dungeon;
  if (!run || !run.stairsOpen || run.floor >= run.floors) return false;
  clearDungeonSpace(world);
  run.floor++;
  run.layout = generateLayout(run.seed, run.floor);
  populateFloor(world, run);
  placeAtStart(player, run);
  world.emit({ type: "dungeonFloor", floor: run.floor, floors: run.floors });
  return true;
}

/** Desfaz a cripta. */
export function closeDungeon(world: World): void {
  clearDungeonSpace(world);
  world.dungeon = undefined;
}

/** Sai pela porta: volta para a frente do portal de entrada. */
export function exitDungeon(world: World, player: Entity, reason: "complete" | "leave" | "failed"): void {
  const run = world.dungeon;
  if (!run) return;
  player.transform.position = { ...run.returnPoint };
  closeDungeon(world);
  world.emit({ type: "dungeonExit", reason });
}

/** Onde o herói renasce: na sala inicial do andar enquanto houver vidas; sem vidas, no santuário. */
export function playerRespawnPoint(world: World, player: Entity): Vec3 {
  const run = world.dungeon;
  if (!run || !inDungeonSpace(player.transform.position.x)) {
    // Fora da cripta: renasce no ponto seguro da zona (santuário no vale, acampamento na floresta).
    const zone = zoneAt(player.transform.position.x, player.transform.position.z);
    return { x: zone.respawn.x, y: terrainHeight(zone.respawn.x, zone.respawn.z), z: zone.respawn.z };
  }
  run.livesLeft = Math.max(0, run.livesLeft - 1);
  world.emit({ type: "dungeonLifeLost", livesLeft: run.livesLeft });
  if (run.livesLeft > 0) return roomCenterWorld(run.layout.rooms[0]!);
  run.failed = true;
  return { x: 0, y: 0, z: 0 };
}

/** Fase das armadilhas no ciclo: aviso (os espinhos tremem) e janela em que ferem. */
export function trapPhase(clock: number): { warning: boolean; active: boolean; raise: number } {
  const t = clock % TRAP.cycle;
  const active = t >= TRAP.warn && t < TRAP.warn + TRAP.active;
  const warning = t < TRAP.warn;
  // Altura dos espinhos (0 escondido, 1 em pé), com subida rápida e descida mais lenta.
  const raise = active ? 1 : t >= TRAP.warn + TRAP.active && t < TRAP.warn + TRAP.active + 0.4 ? 1 - (t - TRAP.warn - TRAP.active) / 0.4 : warning ? Math.max(0, (t - TRAP.warn + 0.25) / 0.25) * 0.15 : 0;
  return { warning, active, raise };
}

function inRoom(room: DungeonRoom, p: Vec3, margin = 0): boolean {
  const c = cellOf(p.x, p.z);
  return c.i >= room.i0 + margin && c.i < room.i1 - margin && c.j >= room.j0 + margin && c.j < room.j1 - margin;
}

/**
 * A cada passo: campo de fluxo, armadilhas, emboscadas e ondas, salas limpas, escada aberta, vitória
 * sobre o chefe e fracasso (sem vidas).
 */
export function dungeonSystem(world: World, dt = 0): void {
  const run = world.dungeon;
  if (!run) return;
  const player = world.player;

  if (run.failed && player && !player.respawn) {
    // Renasceu no santuário depois de perder a última vida: a cripta se fecha.
    closeDungeon(world);
    world.emit({ type: "dungeonExit", reason: "failed" });
    return;
  }
  const here = player && inDungeonSpace(player.transform.position.x) ? player : undefined;

  // Campo de fluxo até o herói, refeito quando ele muda de célula.
  if (here) {
    const c = cellOf(here.transform.position.x, here.transform.position.z);
    const target = c.j * run.layout.width + c.i;
    if (!run.flow || run.flow.target !== target) run.flow = buildFlowField(run.layout, c.i, c.j);
  }

  // Armadilhas: na janela ativa, ferem uma vez quem estiver em cima (herói e inimigos).
  const before = trapPhase(run.trapClock);
  run.trapClock += dt;
  const phase = trapPhase(run.trapClock);
  if (phase.active && !before.active) {
    run.trapHit = [];
    world.emit({ type: "trapSpring" });
  }
  if (phase.active && here) {
    for (const e of world.alive()) {
      if (!inDungeonSpace(e.transform.position.x) || run.trapHit.includes(e.id)) continue;
      const c = cellOf(e.transform.position.x, e.transform.position.z);
      if (tileOf(run.layout, c.i, c.j) !== Tile.Trap) continue;
      run.trapHit.push(e.id);
      applyDamage(world, e.kind === "player" ? e : here, e, Math.max(1, Math.round(e.health.max * TRAP.damageFraction)), "hazard");
    }
  }

  // Emboscadas (herói entrou na sala) e ondas (a anterior caiu).
  const rand = world.random;
  for (const [roomId, pend] of Object.entries(run.pending)) {
    const id = Number(roomId);
    const room = run.layout.rooms[id]!;
    const ids = run.roomEnemies[id] ?? [];
    const alive = ids.some((eid) => (world.get(eid)?.health.current ?? 0) > 0);
    if (pend.event === "ambush" && here && inRoom(room, here.transform.position, 2)) {
      run.roomEnemies[id] = [...ids, ...spawnInRoom(world, run, room, pend.count, rand, here.transform.position)];
      for (const eid of run.roomEnemies[id]!) {
        const e = world.get(eid);
        if (e?.ai) e.ai.state = "chase";
      }
      delete run.pending[id];
      world.emit({ type: "ambush", room: id });
    } else if (pend.event === "waves" && !alive && ids.length > 0) {
      run.roomEnemies[id] = spawnInRoom(world, run, room, pend.count, rand, here?.transform.position);
      for (const eid of run.roomEnemies[id]!) {
        const e = world.get(eid);
        if (e?.ai) e.ai.state = "chase";
      }
      pend.wavesLeft--;
      if (pend.wavesLeft <= 0) delete run.pending[id];
      world.emit({ type: "wave", room: id });
    }
  }

  const total = combatRooms(run).length;
  for (const [roomId, ids] of Object.entries(run.roomEnemies)) {
    const id = Number(roomId);
    if (run.clearedRooms.includes(id) || run.pending[id] || ids.length === 0) continue;
    if (ids.every((eid) => (world.get(eid)?.health.current ?? 0) <= 0)) {
      run.clearedRooms.push(id);
      world.emit({ type: "roomCleared", cleared: run.clearedRooms.length, total });
    }
  }

  if (run.guardianId !== null && !run.stairsOpen && (world.get(run.guardianId)?.health.current ?? 0) <= 0) {
    run.stairsOpen = true;
    world.emit({ type: "stairsOpen" });
  }

  const boss = run.bossId !== null ? world.get(run.bossId) : undefined;
  if (!run.bossDefeated && boss && boss.health.current <= 0) {
    run.bossDefeated = true;
    const room = run.layout.rooms.find((r) => r.kind === "boss")!;
    const c = roomCenterWorld(room);
    run.chest = { position: { x: c.x, y: 0, z: c.z - 3 }, opened: false };
    run.exitPortal = { x: c.x + 5, y: 0, z: c.z };
    world.emit({ type: "dungeonComplete", level: run.level });
  }
}

/** Baú do fim: ouro direto na bolsa, dois equipamentos raros ou épicos e poções grandes. */
export function openChest(world: World, player: Entity): boolean {
  const run = world.dungeon;
  const chest = run?.chest;
  if (!run || !chest || chest.opened || distanceXZ(player.transform.position, chest.position) > PORTAL_RANGE) return false;
  chest.opened = true;
  const rand = world.random;
  const tier = stockTier(run.level);
  const gold = Math.round((120 + 25 * run.level) * (1 + (player.bonuses?.goldPercent ?? 0) / 100));
  if (player.wallet) player.wallet.gold += gold;
  const at = (dx: number, dz: number) => ({ x: chest.position.x + dx, y: 0, z: chest.position.z + dz });
  const items = [
    createEquipment(rand, tier, rand() < 0.35 ? "epic" : "rare", run.level),
    createEquipment(rand, tier, rollRarity(rand, tier) === "common" ? "rare" : rand() < 0.5 ? "rare" : "epic", run.level),
    createPotion("large", 2),
  ];
  items.forEach((item, i) => world.addDrop(item, at((i - 1) * 1.4, -1.2)));
  world.emit({ type: "chestOpened", gold, items: items.map((i) => i.name) });
  return true;
}

/** Baú de sala de tesouro: menos que o do chefe, mas sempre um item raro. */
export function openSideChest(world: World, player: Entity): boolean {
  const run = world.dungeon;
  const chest = run?.sideChests.find((c) => !c.opened && distanceXZ(player.transform.position, c.position) <= PORTAL_RANGE);
  if (!run || !chest) return false;
  chest.opened = true;
  const rand = world.random;
  const gold = Math.round((40 + 10 * run.level) * (1 + (player.bonuses?.goldPercent ?? 0) / 100));
  if (player.wallet) player.wallet.gold += gold;
  const items = [createEquipment(rand, stockTier(run.level), rand() < 0.2 ? "epic" : "rare", run.level), createPotion(rand() < 0.5 ? "large" : "small")];
  items.forEach((item, i) => world.addDrop(item, { x: chest.position.x + (i - 0.5) * 1.4, y: 0, z: chest.position.z - 1.2 }));
  world.emit({ type: "chestOpened", gold, items: items.map((i) => i.name) });
  return true;
}

/** Santuário: cura tudo e dá a bênção (dano extra por um minuto). Uma vez por santuário. */
export function useShrine(world: World, player: Entity): boolean {
  const run = world.dungeon;
  const shrine = run?.shrines.find((s) => !s.used && distanceXZ(player.transform.position, s.position) <= PORTAL_RANGE);
  if (!shrine || !player.abilities) return false;
  shrine.used = true;
  player.health.current = player.health.max;
  player.abilities.damageBuff = { multiplier: SHRINE_BLESSING.multiplier, timeLeft: SHRINE_BLESSING.seconds };
  world.emit({ type: "shrineBlessing", entity: player.id, seconds: SHRINE_BLESSING.seconds });
  return true;
}

export type DungeonInteraction = "enter" | "leave" | "exit" | "chest" | "sideChest" | "shrine" | "stairs" | "stairsLocked" | null;

/** O que o herói pode fazer com F agora, perto de portais, baús, santuários e da escada. */
export function dungeonInteraction(world: World, player: Entity): DungeonInteraction {
  const p = player.transform.position;
  const run = world.dungeon;
  if (!run) {
    const portal = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
    return distanceXZ(p, portal) <= PORTAL_RANGE ? "enter" : null;
  }
  if (run.chest && !run.chest.opened && distanceXZ(p, run.chest.position) <= PORTAL_RANGE) return "chest";
  if (run.sideChests.some((c) => !c.opened && distanceXZ(p, c.position) <= PORTAL_RANGE)) return "sideChest";
  if (run.shrines.some((s) => !s.used && distanceXZ(p, s.position) <= PORTAL_RANGE)) return "shrine";
  if (run.stairs && distanceXZ(p, run.stairs) <= PORTAL_RANGE) return run.stairsOpen ? "stairs" : "stairsLocked";
  if (run.exitPortal && distanceXZ(p, run.exitPortal) <= PORTAL_RANGE) return "exit";
  if (run.floor === 1 && distanceXZ(p, run.startPortal) <= PORTAL_RANGE) return "leave";
  return null;
}
