import type { Entity, EntityId } from "./components";
import { createEquipment as createEquipmentSlots, createInventory } from "./inventory";
import type { Vec2, Vec3 } from "./math";
import { createAbilities } from "./skills";

/** Forma do aviso de golpe, desenhada no chão pela apresentação. */
export type TelegraphShape =
  | { kind: "circle"; radius: number; at?: Vec3 }
  | { kind: "line"; length: number; width: number; direction: Vec2 };

/** aoe: área fixada na posição do alvo no início do aviso (sair dela evita). */
export type PatternKind = "melee" | "slam" | "charge" | "aoe";

/** Um golpe telegrafado. Inimigos comuns têm um só (melee); chefes alternam vários. */
export interface AttackPattern {
  id: string;
  name: string;
  kind: PatternKind;
  /** Melee: alcance; slam: raio em volta do atacante; charge: comprimento do avanço; aoe: raio da área. */
  range: number;
  /** aoe: distância máxima para mirar. */
  castRange?: number;
  windup: number;
  damageMultiplier: number;
  cooldown: number;
  /** Fase mínima em que o padrão fica disponível. */
  minPhase: number;
}

export interface Boss {
  title: string;
  patterns: AttackPattern[];
  cooldowns: Record<string, number>;
  /** Fase atual (1 = cheia de vida). */
  phase: number;
  /** Frações de vida abaixo das quais entra na fase seguinte. */
  phaseThresholds: number[];
  /** Multiplicador de velocidade dos avisos (fases avançadas são mais rápidas). */
  windupScale: number;
  /** Invocação de lacaios já usada nesta vida. */
  summoned: boolean;
  /** Entrou em combate (para a barra de chefe). */
  engaged: boolean;
}

export const GOBLIN_KING_PATTERNS: AttackPattern[] = [
  { id: "cleave", name: "Golpe Pesado", kind: "melee", range: 3.2, windup: 0.9, damageMultiplier: 1, cooldown: 2.2, minPhase: 1 },
  { id: "stomp", name: "Pisão", kind: "slam", range: 6, windup: 1.6, damageMultiplier: 1.8, cooldown: 7, minPhase: 1 },
  { id: "rush", name: "Investida Real", kind: "charge", range: 11, windup: 0.8, damageMultiplier: 1.4, cooldown: 6, minPhase: 2 },
];

export function createGoblinKing(id: EntityId, position: Vec3): Entity {
  const maxHealth = 900;
  const boss: Boss = {
    title: "Rei Goblin",
    patterns: GOBLIN_KING_PATTERNS,
    cooldowns: {},
    phase: 1,
    phaseThresholds: [0.65, 0.3],
    windupScale: 1,
    summoned: false,
    engaged: false,
  };
  return {
    id,
    kind: "enemy",
    name: "Rei Goblin",
    archetype: "goblinKing",
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 4.6, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 6, lastDamagedAt: -Infinity },
    combat: { damage: 26, baseDamage: 26, range: 3.2, cooldown: 2.2, cooldownLeft: 0, wantsAttack: false, windupTime: 0.9, windupLeft: 0 },
    ai: {
      state: "idle",
      home: { ...position },
      aggroRange: 18,
      leashRange: 45,
      xpReward: 450,
      goldReward: 160,
      respawnSeconds: 180,
    },
    boss,
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

/** Atualiza a fase conforme a vida. Retorna a nova fase se mudou. */
export function updateBossPhase(entity: Entity): number | null {
  const boss = entity.boss;
  if (!boss) return null;
  const ratio = entity.health.current / entity.health.max;
  let phase = 1;
  for (const t of boss.phaseThresholds) if (ratio <= t) phase++;
  if (phase === boss.phase) return null;
  boss.phase = phase;
  boss.windupScale = phase === 1 ? 1 : phase === 2 ? 0.85 : 0.7;
  // Fase final: enfurece.
  if (phase === 3) entity.combat.damage = Math.round(entity.combat.baseDamage * 1.3);
  return phase;
}

export function resetBoss(entity: Entity): void {
  const boss = entity.boss;
  if (!boss) return;
  boss.phase = 1;
  boss.windupScale = 1;
  boss.summoned = false;
  boss.engaged = false;
  boss.cooldowns = {};
  entity.combat.damage = entity.combat.baseDamage;
}

export const SPIDER_QUEEN_PATTERNS: AttackPattern[] = [
  { id: "bite", name: "Mordida", kind: "melee", range: 3.0, windup: 0.7, damageMultiplier: 1, cooldown: 1.8, minPhase: 1 },
  { id: "web", name: "Teia Venenosa", kind: "aoe", range: 3.2, castRange: 14, windup: 1.3, damageMultiplier: 1.6, cooldown: 6, minPhase: 1 },
  { id: "pounce", name: "Bote", kind: "charge", range: 10, windup: 0.7, damageMultiplier: 1.3, cooldown: 7, minPhase: 2 },
];

export function createSpiderQueen(id: EntityId, position: Vec3): Entity {
  const maxHealth = 1300;
  const boss: Boss = {
    title: "Rainha Aranha",
    patterns: SPIDER_QUEEN_PATTERNS,
    cooldowns: {},
    phase: 1,
    phaseThresholds: [0.6, 0.3],
    windupScale: 1,
    summoned: false,
    engaged: false,
  };
  return {
    id,
    kind: "enemy",
    name: "Rainha Aranha",
    archetype: "spiderQueen",
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 5.4, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 8, lastDamagedAt: -Infinity },
    combat: { damage: 30, baseDamage: 30, range: 3.0, cooldown: 1.8, cooldownLeft: 0, wantsAttack: false, windupTime: 0.7, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 18, leashRange: 45, xpReward: 700, goldReward: 240, respawnSeconds: 180 },
    boss,
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

/** Que lacaio cada chefe convoca na fase final. */
export const BOSS_MINION: Record<string, string> = { goblinKing: "goblin", spiderQueen: "spider" };
