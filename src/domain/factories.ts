import type { Entity, EntityId } from "./components";
import { vec3, type Vec3 } from "./math";
import { xpForLevel } from "./progression";
import { createEquipment as createEquipmentSlots, createInventory, recomputeStats } from "./inventory";
import { createPotion, type Item } from "./items";
import { createAbilities } from "./skills";

/** Espada inicial do herói: fixa, sem id de loot. */
function starterSword(): Item {
  return { id: 0, name: "Espada Velha", kind: "equipment", slot: "weapon", rarity: "common", stats: { damage: 4 }, icon: "sword", value: 1, quantity: 1, maxStack: 1 };
}

export function createPlayer(id: EntityId, position: Vec3): Entity {
  const player: Entity = {
    id,
    kind: "player",
    name: "Herói",
    archetype: "hero",
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 7, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: 100, max: 100, baseMax: 100, regenPerSecond: 4, lastDamagedAt: -Infinity },
    combat: { damage: 10, baseDamage: 10, range: 2.4, cooldown: 0.55, cooldownLeft: 0, wantsAttack: false, windupTime: 0, windupLeft: 0 },
    progression: { level: 1, xp: 0, xpToNext: xpForLevel(1) },
    wallet: { gold: 0 },
    inventory: createInventory(20),
    equipment: createEquipmentSlots(),
    abilities: createAbilities(),
    quests: {},
  };
  player.equipment!.weapon = starterSword();
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
} as const satisfies Record<string, EnemyTemplate>;

export type EnemyKind = keyof typeof ENEMY_TEMPLATES;

export function createEnemy(id: EntityId, kind: EnemyKind, position: Vec3): Entity {
  const t = ENEMY_TEMPLATES[kind];
  return {
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
    },
  };
}
