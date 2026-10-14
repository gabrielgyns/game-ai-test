import type { VillageId } from "./villages";
import type { SetPower } from "./sets";
import type { Vec2, Vec3 } from "./math";
import type { Equipment, Inventory } from "./inventory";
import type { Abilities } from "./skills";
import type { AttackPattern, Boss } from "./boss";
import type { QuestLog } from "./quests";
import type { ClassId } from "./classes";
import type { StatusEffects } from "./status";
import type { TalentRanks } from "./skillTree";

export type EntityId = number;
export type EntityKind = "player" | "enemy" | "npc";

export interface Transform {
  position: Vec3;
  /** Rotação em torno de Y, em radianos. 0 aponta para -Z. */
  yaw: number;
}

export interface Movement {
  /** Metros por segundo (antes do multiplicador). */
  speed: number;
  /** Multiplicador vindo de equipamento (1 = sem bônus). */
  speedMultiplier: number;
  /** Direção desejada no plano XZ (normalizada ou zero). Preenchida por input ou IA. */
  intent: Vec2;
  /**
   * Quando definido, a entidade encara este yaw em vez da direção do movimento.
   * Permite andar de ré e de lado mantendo o alvo à frente (estilo MMO).
   */
  faceYaw?: number;
}

export interface Health {
  current: number;
  /** Máximo efetivo (base + equipamento). Recalculado por recomputeStats. */
  max: number;
  /** Máximo base, alterado pelo nível. */
  baseMax: number;
  /** Pontos por segundo regenerados fora de combate. */
  regenPerSecond: number;
  /** Instante (world.time) do último dano sofrido. */
  lastDamagedAt: number;
}

export interface Combat {
  /** Dano efetivo (base + equipamento). Recalculado por recomputeStats. */
  damage: number;
  /** Dano base, alterado pelo nível. */
  baseDamage: number;
  /** Alcance do ataque em metros. */
  range: number;
  /** Segundos entre ataques. */
  cooldown: number;
  cooldownLeft: number;
  /** Pedido de ataque para este tick (input ou IA). Consumido pelo sistema de combate. */
  wantsAttack: boolean;
  /** Segundos de aviso entre iniciar o ataque e acertar (0 = instantâneo, como o jogador). */
  windupTime: number;
  /** Tempo restante do aviso em curso (0 = nenhum ataque em preparação). */
  windupLeft: number;
  /** Golpe em preparação: padrão, direção e (para aoe/lob) pontos fixados no início do aviso. */
  pending?: { pattern: AttackPattern; direction: Vec2; point?: Vec3; points?: Vec3[] };
  /** Golpe básico próprio (inimigos arqueiros); sem ele, melee ou o estilo da classe. */
  basicPattern?: AttackPattern;
}

/**
 * Bônus derivados do equipamento (afixos e atributos especiais), recalculados por recomputeStats.
 * Os sistemas leem daqui: crítico e roubo de vida no dano, recarga nas habilidades, ouro na morte.
 */
export interface Bonuses {
  /** Chance de crítico, em pontos percentuais. */
  critChance: number;
  /** Porcentagem do dano causado que volta como vida. */
  lifesteal: number;
  /** Redução de recarga das habilidades, em porcentagem (limitada a 40%). */
  cooldownPercent: number;
  /** Ouro extra dos inimigos, em porcentagem. */
  goldPercent: number;
  /** Vida por segundo que regenera sempre, mesmo em combate. */
  regen: number;
  /** Poderes de conjunto ativos (três peças vestidas). */
  powers?: SetPower[];
}

export interface Progression {
  level: number;
  xp: number;
  xpToNext: number;
}

export type AIState = "idle" | "chase" | "attack" | "return";

export interface EnemyAI {
  state: AIState;
  home: Vec3;
  /** Distância em que o inimigo percebe o jogador. */
  aggroRange: number;
  /** Distância máxima de casa antes de desistir e voltar. */
  leashRange: number;
  xpReward: number;
  goldReward: number;
  respawnSeconds: number;
  /** Atiradores: distância que tentam manter do jogador (recuam se ele chegar mais perto). */
  keepDistance?: number;
  /** Só começa a perseguir se enxergar o jogador (dungeons, onde há paredes). */
  needsSight?: boolean;
  /** Tier do loot, quando difere da tabela do arquétipo (inimigos de dungeon). */
  lootTier?: 1 | 2 | 3;
}

export interface Wallet {
  gold: number;
}

/** Presente apenas enquanto a entidade está morta e aguardando renascer. */
export interface Respawn {
  timeLeft: number;
  /** Onde renascer. */
  at: Vec3;
}

export interface Entity {
  id: EntityId;
  kind: EntityKind;
  name: string;
  /** Identificador do modelo visual (a apresentação decide como desenhar). */
  archetype: string;
  transform: Transform;
  movement: Movement;
  health: Health;
  combat: Combat;
  progression?: Progression;
  /** Nível de inimigos e chefes (o herói usa `progression.level`). Ver `entityLevel`. */
  level?: number;
  /** Minichefe (guardião de dungeon): mais forte, maior na tela e com loot garantido. */
  miniboss?: boolean;
  /** Vilas cuja pedra de teleporte o herói já ativou (só o herói). */
  villages?: VillageId[];
  ai?: EnemyAI;
  wallet?: Wallet;
  respawn?: Respawn;
  inventory?: Inventory;
  equipment?: Equipment;
  abilities?: Abilities;
  boss?: Boss;
  npc?: { id: string };
  quests?: QuestLog;
  /** Contadores de progresso (abates etc.). */
  stats?: { kills: number };
  /** Bônus especiais do equipamento (só o jogador tem). */
  bonuses?: Bonuses;
  /** Efeitos de status ativos (atordoado, lento, vulnerável). */
  status?: StatusEffects;
  /** Ranks comprados na árvore de habilidades. */
  talents?: TalentRanks;
  /** Classe do herói (define ataque básico e barra de habilidades). */
  classId?: ClassId;
}

/** Quem pode ferir quem: jogador e inimigos são hostis entre si; NPCs ficam fora. */
export function isHostile(a: Entity, b: Entity): boolean {
  return (a.kind === "player" && b.kind === "enemy") || (a.kind === "enemy" && b.kind === "player");
}

export function isAlive(e: Entity): boolean {
  return e.respawn === undefined && e.health.current > 0;
}
