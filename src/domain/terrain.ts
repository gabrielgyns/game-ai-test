import { smoothstep } from "./math";

/** Metade do tamanho do mundo. O mundo vai de -WORLD_HALF a +WORLD_HALF em X e Z. */
export const WORLD_HALF = 110;

/** Raio da área plana central onde o jogador nasce. */
export const SPAWN_FLAT_RADIUS = 14;

/**
 * Altura do terreno em qualquer ponto (função pura, determinística).
 * Compartilhada entre domínio (movimento) e apresentação (malha), então
 * o que você vê é exatamente onde as entidades pisam.
 */
export function terrainHeight(x: number, z: number): number {
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.05) * 4.5 +
    Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 - 0.7) * 1.4 +
    Math.sin((x + z) * 0.021 + 0.4) * 3.2 +
    Math.cos((x - z) * 0.017 - 1.1) * 2.1;

  const distFromCenter = Math.hypot(x, z);
  const flatten = smoothstep(SPAWN_FLAT_RADIUS, SPAWN_FLAT_RADIUS + 22, distFromCenter);

  // Bordas sobem para formar uma "muralha" natural, mantendo o jogador dentro.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 14;

  return hills * flatten + wall;
}
