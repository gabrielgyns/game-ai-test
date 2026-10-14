import type { Vec2, Vec3 } from "./math";

export type EntityId = number;
export type EntityKind = "player" | "enemy";

export interface Transform {
  position: Vec3;
  /** Rotação em torno de Y, em radianos. 0 aponta para -Z. */
  yaw: number;
}

export interface Movement {
  /** Metros por segundo. */
  speed: number;
  /** Direção desejada no plano XZ (normalizada ou zero). Preenchida por input ou IA. */
  intent: Vec2;
}

export interface Health {
  current: number;
  max: number;
  /** Pontos por segundo regenerados fora de combate. */
  regenPerSecond: number;
  /** Instante (world.time) do último dano sofrido. */
  lastDamagedAt: number;
}

export interface Combat {
  damage: number;
  /** Alcance do ataque em metros. */
  range: number;
  /** Segundos entre ataques. */
  cooldown: number;
  cooldownLeft: number;
  /** Pedido de ataque para este tick (input ou IA). Consumido pelo sistema de combate. */
  wantsAttack: boolean;
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
  ai?: EnemyAI;
  wallet?: Wallet;
  respawn?: Respawn;
}

export function isAlive(e: Entity): boolean {
  return e.respawn === undefined && e.health.current > 0;
}
