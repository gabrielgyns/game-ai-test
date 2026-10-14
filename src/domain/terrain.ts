import { smoothstep } from "./math";
import { biomeWeights, SWAMP_BOSS_HOME } from "./biomes";

/** Metade do tamanho do mundo. O mundo vai de -WORLD_HALF a +WORLD_HALF em X e Z. */
export const WORLD_HALF = 110;

/** Raio da área plana central onde o jogador nasce. */
export const SPAWN_FLAT_RADIUS = 14;

/** Nível da água do pântano: células que mergulhariam abaixo disso viram água plana. */
export const WATER_LEVEL = -3;

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
  const distFromSwampArena = Math.hypot(x - SWAMP_BOSS_HOME.x, z - SWAMP_BOSS_HOME.z);
  const flatten = Math.min(
    smoothstep(SPAWN_FLAT_RADIUS, SPAWN_FLAT_RADIUS + 22, distFromCenter),
    smoothstep(13, 24, distFromArena),
    smoothstep(13, 24, distFromSwampArena),
  );
  const w = biomeWeights(x);
  // Pântano: baixo e encharcado (poças onde o relevo mergulha); deserto: dunas largas e suaves.
  const swampRelief = hills * 0.5 - 1.4 + Math.sin(x * 0.21) * Math.cos(z * 0.19) * 1.4;
  const desertRelief = Math.sin(x * 0.07 + 2) * Math.cos(z * 0.06) * 3 + Math.sin((x - z) * 0.03) * 1.5;
  const relief = hills * w.meadow + swampRelief * w.swamp + desertRelief * w.desert;

  // Bordas sobem para formar uma "muralha" natural, mantendo o jogador dentro.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 14;

  // Arenas dos chefes: platô de 6 m ao norte; clareira seca no nível do pântano a oeste.
  const plateau = 6 * (1 - smoothstep(13, 24, distFromArena));
  const swampArena = -1 * (1 - smoothstep(13, 24, distFromSwampArena));
  return relief * flatten + wall + plateau + swampArena;
}

/**
 * Altura do terreno em blocos: constante dentro de cada célula e quantizada em degraus.
 * Compartilhada entre domínio (movimento) e apresentação (malha), então o que você vê
 * é exatamente onde as entidades pisam.
 */
export function terrainHeight(x: number, z: number): number {
  const cx = Math.floor(x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const cz = Math.floor(z / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const h = Math.round(terrainHeightSmooth(cx, cz) / STEP_HEIGHT) * STEP_HEIGHT;
  // No pântano, tudo abaixo do nível da água vira um espelho plano (o fundo não importa).
  if (h < WATER_LEVEL && biomeWeights(cx).swamp > 0.5) return WATER_LEVEL;
  return h;
}


/** Água só existe no pântano; o herói anda mais devagar dentro dela. */
export function isWater(x: number, z: number): boolean {
  return biomeWeights(x).swamp > 0.5 && terrainHeight(x, z) <= WATER_LEVEL;
}
