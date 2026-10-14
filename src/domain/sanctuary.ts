import type { Entity } from "./components";
import { distanceXZ } from "./math";

/**
 * Pontos de uso do santuário além dos NPCs: o baú compartilhado e o Altar das Eras, onde se escolhe a
 * dificuldade do mundo. Ficam na praça, dentro do anel de pilares.
 */
export const STASH_SPOT = { x: -5.5, y: 0, z: 3.5 };
export const ALTAR_SPOT = { x: 0, y: 0, z: -6.2 };
export const SANCTUARY_RANGE = 2.4;

export type SanctuaryInteraction = "stash" | "altar" | null;

export function sanctuaryInteraction(player: Entity): SanctuaryInteraction {
  const p = player.transform.position;
  if (distanceXZ(p, STASH_SPOT) < SANCTUARY_RANGE) return "stash";
  if (distanceXZ(p, ALTAR_SPOT) < SANCTUARY_RANGE) return "altar";
  return null;
}
