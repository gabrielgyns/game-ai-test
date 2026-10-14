import type { EntityId } from "./components";
import type { Vec2, Vec3 } from "./math";
import type { PoolSpec } from "./hazards";

export type ProjectileKind = "arrow" | "bolt" | "fireball" | "piercingArrow" | "stinger" | "acidGlob";

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  owner: EntityId;
  position: Vec3;
  direction: Vec2;
  speed: number;
  /** Distância máxima antes de sumir. */
  maxDistance: number;
  traveled: number;
  damage: number;
  /** Raio da explosão ao acertar ou expirar (0 = só o alvo). */
  explodeRadius: number;
  /** Atravessa inimigos (acerta cada um uma vez). */
  pierce: boolean;
  hitIds: EntityId[];
  /** Disparado por uma habilidade (quebra a Carapaça de Areia; ataques básicos não). */
  fromSkill?: boolean;
  /** Arremesso em arco: não acerta ninguém no caminho, só ao cair no fim do trajeto. */
  lob?: boolean;
  /** Deixa uma poça onde explode. */
  pool?: PoolSpec;
  /** Atordoa quem acertar, por estes segundos (talento Flecha Pesada). */
  stun?: number;
}

export const PROJECTILE_SPECS: Record<ProjectileKind, { speed: number; hitRadius: number }> = {
  arrow: { speed: 28, hitRadius: 0.9 },
  piercingArrow: { speed: 32, hitRadius: 1.0 },
  bolt: { speed: 22, hitRadius: 0.9 },
  fireball: { speed: 14, hitRadius: 1.0 },
  stinger: { speed: 17, hitRadius: 0.8 },
  acidGlob: { speed: 15, hitRadius: 1.0 },
};
