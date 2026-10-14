import { createSkeletonLord } from "./boss";
import type { Entity, EntityId } from "./components";
import { generateLayout, roomCenter, Tile, tileOf, type DungeonLayout, type DungeonRoom } from "./dungeonLayout";
import { createEnemy, type EnemyKind } from "./factories";
import { createEquipment, createPotion, rollRarity } from "./items";
import { distanceXZ, type Vec3 } from "./math";
import { stockTier } from "./shop";
import { DUNGEON_REGION_X, terrainHeight } from "./terrain";
import { seededRandom } from "./worldgen";
import type { World } from "./world";

/**
 * Dungeons instanciadas, no estilo Minecraft Dungeons: um portal no mapa leva a uma cripta gerada na
 * hora (planta nova a cada entrada), com salas de combate, um chefe, um baú de loot garantido e três
 * vidas. Ao sair (vitória, desistência ou sem vidas), tudo que era da cripta some.
 *
 * A cripta vive no mesmo `World`, numa região distante (x ≥ 1000), como um set de filmagem montado
 * nos fundos do estúdio: os sistemas continuam os mesmos, só passam a respeitar paredes.
 */
export const DUNGEON_NAME = "Cripta Esquecida";
export const DUNGEON_ORIGIN = { x: 1000, z: -48 };
/** Portal de entrada no mapa (campina a nordeste do santuário). */
export const DUNGEON_ENTRANCE = { x: 24, z: -30 };
export const DUNGEON_LIVES = 3;
export const PORTAL_RANGE = 2.6;

export interface DungeonRun {
  seed: number;
  level: number;
  layout: DungeonLayout;
  livesLeft: number;
  /** Onde o herói volta ao sair (na frente do portal de entrada). */
  returnPoint: Vec3;
  /** Inimigos de cada sala de combate (índice da sala → ids). */
  roomEnemies: Record<number, EntityId[]>;
  clearedRooms: number[];
  bossId: EntityId;
  bossDefeated: boolean;
  chest: { position: Vec3; opened: boolean } | null;
  /** Portal de saída da sala inicial (sempre ativo) e da sala do chefe (depois da vitória). */
  startPortal: Vec3;
  exitPortal: Vec3 | null;
  failed: boolean;
}

/** Centro, no mundo, de uma célula da planta. */
export function cellToWorld(i: number, j: number): Vec3 {
  return { x: DUNGEON_ORIGIN.x + i + 0.5, y: 0, z: DUNGEON_ORIGIN.z + j + 0.5 };
}

export function roomCenterWorld(r: DungeonRoom): Vec3 {
  const c = roomCenter(r);
  return { x: DUNGEON_ORIGIN.x + c.i, y: 0, z: DUNGEON_ORIGIN.z + c.j };
}

export const inDungeonSpace = (x: number): boolean => x >= DUNGEON_REGION_X;

/** Dá para pisar aqui? Fora da região da cripta, sempre; dentro, só no chão da planta ativa. */
export function isWalkable(world: World, x: number, z: number): boolean {
  if (!inDungeonSpace(x)) return true;
  const run = world.dungeon;
  if (!run) return false;
  return tileOf(run.layout, Math.floor(x - DUNGEON_ORIGIN.x), Math.floor(z - DUNGEON_ORIGIN.z)) === Tile.Floor;
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

/** Células de chão livres de uma sala, longe das bordas (onde chegam os corredores). */
function spawnCells(layout: DungeonLayout, r: DungeonRoom): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  for (let j = r.j0 + 2; j < r.j1 - 2; j++)
    for (let i = r.i0 + 2; i < r.i1 - 2; i++) if (tileOf(layout, i, j) === Tile.Floor) out.push({ i, j });
  return out;
}

/** Abre a cripta: gera a planta, povoa as salas, põe o chefe e leva o herói para dentro. */
export function enterDungeon(world: World, player: Entity, seed = Math.floor(world.random() * 1e9)): DungeonRun {
  if (world.dungeon) closeDungeon(world);
  const level = Math.max(1, player.progression?.level ?? 1);
  const layout = generateLayout(seed);
  const rand = seededRandom(seed + 101);
  const scale = levelScale(level);
  const tier = stockTier(level);
  const roomEnemies: Record<number, EntityId[]> = {};

  const combat = layout.rooms.filter((r) => r.kind === "combat");
  combat.forEach((room, index) => {
    const cells = spawnCells(layout, room);
    const count = 3 + Math.floor(rand() * 3) + (index >= 3 ? 1 : 0);
    roomEnemies[room.id] = [];
    for (let n = 0; n < count && cells.length; n++) {
      const cell = cells.splice(Math.floor(rand() * cells.length), 1)[0]!;
      const at = cellToWorld(cell.i, cell.j);
      const e = world.spawn((id) => createEnemy(id, pickKind(rand), at));
      e.health.baseMax = e.health.max = e.health.current = Math.round(e.health.max * scale);
      e.level = level; // a cripta acompanha o herói
      e.combat.baseDamage = e.combat.damage = Math.round(e.combat.damage * scale);
      const ai = e.ai!;
      ai.xpReward = Math.round(ai.xpReward * scale);
      ai.goldReward = Math.round(ai.goldReward * scale);
      ai.respawnSeconds = Infinity; // instanciado: quem morre aqui não volta
      ai.leashRange = 18;
      ai.aggroRange = Math.min(ai.aggroRange, 11);
      ai.needsSight = true;
      ai.lootTier = tier;
      roomEnemies[room.id]!.push(e.id);
    }
  });

  const bossRoom = layout.rooms.find((r) => r.kind === "boss")!;
  const boss = world.spawn((id) => createSkeletonLord(id, roomCenterWorld(bossRoom), level));
  const startRoom = layout.rooms.find((r) => r.kind === "start")!;
  const start = roomCenterWorld(startRoom);

  const run: DungeonRun = {
    seed,
    level,
    layout,
    livesLeft: DUNGEON_LIVES,
    returnPoint: { x: DUNGEON_ENTRANCE.x, y: terrainHeight(DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z + 3), z: DUNGEON_ENTRANCE.z + 3 },
    roomEnemies,
    clearedRooms: [],
    bossId: boss.id,
    bossDefeated: false,
    chest: null,
    startPortal: { x: start.x - 3.5, y: 0, z: start.z },
    exitPortal: null,
    failed: false,
  };
  world.dungeon = run;
  player.transform.position = { ...start };
  player.transform.yaw = -Math.PI / 2; // olhando para o leste, rumo às salas
  world.emit({ type: "dungeonEnter", level, rooms: combat.length });
  return run;
}

/** Desfaz a cripta: tira inimigos, drops, poças e projéteis da região. */
export function closeDungeon(world: World): void {
  for (const e of [...world.entities.values()]) {
    if (e.kind !== "player" && inDungeonSpace(e.transform.position.x)) world.despawn(e.id);
  }
  for (const d of [...world.drops.values()]) if (inDungeonSpace(d.position.x)) world.drops.delete(d.id);
  for (const h of [...world.hazards.values()]) if (inDungeonSpace(h.position.x)) world.hazards.delete(h.id);
  for (const p of [...world.projectiles.values()]) if (inDungeonSpace(p.position.x)) world.projectiles.delete(p.id);
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

/** Onde o herói renasce: na sala inicial enquanto houver vidas; sem vidas, no santuário. */
export function playerRespawnPoint(world: World, player: Entity): Vec3 {
  const run = world.dungeon;
  if (!run || !inDungeonSpace(player.transform.position.x)) return { x: 0, y: 0, z: 0 };
  run.livesLeft = Math.max(0, run.livesLeft - 1);
  world.emit({ type: "dungeonLifeLost", livesLeft: run.livesLeft });
  if (run.livesLeft > 0) return roomCenterWorld(run.layout.rooms.find((r) => r.kind === "start")!);
  run.failed = true;
  return { x: 0, y: 0, z: 0 };
}

/** Salas limpas, vitória sobre o chefe (baú e portal de saída) e fracasso (sem vidas). */
export function dungeonSystem(world: World): void {
  const run = world.dungeon;
  if (!run) return;
  const player = world.player;

  if (run.failed && player && !player.respawn) {
    // Renasceu no santuário depois de perder a última vida: a cripta se fecha.
    closeDungeon(world);
    world.emit({ type: "dungeonExit", reason: "failed" });
    return;
  }

  const total = Object.keys(run.roomEnemies).length;
  for (const [roomId, ids] of Object.entries(run.roomEnemies)) {
    const id = Number(roomId);
    if (run.clearedRooms.includes(id)) continue;
    if (ids.every((eid) => (world.get(eid)?.health.current ?? 0) <= 0)) {
      run.clearedRooms.push(id);
      world.emit({ type: "roomCleared", cleared: run.clearedRooms.length, total });
    }
  }

  const boss = world.get(run.bossId);
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

export type DungeonInteraction = "enter" | "leave" | "exit" | "chest" | null;

/** O que o herói pode fazer com F agora, perto de portais e do baú. */
export function dungeonInteraction(world: World, player: Entity): DungeonInteraction {
  const p = player.transform.position;
  const run = world.dungeon;
  if (!run) {
    const portal = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
    return distanceXZ(p, portal) <= PORTAL_RANGE ? "enter" : null;
  }
  if (run.chest && !run.chest.opened && distanceXZ(p, run.chest.position) <= PORTAL_RANGE) return "chest";
  if (run.exitPortal && distanceXZ(p, run.exitPortal) <= PORTAL_RANGE) return "exit";
  if (distanceXZ(p, run.startPortal) <= PORTAL_RANGE) return "leave";
  return null;
}
