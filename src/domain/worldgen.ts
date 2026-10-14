import { createEnemy, createPlayer, type EnemyKind } from "./factories";
import { FOREST_BOSS_HOME, FOREST_CAMP, isIce, isLava, isWater, VOLCANO_CALDERA, VOLCANO_FORGE, VOLCANO_FORT, PEAKS_BOSS_HOME, PEAKS_CAVE, PEAKS_LAKE, PEAKS_VILLAGE, terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "./terrain";
import { ZONES } from "./zones";
import { World } from "./world";
import { createAncientTreant, createFireLord, createFrostGiant, createGoblinKing, createScorpionEmperor, createSpiderQueen } from "./boss";
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
  populateForest(world, rand);
  populatePeaks(world, rand);
  populateVolcano(world, rand);
  return world;
}

/**
 * Floresta Ancestral: lobos em matilhas pela mata, entes na mata funda (oeste e norte), espíritos
 * élficos nas ruínas a leste, a vila do acampamento (Guardiã Lyra, Mascate Faelan, Armeira Kaia) e o Ente Ancião na clareira ao norte.
 */
function populateForest(world: World, rand: () => number): void {
  const zone = ZONES.floresta;
  const at = (lx: number, lz: number) => {
    const x = zone.center.x + lx, z = zone.center.z + lz;
    return { x, y: terrainHeight(x, z), z };
  };
  const free = (lx: number, lz: number) => {
    const p = at(lx, lz);
    return (
      !isWater(p.x, p.z) &&
      Math.hypot(lx - FOREST_CAMP.x, lz - FOREST_CAMP.z) > 24 &&
      Math.hypot(lx - FOREST_BOSS_HOME.x, lz - FOREST_BOSS_HOME.z) > 22 &&
      Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 20
    );
  };
  const scatter = (kind: EnemyKind, count: number, area: (lx: number, lz: number) => boolean, pack = 1) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 40; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 20), lz = (rand() * 2 - 1) * (zone.half - 20);
      if (!free(lx, lz) || !area(lx, lz)) continue;
      for (let k = 0; k < pack && placed < count; k++) {
        const px = lx + (rand() - 0.5) * 5, pz = lz + (rand() - 0.5) * 5;
        if (!free(px, pz)) continue;
        world.spawn((id) => createEnemy(id, kind, at(px, pz)));
        placed++;
      }
    }
  };
  scatter("wolf", 24, (lx) => lx < 45, 3);
  scatter("ent", 10, (lx, lz) => lx < 30 && lz < 50);
  scatter("elvenSpirit", 10, (lx) => lx > 45);
  scatter("elvenSpirit", 3, (lx) => lx < 45);
  // Vila do acampamento: cada um no seu canto, virado para a fogueira.
  for (const spot of [
    { id: "ranger", x: 4, z: -2 },
    { id: "peddler", x: -7, z: 4 },
    { id: "armorer", x: 7, z: -7 },
  ]) {
    const def = npcById(spot.id)!;
    world.spawn((id) => createNpc(id, def, at(FOREST_CAMP.x + spot.x, FOREST_CAMP.z + spot.z), Math.atan2(spot.x, spot.z)));
  }
  world.spawn((id) => createAncientTreant(id, at(FOREST_BOSS_HOME.x, FOREST_BOSS_HOME.z)));
}

/**
 * Picos Gelados: lobos das neves em matilha pelos vales, espectros no lago congelado e na encosta da
 * caverna, yetis nas cristas do norte, a vila de Pedra-Fria ao sul e o Gigante de Gelo no platô.
 */
function populatePeaks(world: World, rand: () => number): void {
  const zone = ZONES.picos;
  const at = (lx: number, lz: number) => {
    const x = zone.center.x + lx, z = zone.center.z + lz;
    return { x, y: terrainHeight(x, z), z };
  };
  const free = (lx: number, lz: number) =>
    Math.hypot(lx - PEAKS_VILLAGE.x, lz - PEAKS_VILLAGE.z) > 26 &&
    Math.hypot(lx - PEAKS_BOSS_HOME.x, lz - PEAKS_BOSS_HOME.z) > 24 &&
    Math.hypot(lx - PEAKS_CAVE.x, lz - PEAKS_CAVE.z) > 9 &&
    Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 20;
  const scatter = (kind: EnemyKind, count: number, area: (lx: number, lz: number) => boolean, pack = 1) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 20), lz = (rand() * 2 - 1) * (zone.half - 20);
      if (!free(lx, lz) || !area(lx, lz)) continue;
      for (let k = 0; k < pack && placed < count; k++) {
        const px = lx + (rand() - 0.5) * 5, pz = lz + (rand() - 0.5) * 5;
        if (!free(px, pz)) continue;
        world.spawn((id) => createEnemy(id, kind, at(px, pz)));
        placed++;
      }
    }
  };
  const onLake = (lx: number, lz: number) => isIce(zone.center.x + lx, zone.center.z + lz);
  scatter("snowWolf", 21, (lx, lz) => lz > -40 && !onLake(lx, lz), 3);
  scatter("iceWraith", 7, (lx, lz) => Math.hypot(lx - PEAKS_LAKE.x, lz - PEAKS_LAKE.z) < 30);
  scatter("iceWraith", 5, (lx, lz) => lx > 30 && lz < 20);
  scatter("yeti", 10, (lx, lz) => lz < 10 && !onLake(lx, lz));
  for (const spot of [
    { id: "jarl", x: 5, z: -3 },
    { id: "trader", x: -7, z: 4 },
    { id: "hunter", x: 8, z: 6 },
  ]) {
    const def = npcById(spot.id)!;
    world.spawn((id) => createNpc(id, def, at(PEAKS_VILLAGE.x + spot.x, PEAKS_VILLAGE.z + spot.z), Math.atan2(spot.x, spot.z)));
  }
  world.spawn((id) => createFrostGiant(id, at(PEAKS_BOSS_HOME.x, PEAKS_BOSS_HOME.z)));
}

/**
 * Terras Vulcânicas: cães de lava em bando pelos campos de basalto, piromantes perto dos rios de lava,
 * golens de magma ao norte, o Bastião de Brasa ao sul e o Senhor das Chamas na caldeira.
 */
function populateVolcano(world: World, rand: () => number): void {
  const zone = ZONES.vulcao;
  const at = (lx: number, lz: number) => {
    const x = zone.center.x + lx, z = zone.center.z + lz;
    return { x, y: terrainHeight(x, z), z };
  };
  const free = (lx: number, lz: number) =>
    !isLava(zone.center.x + lx, zone.center.z + lz) &&
    Math.hypot(lx - VOLCANO_FORT.x, lz - VOLCANO_FORT.z) > 26 &&
    Math.hypot(lx - VOLCANO_CALDERA.x, lz - VOLCANO_CALDERA.z) > 24 &&
    Math.hypot(lx - VOLCANO_FORGE.x, lz - VOLCANO_FORGE.z) > 9 &&
    Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 20;
  const scatter = (kind: EnemyKind, count: number, area: (lx: number, lz: number) => boolean, pack = 1) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 20), lz = (rand() * 2 - 1) * (zone.half - 20);
      if (!free(lx, lz) || !area(lx, lz)) continue;
      for (let k = 0; k < pack && placed < count; k++) {
        const px = lx + (rand() - 0.5) * 5, pz = lz + (rand() - 0.5) * 5;
        if (!free(px, pz)) continue;
        world.spawn((id) => createEnemy(id, kind, at(px, pz)));
        placed++;
      }
    }
  };
  scatter("lavaHound", 21, (_lx, lz) => lz > -40, 3);
  scatter("flameCaster", 12, (lx) => lx > 0);
  scatter("magmaGolem", 9, (_lx, lz) => lz < 15);
  for (const spot of [
    { id: "commander", x: 5, z: -3 },
    { id: "forgeSmith", x: -7, z: 4 },
    { id: "scout", x: 8, z: 6 },
  ]) {
    const def = npcById(spot.id)!;
    world.spawn((id) => createNpc(id, def, at(VOLCANO_FORT.x + spot.x, VOLCANO_FORT.z + spot.z), Math.atan2(spot.x, spot.z)));
  }
  world.spawn((id) => createFireLord(id, at(VOLCANO_CALDERA.x, VOLCANO_CALDERA.z)));
}
