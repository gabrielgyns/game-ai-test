import type { Entity, EntityId } from "./components";
import { createEquipment as createEquipmentSlots, createInventory } from "./inventory";
import type { Vec2, Vec3 } from "./math";
import { ACID_POOL, type PoolSpec } from "./hazards";
import { createAbilities } from "./skills";

/** Forma do aviso de golpe, desenhada no chão pela apresentação. */
export type TelegraphShape =
  | { kind: "circle"; radius: number; at?: Vec3 }
  | { kind: "line"; length: number; width: number; direction: Vec2 }
  /** Leque: setor de círculo à frente do atacante (rajadas de projéteis). */
  | { kind: "cone"; length: number; angle: number; direction: Vec2 };

/**
 * aoe: área fixada na posição do alvo no início do aviso (sair dela evita). projectile: dispara.
 * fan: leque de projéteis. lob: arremesso em arco que cai nos pontos avisados (e pode deixar poça).
 */
export type PatternKind = "melee" | "slam" | "charge" | "aoe" | "projectile" | "fan" | "lob";

/** Um golpe telegrafado. Inimigos comuns têm um só (melee); chefes alternam vários. */
export interface AttackPattern {
  id: string;
  name: string;
  kind: PatternKind;
  /** Melee: alcance; slam: raio em volta do atacante; charge: comprimento do avanço; aoe: raio da área. */
  range: number;
  /** aoe: distância máxima para mirar. */
  castRange?: number;
  /** projectile/fan/lob: tipo do projétil. */
  projectile?: "arrow" | "bolt" | "fireball" | "piercingArrow" | "stinger" | "acidGlob" | "bone";
  /** fan: quantos projéteis; lob: quantos arremessos (o primeiro no alvo, os outros em volta). */
  count?: number;
  /** fan: abertura total do leque, em graus. */
  spreadDeg?: number;
  /** lob: poça deixada onde cai. */
  pool?: PoolSpec;
  /** lob: raio da explosão na queda. */
  impactRadius?: number;
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
  /** Escudo que só habilidades quebram (Imperador Escorpião). */
  carapace?: Carapace;
}

/**
 * Carapaça de Areia: enquanto ativa, golpes básicos não fazem nada ("imune") e cada acerto de
 * habilidade arranca uma camada (com dano reduzido). Sem camadas, ela se parte: o chefe fica
 * atordoado e vulnerável (+50% de dano) por alguns segundos. Volta a cada troca de fase.
 *
 * Analogia: uma ostra. Bater com a mão não adianta; precisa da ferramenta certa para abrir, e
 * aberta ela fica exposta por um momento.
 */
export interface Carapace {
  active: boolean;
  layers: number;
  maxLayers: number;
  /** Segundos de atordoamento restantes depois de partida. */
  stunLeft: number;
}

export const CARAPACE = { layers: 3, stun: 4.5, skillDamageFraction: 0.3, vulnerableMultiplier: 1.5 };

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
  if (boss.carapace) boss.carapace = { active: false, layers: boss.carapace.maxLayers, maxLayers: boss.carapace.maxLayers, stunLeft: 0 };
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

export const SCORPION_EMPEROR_PATTERNS: AttackPattern[] = [
  { id: "sting", name: "Ferroada", kind: "melee", range: 3.6, windup: 0.8, damageMultiplier: 1, cooldown: 2, minPhase: 1 },
  { id: "spines", name: "Rajada de Espinhos", kind: "fan", range: 17, projectile: "stinger", count: 5, spreadDeg: 56, windup: 1.0, damageMultiplier: 0.8, cooldown: 5.5, minPhase: 1 },
  { id: "acid", name: "Cuspe Ácido", kind: "lob", range: 2.2, castRange: 16, projectile: "acidGlob", count: 1, pool: ACID_POOL, impactRadius: 2.2, windup: 1.1, damageMultiplier: 1.1, cooldown: 6.5, minPhase: 1 },
];

/** Na fase 2 o cuspe vira três globos; na 3, cinco. */
export function lobCount(pattern: AttackPattern, phase: number): number {
  const base = pattern.count ?? 1;
  return base + (phase - 1) * 2;
}

export function createScorpionEmperor(id: EntityId, position: Vec3): Entity {
  const maxHealth = 1600;
  const boss: Boss = {
    title: "Imperador Escorpião",
    patterns: SCORPION_EMPEROR_PATTERNS,
    cooldowns: {},
    phase: 1,
    phaseThresholds: [0.65, 0.3],
    windupScale: 1,
    summoned: false,
    engaged: false,
    carapace: { active: false, layers: CARAPACE.layers, maxLayers: CARAPACE.layers, stunLeft: 0 },
  };
  return {
    id,
    kind: "enemy",
    name: "Imperador Escorpião",
    archetype: "scorpionEmperor",
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 4.2, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 8, lastDamagedAt: -Infinity },
    combat: { damage: 32, baseDamage: 32, range: 3.6, cooldown: 2, cooldownLeft: 0, wantsAttack: false, windupTime: 0.8, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 18, leashRange: 45, xpReward: 950, goldReward: 320, respawnSeconds: 180 },
    boss,
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

/** Ergue a carapaça com todas as camadas (início do combate e a cada fase). */
export function raiseCarapace(entity: Entity): boolean {
  const c = entity.boss?.carapace;
  if (!c) return false;
  c.active = true;
  c.layers = c.maxLayers;
  c.stunLeft = 0;
  return true;
}

export const SKELETON_LORD_PATTERNS: AttackPattern[] = [
  { id: "cleaveBone", name: "Golpe Sepulcral", kind: "melee", range: 3.4, windup: 0.85, damageMultiplier: 1, cooldown: 2.1, minPhase: 1 },
  { id: "boneFan", name: "Rajada de Ossos", kind: "fan", range: 16, projectile: "bone", count: 7, spreadDeg: 80, windup: 1.0, damageMultiplier: 0.7, cooldown: 6, minPhase: 1 },
  { id: "graveStomp", name: "Pisão Sepulcral", kind: "slam", range: 6, windup: 1.4, damageMultiplier: 1.7, cooldown: 7, minPhase: 1 },
  { id: "phantomRush", name: "Investida Fantasma", kind: "charge", range: 12, windup: 0.75, damageMultiplier: 1.4, cooldown: 7, minPhase: 2 },
];

/** Chefe das dungeons: escala com o nível da dungeon (o `level` multiplica vida e dano). */
export function createSkeletonLord(id: EntityId, position: Vec3, level = 5): Entity {
  const k = 0.7 + 0.1 * Math.max(1, level);
  const maxHealth = Math.round(1100 * k);
  const damage = Math.round(24 * k);
  const boss: Boss = {
    title: "Lorde Esqueleto",
    patterns: SKELETON_LORD_PATTERNS,
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
    name: "Lorde Esqueleto",
    archetype: "skeletonLord",
    transform: { position: { ...position }, yaw: Math.PI / 2 },
    movement: { speed: 4.6, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage, baseDamage: damage, range: 3.4, cooldown: 2.1, cooldownLeft: 0, wantsAttack: false, windupTime: 0.85, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 13, leashRange: 30, xpReward: Math.round(600 * k), goldReward: Math.round(200 * k), respawnSeconds: Infinity, needsSight: true },
    boss,
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

/** Que lacaio cada chefe convoca na fase final. */
export const BOSS_MINION: Record<string, string> = { goblinKing: "goblin", spiderQueen: "spider", scorpionEmperor: "banditArcher", skeletonLord: "skeleton" };
