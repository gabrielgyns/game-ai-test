import type { Entity, EntityId } from "./components";
import type { ProjectileKind } from "./projectiles";
import { createEquipment as createEquipmentSlots, createInventory } from "./inventory";
import type { Vec2, Vec3 } from "./math";
import { ACID_POOL, FROST_POOL, MAGMA_POOL, SPORE_POOL, type PoolSpec } from "./hazards";
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
  projectile?: ProjectileKind;
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
    level: 6,
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
    level: 10,
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
    level: 12,
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
    level: level + 2,
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
export const BOSS_MINION: Record<string, string> = { goblinKing: "goblin", spiderQueen: "spider", scorpionEmperor: "banditArcher", skeletonLord: "skeleton", ancientTreant: "wolf", frostGiant: "snowWolf", iceQueen: "iceWraith", elvenOracle: "elvenSpirit", fireLord: "lavaHound", forgeMaster: "flameCaster" };

export const ANCIENT_TREANT_PATTERNS: AttackPattern[] = [
  { id: "vineLash", name: "Chicote de Vinhas", kind: "melee", range: 4.4, windup: 0.9, damageMultiplier: 1, cooldown: 2.3, minPhase: 1 },
  { id: "rootSlam", name: "Raiz Esmagadora", kind: "slam", range: 6.5, windup: 1.4, damageMultiplier: 1.7, cooldown: 6.5, minPhase: 1 },
  { id: "spores", name: "Nuvem de Esporos", kind: "lob", range: 16, projectile: "acidGlob", count: 3, pool: SPORE_POOL, impactRadius: 2, windup: 1.1, damageMultiplier: 0.6, cooldown: 7, minPhase: 1 },
  { id: "barkFan", name: "Lascas de Casca", kind: "fan", range: 15, projectile: "stinger", count: 9, spreadDeg: 120, windup: 1.0, damageMultiplier: 0.6, cooldown: 6, minPhase: 2 },
];

/**
 * Ente Ancião, chefe da Floresta Ancestral (nível 20): uma árvore que anda. Chicoteia com vinhas, esmaga
 * o chão com as raízes, cospe nuvens de esporos que envenenam o chão e, ferido, solta lascas de casca
 * em leque. Na fúria, chama os lobos da floresta.
 */
export function createAncientTreant(id: EntityId, position: Vec3): Entity {
  const maxHealth = 4200;
  return {
    id,
    kind: "enemy",
    name: "Ente Ancião",
    archetype: "ancientTreant",
    level: 20,
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 3.6, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 12, lastDamagedAt: -Infinity },
    combat: { damage: 70, baseDamage: 70, range: 4.4, cooldown: 2.3, cooldownLeft: 0, wantsAttack: false, windupTime: 0.9, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 18, leashRange: 45, xpReward: 5000, goldReward: 900, respawnSeconds: 180 },
    boss: { title: "Ente Ancião", patterns: ANCIENT_TREANT_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

export const FROST_GIANT_PATTERNS: AttackPattern[] = [
  { id: "glacialFist", name: "Punho Glacial", kind: "melee", range: 4.6, windup: 0.95, damageMultiplier: 1, cooldown: 2.4, minPhase: 1 },
  { id: "quake", name: "Tremor Gélido", kind: "slam", range: 7, windup: 1.5, damageMultiplier: 1.7, cooldown: 7, minPhase: 1 },
  { id: "avalanche", name: "Avalanche", kind: "lob", range: 17, projectile: "iceShard", count: 4, pool: FROST_POOL, impactRadius: 2.2, windup: 1.2, damageMultiplier: 0.7, cooldown: 7.5, minPhase: 1 },
  { id: "shardFan", name: "Estilhaços", kind: "fan", range: 16, projectile: "iceShard", count: 9, spreadDeg: 110, windup: 1.0, damageMultiplier: 0.55, cooldown: 6, minPhase: 2 },
  { id: "giantRush", name: "Avanço do Gigante", kind: "charge", range: 13, windup: 0.9, damageMultiplier: 1.5, cooldown: 8, minPhase: 2 },
];

/**
 * Gigante de Gelo, chefe dos Picos Gelados (nível 28): soca, faz o chão tremer, arremessa blocos de
 * gelo que congelam o chão onde caem (quem fica em cima apanha e fica lento) e, ferido, solta leques de
 * estilhaços e avança. Na fúria, uiva e chama os lobos das neves.
 */
export function createFrostGiant(id: EntityId, position: Vec3): Entity {
  const maxHealth = 9000;
  return {
    id,
    kind: "enemy",
    name: "Gigante de Gelo",
    archetype: "frostGiant",
    level: 28,
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 3.9, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 20, lastDamagedAt: -Infinity },
    combat: { damage: 120, baseDamage: 120, range: 4.6, cooldown: 2.4, cooldownLeft: 0, wantsAttack: false, windupTime: 0.95, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 18, leashRange: 45, xpReward: 26000, goldReward: 1800, respawnSeconds: 180 },
    boss: { title: "Gigante de Gelo", patterns: FROST_GIANT_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

export const ICE_QUEEN_PATTERNS: AttackPattern[] = [
  { id: "iceBlade", name: "Lâmina de Gelo", kind: "melee", range: 3.4, windup: 0.8, damageMultiplier: 1, cooldown: 2, minPhase: 1 },
  { id: "blizzard", name: "Nevasca", kind: "fan", range: 16, projectile: "iceShard", count: 7, spreadDeg: 90, windup: 0.95, damageMultiplier: 0.65, cooldown: 5.5, minPhase: 1 },
  { id: "iceTomb", name: "Prisão de Gelo", kind: "aoe", range: 3.4, castRange: 16, windup: 1.3, damageMultiplier: 1.6, cooldown: 7, minPhase: 1 },
  { id: "frostField", name: "Chão Congelado", kind: "lob", range: 15, projectile: "iceShard", count: 3, pool: FROST_POOL, impactRadius: 2, windup: 1.1, damageMultiplier: 0.6, cooldown: 8, minPhase: 2 },
  { id: "glide", name: "Deslize Gélido", kind: "charge", range: 12, windup: 0.7, damageMultiplier: 1.3, cooldown: 7, minPhase: 2 },
];

/** Rainha Gélida, chefe da Caverna de Gelo: escala com o nível da caverna, como o Lorde na cripta. */
export function createIceQueen(id: EntityId, position: Vec3, level = 22): Entity {
  const k = (0.7 + 0.1 * Math.max(1, level)) / (0.7 + 0.1 * 22);
  const maxHealth = Math.round(6500 * k);
  const damage = Math.round(95 * k);
  return {
    id,
    kind: "enemy",
    name: "Rainha Gélida",
    archetype: "iceQueen",
    level: level + 2,
    transform: { position: { ...position }, yaw: Math.PI / 2 },
    movement: { speed: 4.8, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage, baseDamage: damage, range: 3.4, cooldown: 2, cooldownLeft: 0, wantsAttack: false, windupTime: 0.8, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 13, leashRange: 30, xpReward: Math.round(18000 * k), goldReward: Math.round(1400 * k), respawnSeconds: Infinity, needsSight: true },
    boss: { title: "Rainha Gélida", patterns: ICE_QUEEN_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

export const ELVEN_ORACLE_PATTERNS: AttackPattern[] = [
  { id: "staffStrike", name: "Golpe de Cajado", kind: "melee", range: 3.2, windup: 0.8, damageMultiplier: 1, cooldown: 2, minPhase: 1 },
  { id: "moonbeams", name: "Raios Lunares", kind: "fan", range: 16, projectile: "bolt", count: 7, spreadDeg: 100, windup: 0.95, damageMultiplier: 0.6, cooldown: 5.5, minPhase: 1 },
  { id: "starCircle", name: "Círculo Estelar", kind: "aoe", range: 3.4, castRange: 16, windup: 1.2, damageMultiplier: 1.6, cooldown: 6.5, minPhase: 1 },
  { id: "starfall", name: "Chuva de Estrelas", kind: "lob", range: 16, projectile: "bolt", count: 5, impactRadius: 2.2, windup: 1.1, damageMultiplier: 0.75, cooldown: 7.5, minPhase: 2 },
  { id: "etherealStep", name: "Passo Etéreo", kind: "charge", range: 12, windup: 0.7, damageMultiplier: 1.3, cooldown: 7, minPhase: 2 },
];

/** Oráculo de Elar, chefe do Santuário Élfico: escala com o nível do santuário, como o Lorde na cripta. */
export function createElvenOracle(id: EntityId, position: Vec3, level = 15): Entity {
  const k = (0.7 + 0.1 * Math.max(1, level)) / (0.7 + 0.1 * 15);
  const maxHealth = Math.round(3400 * k);
  const damage = Math.round(56 * k);
  return {
    id,
    kind: "enemy",
    name: "Oráculo de Elar",
    archetype: "elvenOracle",
    level: level + 2,
    transform: { position: { ...position }, yaw: Math.PI / 2 },
    movement: { speed: 4.8, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage, baseDamage: damage, range: 3.2, cooldown: 2, cooldownLeft: 0, wantsAttack: false, windupTime: 0.8, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 13, leashRange: 30, xpReward: Math.round(6000 * k), goldReward: Math.round(900 * k), respawnSeconds: Infinity, needsSight: true },
    boss: { title: "Oráculo de Elar", patterns: ELVEN_ORACLE_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

export const FIRE_LORD_PATTERNS: AttackPattern[] = [
  { id: "flameBlade", name: "Lâmina Ígnea", kind: "melee", range: 4.8, windup: 0.9, damageMultiplier: 1, cooldown: 2.3, minPhase: 1 },
  { id: "eruption", name: "Erupção", kind: "slam", range: 7.5, windup: 1.5, damageMultiplier: 1.7, cooldown: 7, minPhase: 1 },
  { id: "magmaRain", name: "Chuva de Magma", kind: "lob", range: 18, projectile: "fireball", count: 5, pool: MAGMA_POOL, impactRadius: 2.4, windup: 1.2, damageMultiplier: 0.7, cooldown: 7.5, minPhase: 1 },
  { id: "emberFan", name: "Leque de Brasas", kind: "fan", range: 16, projectile: "fireball", count: 9, spreadDeg: 110, windup: 1.0, damageMultiplier: 0.55, cooldown: 6, minPhase: 2 },
  { id: "blazeRush", name: "Investida Flamejante", kind: "charge", range: 13, windup: 0.85, damageMultiplier: 1.5, cooldown: 8, minPhase: 2 },
];

/**
 * Senhor das Chamas, chefe das Terras Vulcânicas (nível 36): um demônio de fogo que mora na caldeira.
 * Corta com a lâmina em brasa, faz o chão entrar em erupção, chove magma que deixa poças de fogo e,
 * ferido, solta leques de brasas e avança. Na fúria, chama os cães de lava.
 */
export function createFireLord(id: EntityId, position: Vec3): Entity {
  const maxHealth = 22000;
  return {
    id,
    kind: "enemy",
    name: "Senhor das Chamas",
    archetype: "fireLord",
    level: 36,
    transform: { position: { ...position }, yaw: 0 },
    movement: { speed: 4.2, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 40, lastDamagedAt: -Infinity },
    combat: { damage: 260, baseDamage: 260, range: 4.8, cooldown: 2.3, cooldownLeft: 0, wantsAttack: false, windupTime: 0.9, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 18, leashRange: 45, xpReward: 320000, goldReward: 5000, respawnSeconds: 180 },
    boss: { title: "Senhor das Chamas", patterns: FIRE_LORD_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}

export const FORGE_MASTER_PATTERNS: AttackPattern[] = [
  { id: "hammerBlow", name: "Martelada", kind: "melee", range: 3.8, windup: 0.95, damageMultiplier: 1.1, cooldown: 2.3, minPhase: 1 },
  { id: "anvilDrop", name: "Bigorna Ardente", kind: "aoe", range: 3.6, castRange: 16, windup: 1.3, damageMultiplier: 1.7, cooldown: 6.5, minPhase: 1 },
  { id: "slag", name: "Escória", kind: "lob", range: 15, projectile: "fireball", count: 3, pool: MAGMA_POOL, impactRadius: 2.2, windup: 1.1, damageMultiplier: 0.65, cooldown: 7.5, minPhase: 1 },
  { id: "forgeQuake", name: "Tremor da Forja", kind: "slam", range: 6.5, windup: 1.4, damageMultiplier: 1.6, cooldown: 7, minPhase: 2 },
  { id: "bellowsRush", name: "Fole Ardente", kind: "charge", range: 12, windup: 0.8, damageMultiplier: 1.4, cooldown: 7.5, minPhase: 2 },
];

/** Mestre da Forja, chefe da Forja Vulcânica: escala com o nível da forja, como o Lorde na cripta. */
export function createForgeMaster(id: EntityId, position: Vec3, level = 30): Entity {
  const k = (0.7 + 0.1 * Math.max(1, level)) / (0.7 + 0.1 * 30);
  const maxHealth = Math.round(15000 * k);
  const damage = Math.round(190 * k);
  return {
    id,
    kind: "enemy",
    name: "Mestre da Forja",
    archetype: "forgeMaster",
    level: level + 2,
    transform: { position: { ...position }, yaw: Math.PI / 2 },
    movement: { speed: 4.4, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: maxHealth, max: maxHealth, baseMax: maxHealth, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage, baseDamage: damage, range: 3.8, cooldown: 2.3, cooldownLeft: 0, wantsAttack: false, windupTime: 0.95, windupLeft: 0 },
    ai: { state: "idle", home: { ...position }, aggroRange: 13, leashRange: 30, xpReward: Math.round(220000 * k), goldReward: Math.round(3500 * k), respawnSeconds: Infinity, needsSight: true },
    boss: { title: "Mestre da Forja", patterns: FORGE_MASTER_PATTERNS, cooldowns: {}, phase: 1, phaseThresholds: [0.6, 0.3], windupScale: 1, summoned: false, engaged: false },
    abilities: { ...createAbilities(), skills: [] },
    inventory: createInventory(0),
    equipment: createEquipmentSlots(),
  };
}
