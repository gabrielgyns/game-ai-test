import type { Entity, EntityId } from "./components";
import { vec3, type Vec3 } from "./math";
import { xpForLevel } from "./progression";
import { createEquipment as createEquipmentSlots, createInventory, recomputeStats } from "./inventory";
import { createPotion } from "./items";
import { createAbilities } from "./skills";
import { CLASSES, type ClassId } from "./classes";

export function createPlayer(id: EntityId, position: Vec3, classId: ClassId = "warrior"): Entity {
  const c = CLASSES[classId];
  const player: Entity = {
    id,
    kind: "player",
    name: c.name,
    archetype: "hero",
    classId,
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: c.speed, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: c.baseMaxHealth, max: c.baseMaxHealth, baseMax: c.baseMaxHealth, regenPerSecond: c.regenPerSecond, lastDamagedAt: -Infinity },
    combat: { damage: c.baseDamage, baseDamage: c.baseDamage, range: c.attackRange, cooldown: c.attackCooldown, cooldownLeft: 0, wantsAttack: false, windupTime: 0, windupLeft: 0 },
    progression: { level: 1, xp: 0, xpToNext: xpForLevel(1) },
    wallet: { gold: 0 },
    inventory: createInventory(20),
    equipment: createEquipmentSlots(),
    abilities: createAbilities(c.skills),
    quests: {},
    stats: { kills: 0 },
    talents: {},
  };
  player.equipment!.weapon = c.starterWeapon();
  player.inventory!.items[0] = createPotion("small", 2);
  recomputeStats(player);
  player.health.current = player.health.max;
  return player;
}

export interface EnemyTemplate {
  name: string;
  archetype: string;
  maxHealth: number;
  damage: number;
  speed: number;
  range: number;
  cooldown: number;
  aggroRange: number;
  /** Segundos de aviso (telegraph) entre começar o ataque e o golpe acertar. */
  windup: number;
  xpReward: number;
  goldReward: number;
  /** Atiradores: golpe básico à distância e distância que tentam manter. */
  ranged?: { projectile: "arrow" | "bolt"; keepDistance: number };
}

export const ENEMY_TEMPLATES = {
  slime: {
    name: "Gosma",
    archetype: "slime",
    maxHealth: 30,
    damage: 4,
    speed: 3.2,
    range: 1.6,
    cooldown: 1.2,
    windup: 0.6,
    aggroRange: 9,
    xpReward: 15,
    goldReward: 3,
  },
  goblin: {
    name: "Goblin",
    archetype: "goblin",
    maxHealth: 55,
    damage: 8,
    speed: 5,
    range: 1.8,
    cooldown: 1.0,
    windup: 0.45,
    aggroRange: 13,
    xpReward: 32,
    goldReward: 7,
  },
  orc: {
    name: "Orc",
    archetype: "orc",
    maxHealth: 140,
    damage: 18,
    speed: 4.2,
    range: 2.2,
    cooldown: 1.5,
    windup: 0.85,
    aggroRange: 15,
    xpReward: 90,
    goldReward: 20,
  },
  spider: {
    name: "Aranha",
    archetype: "spider",
    maxHealth: 70,
    damage: 11,
    speed: 6.2,
    range: 1.8,
    cooldown: 0.9,
    windup: 0.35,
    aggroRange: 14,
    xpReward: 48,
    goldReward: 9,
  },
  bogZombie: {
    name: "Zumbi do Lodo",
    archetype: "bogZombie",
    maxHealth: 220,
    damage: 22,
    speed: 2.6,
    range: 2.2,
    cooldown: 1.8,
    windup: 1.0,
    aggroRange: 11,
    xpReward: 110,
    goldReward: 24,
  },
  scorpion: {
    name: "Escorpião",
    archetype: "scorpion",
    maxHealth: 120,
    damage: 20,
    speed: 5.6,
    range: 2.0,
    cooldown: 1.1,
    windup: 0.3,
    aggroRange: 13,
    xpReward: 95,
    goldReward: 20,
  },
  bandit: {
    name: "Salteador",
    archetype: "bandit",
    maxHealth: 160,
    damage: 17,
    speed: 5.8,
    range: 2.2,
    cooldown: 0.8,
    windup: 0.45,
    aggroRange: 16,
    xpReward: 120,
    goldReward: 40,
  },
  skeleton: {
    name: "Esqueleto",
    archetype: "skeleton",
    maxHealth: 90,
    damage: 13,
    speed: 4.8,
    range: 2.0,
    cooldown: 1.1,
    windup: 0.55,
    aggroRange: 11,
    xpReward: 55,
    goldReward: 12,
  },
  skeletonArcher: {
    name: "Esqueleto Arqueiro",
    archetype: "skeletonArcher",
    maxHealth: 65,
    damage: 12,
    speed: 4.4,
    range: 13,
    cooldown: 2.4,
    windup: 0.7,
    aggroRange: 13,
    xpReward: 60,
    goldReward: 13,
    ranged: { projectile: "arrow", keepDistance: 7 },
  },
  goblinArcher: {
    name: "Goblin Arqueiro",
    archetype: "goblinArcher",
    maxHealth: 42,
    damage: 9,
    speed: 4.6,
    range: 13,
    cooldown: 2.6,
    windup: 0.75,
    aggroRange: 16,
    xpReward: 36,
    goldReward: 8,
    ranged: { projectile: "arrow", keepDistance: 7 },
  },
  banditArcher: {
    name: "Salteador Arqueiro",
    archetype: "banditArcher",
    maxHealth: 120,
    damage: 19,
    speed: 5.4,
    range: 15,
    cooldown: 2.3,
    windup: 0.7,
    aggroRange: 19,
    xpReward: 125,
    goldReward: 42,
    ranged: { projectile: "arrow", keepDistance: 8 },
  },
} as const satisfies Record<string, EnemyTemplate>;

export type EnemyKind = keyof typeof ENEMY_TEMPLATES;

export function createEnemy(id: EntityId, kind: EnemyKind, position: Vec3): Entity {
  const t: EnemyTemplate = ENEMY_TEMPLATES[kind];
  const enemy: Entity = {
    id,
    kind: "enemy",
    name: t.name,
    archetype: t.archetype,
    transform: { position: { ...position }, yaw: Math.random() * Math.PI * 2 },
    movement: { speed: t.speed, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: t.maxHealth, max: t.maxHealth, baseMax: t.maxHealth, regenPerSecond: 2, lastDamagedAt: -Infinity },
    combat: { damage: t.damage, baseDamage: t.damage, range: t.range, cooldown: t.cooldown, cooldownLeft: 0, wantsAttack: false, windupTime: t.windup, windupLeft: 0 },
    ai: {
      state: "idle",
      home: vec3(position.x, position.y, position.z),
      aggroRange: t.aggroRange,
      leashRange: 28,
      xpReward: t.xpReward,
      goldReward: t.goldReward,
      respawnSeconds: 25,
      keepDistance: t.ranged?.keepDistance,
    },
  };
  if (t.ranged) {
    // Tiro avisado por uma linha no chão: sair dela de lado evita a flecha.
    enemy.combat.basicPattern = { id: "shot", name: "Flechada", kind: "projectile", projectile: t.ranged.projectile, range: t.range, windup: t.windup, damageMultiplier: 1, cooldown: t.cooldown, minPhase: 1 };
  }
  return enemy;
}
