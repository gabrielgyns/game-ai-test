import { createEnemy, createPlayer, type EnemyKind } from "./factories";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "./terrain";
import { World } from "./world";
import { createGoblinKing, createScorpionEmperor, createSpiderQueen } from "./boss";
import { biomeAt, DESERT_BOSS_HOME, SWAMP_BOSS_HOME } from "./biomes";
import { createNpc, npcById } from "./npc";
import type { ClassId } from "./classes";

/** Gerador pseudoaleatório determinístico (mulberry32) para o mundo ser igual a cada partida. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Centro da arena do chefe, no extremo norte do mapa. */
export const BOSS_HOME = { x: 0, z: -82 };
/** Raio livre de inimigos comuns em volta da arena. */
export const BOSS_ARENA_RADIUS = 16;

export interface WorldGenOptions {
  seed?: number;
  classId?: ClassId;
}

/**
 * Popula o mundo em anéis de dificuldade: gosmas perto do spawn, goblins no meio, orcs na borda.
 * O jogador aprende o combate com segurança e sente a progressão ao se afastar.
 */
export const DEFAULT_SEED = 1337;

export function generateWorld(options: WorldGenOptions = {}): World {
  const rand = seededRandom(options.seed ?? DEFAULT_SEED);
  const world = new World();
  world.random = seededRandom((options.seed ?? 1337) * 7919 + 17);
  world.spawn((id) => createPlayer(id, { x: 0, y: terrainHeight(0, 0), z: 0 }, options.classId ?? "warrior"));

  // NPCs do santuário, virados para o centro.
  const npcSpots: { id: string; x: number; z: number }[] = [
    { id: "elder", x: -4.5, z: -5.5 },
    { id: "smith", x: 5, z: -5 },
    { id: "guard", x: 0.5, z: 7.5 },
    { id: "merchant", x: 6, z: 3.5 },
  ];
  for (const spot of npcSpots) {
    const def = npcById(spot.id)!;
    const yaw = Math.atan2(-(0 - spot.x), -(0 - spot.z));
    world.spawn((id) => createNpc(id, def, { x: spot.x, y: terrainHeight(spot.x, spot.z), z: spot.z }, yaw));
  }

  const nearArena = (x: number, z: number) =>
    Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < BOSS_ARENA_RADIUS ||
    Math.hypot(x - SWAMP_BOSS_HOME.x, z - SWAMP_BOSS_HOME.z) < BOSS_ARENA_RADIUS ||
    Math.hypot(x - DESERT_BOSS_HOME.x, z - DESERT_BOSS_HOME.z) < BOSS_ARENA_RADIUS;

  // Campina: anéis de dificuldade em volta do santuário (só dentro do bioma).
  const rings: { kind: EnemyKind; min: number; max: number; count: number }[] = [
    { kind: "slime", min: SPAWN_FLAT_RADIUS + 4, max: 40, count: 16 },
    { kind: "goblin", min: 40, max: 70, count: 16 },
    { kind: "goblinArcher", min: 45, max: 72, count: 6 },
    { kind: "orc", min: 70, max: WORLD_HALF - 22, count: 10 },
  ];
  for (const ring of rings) {
    let placed = 0;
    for (let tries = 0; placed < ring.count && tries < ring.count * 20; tries++) {
      const angle = rand() * Math.PI * 2;
      const radius = ring.min + rand() * (ring.max - ring.min);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (biomeAt(x, z) !== "meadow" || nearArena(x, z)) continue;
      world.spawn((id) => createEnemy(id, ring.kind, { x, y: terrainHeight(x, z), z }));
      placed++;
    }
  }

  // Pântano (oeste) e deserto (leste): população própria.
  const regions: { kind: EnemyKind; count: number; minX: number; maxX: number }[] = [
    { kind: "spider", count: 14, minX: -WORLD_HALF + 14, maxX: -40 },
    { kind: "bogZombie", count: 8, minX: -WORLD_HALF + 14, maxX: -40 },
    { kind: "scorpion", count: 12, minX: 40, maxX: WORLD_HALF - 14 },
    { kind: "bandit", count: 8, minX: 40, maxX: WORLD_HALF - 14 },
    { kind: "banditArcher", count: 6, minX: 40, maxX: WORLD_HALF - 14 },
  ];
  for (const region of regions) {
    let placed = 0;
    for (let tries = 0; placed < region.count && tries < region.count * 20; tries++) {
      const x = region.minX + rand() * (region.maxX - region.minX);
      const z = (rand() * 2 - 1) * (WORLD_HALF - 14);
      if (nearArena(x, z)) continue;
      world.spawn((id) => createEnemy(id, region.kind, { x, y: terrainHeight(x, z), z }));
      placed++;
    }
  }
  world.spawn((id) => createGoblinKing(id, { x: BOSS_HOME.x, y: terrainHeight(BOSS_HOME.x, BOSS_HOME.z), z: BOSS_HOME.z }));
  world.spawn((id) => createSpiderQueen(id, { x: SWAMP_BOSS_HOME.x, y: terrainHeight(SWAMP_BOSS_HOME.x, SWAMP_BOSS_HOME.z), z: SWAMP_BOSS_HOME.z }));
  world.spawn((id) => createScorpionEmperor(id, { x: DESERT_BOSS_HOME.x, y: terrainHeight(DESERT_BOSS_HOME.x, DESERT_BOSS_HOME.z), z: DESERT_BOSS_HOME.z }));
  return world;
}
