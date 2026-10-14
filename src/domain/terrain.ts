import { smoothstep } from "./math";

/** Metade do tamanho do mundo. O mundo vai de -WORLD_HALF a +WORLD_HALF em X e Z. */
export const WORLD_HALF = 110;

/** Raio da área plana central onde o jogador nasce. */
export const SPAWN_FLAT_RADIUS = 14;

/** Tamanho de cada célula (coluna de blocos) do terreno, em metros. */
export const CELL_SIZE = 1;
/** Altura de cada degrau do terreno, em metros. */
export const STEP_HEIGHT = 0.5;

/**
 * Altura contínua (suave) do relevo. Usada como base para a versão em blocos.
 */
export function terrainHeightSmooth(x: number, z: number): number {
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.05) * 4.5 +
    Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 - 0.7) * 1.4 +
    Math.sin((x + z) * 0.021 + 0.4) * 3.2 +
    Math.cos((x - z) * 0.017 - 1.1) * 2.1;

  const distFromCenter = Math.hypot(x, z);
  const distFromArena = Math.hypot(x - 0, z - -82);
  const flatten = Math.min(
    smoothstep(SPAWN_FLAT_RADIUS, SPAWN_FLAT_RADIUS + 22, distFromCenter),
    smoothstep(13, 24, distFromArena),
  );

  // Bordas sobem para formar uma "muralha" natural, mantendo o jogador dentro.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 14;

  // A arena do chefe fica num platô fixo de 6 m para se destacar na paisagem.
  const plateau = 6 * (1 - smoothstep(13, 24, distFromArena));
  return hills * flatten + wall + plateau;
}

/**
 * Altura do terreno em blocos: constante dentro de cada célula e quantizada em degraus.
 * Compartilhada entre domínio (movimento) e apresentação (malha), então o que você vê
 * é exatamente onde as entidades pisam.
 */
export function terrainHeight(x: number, z: number): number {
  const cx = Math.floor(x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const cz = Math.floor(z / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  return Math.round(terrainHeightSmooth(cx, cz) / STEP_HEIGHT) * STEP_HEIGHT;
}
