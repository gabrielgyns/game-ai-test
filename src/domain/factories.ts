import type { Entity, EntityId } from "./components";
import { vec3, type Vec3 } from "./math";
import { xpForLevel } from "./progression";

export function createPlayer(id: EntityId, position: Vec3): Entity {
  return {
    id,
    kind: "player",
    name: "Herói",
    archetype: "hero",
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 7, intent: { x: 0, z: 0 } },
    health: { current: 100, max: 100, regenPerSecond: 4, lastDamagedAt: -Infinity },
    combat: { damage: 14, range: 2.4, cooldown: 0.55, cooldownLeft: 0, wantsAttack: false },
    progression: { level: 1, xp: 0, xpToNext: xpForLevel(1) },
    wallet: { gold: 0 },
  };
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
    movement: { speed: t.speed, intent: { x: 0, z: 0 } },
    health: { current: t.maxHealth, max: t.maxHealth, regenPerSecond: 2, lastDamagedAt: -Infinity },
    combat: { damage: t.damage, range: t.range, cooldown: t.cooldown, cooldownLeft: 0, wantsAttack: false },
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
