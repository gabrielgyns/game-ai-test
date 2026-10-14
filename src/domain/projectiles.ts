import type { EntityId } from "./components";
import type { Vec2, Vec3 } from "./math";

export type ProjectileKind = "arrow" | "bolt" | "fireball" | "piercingArrow";

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
}

export const PROJECTILE_SPECS: Record<ProjectileKind, { speed: number; hitRadius: number }> = {
  arrow: { speed: 28, hitRadius: 0.9 },
  piercingArrow: { speed: 32, hitRadius: 1.0 },
  bolt: { speed: 22, hitRadius: 0.9 },
  fireball: { speed: 14, hitRadius: 1.0 },
};
