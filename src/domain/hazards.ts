import type { EntityId } from "./components";
import type { Vec3 } from "./math";

/**
 * Perigo no chão: uma área que fica ativa por alguns segundos e fere quem estiver dentro, em
 * pulsos. É o que transforma o chão em parte da luta: o jogador precisa ler o terreno, não só
 * o inimigo.
 */
export type HazardKind = "acid" | "fire" | "arrows" | "spores" | "frost";

export interface Hazard {
  id: number;
  kind: HazardKind;
  /** Quem criou (decide quem é ferido, pela mesma regra de hostilidade dos golpes). */
  owner: EntityId;
  position: Vec3;
  radius: number;
  /** Dano por pulso. */
  damage: number;
  /** Segundos entre pulsos. */
  tickEvery: number;
  tickLeft: number;
  timeLeft: number;
  duration: number;
}

/** Receita de uma poça (vai num padrão de ataque ou num projétil). */
export interface PoolSpec {
  kind: HazardKind;
  radius: number;
  /** Fração do dano do dono aplicada a cada pulso. */
  damageFraction: number;
  duration: number;
  tickEvery: number;
}

export const ACID_POOL: PoolSpec = { kind: "acid", radius: 2.6, damageFraction: 0.22, duration: 8, tickEvery: 0.5 };
/** Talento Chão em Chamas (Bola de Fogo). */
export const FIRE_POOL: PoolSpec = { kind: "fire", radius: 2.6, damageFraction: 0.3, duration: 3, tickEvery: 0.5 };
/** Talento Tempestade (Chuva de Flechas). */
export const ARROW_STORM: PoolSpec = { kind: "arrows", radius: 3.5, damageFraction: 0.35, duration: 3, tickEvery: 0.5 };
/** Nuvem de Esporos do Ente Ancião: poça venenosa larga e demorada. */
export const SPORE_POOL: PoolSpec = { kind: "spores", radius: 3, damageFraction: 0.2, duration: 9, tickEvery: 0.5 };
/** Avalanche do Gigante de Gelo: chão congelado que fere e deixa lento quem fica em cima. */
export const FROST_POOL: PoolSpec = { kind: "frost", radius: 3.2, damageFraction: 0.16, duration: 7, tickEvery: 0.5 };
/** Magma do Senhor das Chamas e do Mestre da Forja: poça de fogo larga e demorada. */
export const MAGMA_POOL: PoolSpec = { kind: "fire", radius: 3.2, damageFraction: 0.18, duration: 7, tickEvery: 0.5 };
