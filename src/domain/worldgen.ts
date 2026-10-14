import { createEnemy, createPlayer, type EnemyKind } from "./factories";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "./terrain";
import { World } from "./world";
import { createGoblinKing } from "./boss";

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
}

/**
 * Popula o mundo em anéis de dificuldade: gosmas perto do spawn, goblins no meio, orcs na borda.
 * O jogador aprende o combate com segurança e sente a progressão ao se afastar.
 */
export function generateWorld(options: WorldGenOptions = {}): World {
  const rand = seededRandom(options.seed ?? 1337);
  const world = new World();
  world.random = seededRandom((options.seed ?? 1337) * 7919 + 17);
  world.spawn((id) => createPlayer(id, { x: 0, y: terrainHeight(0, 0), z: 0 }));

  const rings: { kind: EnemyKind; min: number; max: number; count: number }[] = [
    { kind: "slime", min: SPAWN_FLAT_RADIUS + 4, max: 40, count: 16 },
    { kind: "goblin", min: 40, max: 70, count: 16 },
    { kind: "orc", min: 70, max: WORLD_HALF - 22, count: 10 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = ring.min + rand() * (ring.max - ring.min);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < BOSS_ARENA_RADIUS) continue; // arena limpa
      world.spawn((id) => createEnemy(id, ring.kind, { x, y: terrainHeight(x, z), z }));
    }
  }
  world.spawn((id) => createGoblinKing(id, { x: BOSS_HOME.x, y: terrainHeight(BOSS_HOME.x, BOSS_HOME.z), z: BOSS_HOME.z }));
  return world;
}
