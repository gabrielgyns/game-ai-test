import { smoothstep } from "./math";
import { biomeWeights, DESERT_BOSS_HOME, SWAMP_BOSS_HOME } from "./biomes";
import { zoneAt } from "./zones";

/** Metade do tamanho do mundo. O mundo vai de -WORLD_HALF a +WORLD_HALF em X e Z. */
export const WORLD_HALF = 110;

/** A partir deste X fica o "espaço das dungeons": chão plano em y = 0, paredes vêm da planta. */
export const DUNGEON_REGION_X = 500;

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
  const zone = zoneAt(x, z);
  if (zone.id === "floresta") return forestHeightSmooth(x - zone.center.x, z - zone.center.z);
  if (zone.id === "picos") return peaksHeightSmooth(x - zone.center.x, z - zone.center.z);
  if (zone.id === "vulcao") return volcanoHeightSmooth(x - zone.center.x, z - zone.center.z);
  return valeHeightSmooth(x, z);
}

/** Nível da água do rio da Floresta Ancestral. */
export const FOREST_WATER = -2;
/** Lugares planos da floresta, em coordenadas locais: acampamento, clareira do chefe e ruínas élficas. */
export const FOREST_CAMP = { x: 0, z: 84 };
export const FOREST_BOSS_HOME = { x: 0, z: -78 };
export const FOREST_RUINS = { x: 70, z: 6 };
/** Portal do Santuário Élfico, no pátio das ruínas. */
export const FOREST_SANCTUM = { x: 72, z: 14 };

/** Centro do rio (em z local) para cada x local: serpenteia de oeste a leste pelo meio da floresta. */
export const forestRiverZ = (lx: number): number => 10 * Math.sin(lx * 0.032 + 1) - 4 + 4 * Math.sin(lx * 0.09);

/**
 * Relevo da Floresta Ancestral: colinas suaves cheias de raízes, um rio que corta a mata de lado a
 * lado, o platô das ruínas élficas a leste, e duas clareiras planas (acampamento ao sul, perto do
 * portão, e a clareira do Ente Ancião ao norte). Bordas sobem em penhascos, com uma passagem no portão.
 */
function forestHeightSmooth(lx: number, lz: number): number {
  const hills =
    Math.sin(lx * 0.05 + 0.7) * Math.cos(lz * 0.045) * 3 + Math.sin((lx - lz) * 0.03) * 2 + Math.cos(lx * 0.11) * Math.sin(lz * 0.13) * 0.9;
  const dCamp = Math.hypot(lx - FOREST_CAMP.x, lz - FOREST_CAMP.z);
  const dBoss = Math.hypot(lx - FOREST_BOSS_HOME.x, lz - FOREST_BOSS_HOME.z);
  const dRuins = Math.hypot(lx - FOREST_RUINS.x, lz - FOREST_RUINS.z);
  const flatten = Math.min(smoothstep(12, 26, dCamp), smoothstep(18, 30, dBoss), smoothstep(18, 28, dRuins));
  const ruins = 2.5 * (1 - smoothstep(18, 28, dRuins));
  const river = (1 - smoothstep(3.5, 8, Math.abs(lz - forestRiverZ(lx)))) * 6 * smoothstep(10, 22, dBoss) * smoothstep(10, 20, dCamp);
  const edge = Math.max(Math.abs(lx), Math.abs(lz));
  // Penhascos na borda, abertos nas passagens (sul, no meio, para o vale; norte, a leste, para os Picos).
  const gate = lz > 0 ? smoothstep(5, 14, Math.abs(lx)) : smoothstep(5, 14, Math.abs(lx - 50));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 16 * gate;
  return hills * flatten + ruins - river + wall;
}

/** Lugares dos Picos Gelados, em coordenadas locais: vila, lago congelado, arena do Gigante e a caverna. */
export const PEAKS_VILLAGE = { x: 0, z: 76 };
export const PEAKS_LAKE = { x: -46, z: 8 };
export const PEAKS_LAKE_RADIUS = 21;
export const PEAKS_BOSS_HOME = { x: 0, z: -78 };
export const PEAKS_CAVE = { x: 62, z: -30 };
/** Altura do gelo do lago (plano e liso). */
export const PEAKS_ICE = -1;

/** Borda irregular do lago congelado (raio por ângulo). */
const lakeRadius = (lx: number, lz: number): number => {
  const a = Math.atan2(lz - PEAKS_LAKE.z, lx - PEAKS_LAKE.x);
  return PEAKS_LAKE_RADIUS + Math.sin(a * 3 + 0.7) * 3 + Math.sin(a * 5) * 1.5;
};

/**
 * Relevo dos Picos Gelados: cristas afiadas (ruído "dobrado", que vira aresta onde cruza o zero),
 * mais altas perto das bordas e baixas no meio, onde ficam os vales por onde se anda. Planos: a vila
 * ao sul, perto da passagem; o lago congelado a oeste; o patamar da caverna na encosta leste; e o
 * platô do Gigante, um degrau acima, ao norte.
 */
function peaksHeightSmooth(lx: number, lz: number): number {
  const ridge = 1 - Math.abs(Math.sin(lx * 0.043 + 1.3) * Math.cos(lz * 0.039 - 0.6) + Math.sin((lx + lz) * 0.021) * 0.4);
  const fromCenter = Math.hypot(lx * 0.9, lz) / 110;
  const peaks = Math.pow(Math.max(0, ridge), 3) * (4 + 10 * smoothstep(0.25, 0.9, fromCenter));
  const bumps = Math.sin(lx * 0.11 + 2) * Math.cos(lz * 0.09) * 1.2 + Math.sin((lx - lz) * 0.05) * 1.6;
  const dVillage = Math.hypot(lx - PEAKS_VILLAGE.x, lz - PEAKS_VILLAGE.z);
  const dBoss = Math.hypot(lx - PEAKS_BOSS_HOME.x, lz - PEAKS_BOSS_HOME.z);
  const dCave = Math.hypot(lx - PEAKS_CAVE.x, lz - PEAKS_CAVE.z);
  const dLake = Math.hypot(lx - PEAKS_LAKE.x, lz - PEAKS_LAKE.z) - lakeRadius(lx, lz);
  const flatten = Math.min(smoothstep(13, 26, dVillage), smoothstep(16, 28, dBoss), smoothstep(6, 14, dCave), smoothstep(0, 10, dLake));
  // Trilha da passagem (sul, no meio) até a vila: sem crista no caminho.
  const trail = lz > PEAKS_VILLAGE.z ? smoothstep(4, 12, Math.abs(lx)) : 1;
  const relief = (peaks + bumps) * flatten * trail;
  const plateau = 3 * (1 - smoothstep(16, 28, dBoss));
  const ledge = 4 * (1 - smoothstep(6, 14, dCave));
  const lake = -2 * (1 - smoothstep(-2, 4, dLake));
  const edge = Math.max(Math.abs(lx), Math.abs(lz));
  // Penhascos nas bordas, abertos nas passagens (sul, no meio, para a floresta; norte, a oeste, para o vulcão).
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 18 * (lz > 0 ? smoothstep(5, 14, Math.abs(lx)) : smoothstep(5, 14, Math.abs(lx + 50)));
  return 1 + relief + plateau + ledge + lake + wall;
}

/** Lugares das Terras Vulcânicas, em coordenadas locais: forte, caldeira do chefe e a Forja. */
export const VOLCANO_FORT = { x: 0, z: 76 };
export const VOLCANO_CALDERA = { x: 0, z: -72 };
export const VOLCANO_FORGE = { x: -64, z: -18 };
export const VOLCANO_LAVA_LAKE = { x: 56, z: 28 };
/** Altura da lava (plana). */
export const LAVA_LEVEL = -1.5;

/** Centro (em x local) do rio de lava que desce da caldeira, serpenteando para o sudeste. */
export const lavaRiverX = (lz: number): number => 22 + 14 * Math.sin(lz * 0.045 + 0.6) + 4 * Math.sin(lz * 0.13);

/** Lava: o rio que desce da caldeira, o lago a leste e o fosso em volta do fundo da caldeira. */
function lavaLocal(lx: number, lz: number): boolean {
  if (lz > -50 && lz < 40 && Math.abs(lx - lavaRiverX(lz)) < 3.2 + Math.sin(lz * 0.2) * 0.8) return true;
  const a = Math.atan2(lz - VOLCANO_LAVA_LAKE.z, lx - VOLCANO_LAVA_LAKE.x);
  if (Math.hypot(lx - VOLCANO_LAVA_LAKE.x, lz - VOLCANO_LAVA_LAKE.z) < 13 + Math.sin(a * 3) * 2.5) return true;
  // Fosso de lava na caldeira, aberto ao sul (por onde se entra).
  const dc = Math.hypot(lx - VOLCANO_CALDERA.x, lz - VOLCANO_CALDERA.z);
  return dc > 17 && dc < 20.5 && !(lz > VOLCANO_CALDERA.z && Math.abs(lx - VOLCANO_CALDERA.x) < 5);
}

/**
 * Relevo das Terras Vulcânicas: campos de basalto quebrado, cones pequenos espalhados e, ao norte, o
 * vulcão: um cone largo com a caldeira plana no topo, cercada por um fosso de lava. O forte fica ao
 * sul, perto da passagem; a Forja, num patamar a oeste. A lava é plana e afundada.
 */
function volcanoHeightSmooth(lx: number, lz: number): number {
  const rough = Math.sin(lx * 0.07 + 1.1) * Math.cos(lz * 0.06) * 2.4 + Math.abs(Math.sin((lx + lz) * 0.05)) * 2.2 + Math.cos(lx * 0.17) * Math.sin(lz * 0.15) * 0.8;
  const cones = Math.max(0, 5 - Math.hypot(lx + 40, lz + 60) * 0.35) + Math.max(0, 4 - Math.hypot(lx - 60, lz + 70) * 0.3) + Math.max(0, 4 - Math.hypot(lx + 70, lz - 40) * 0.3);
  const dCal = Math.hypot(lx - VOLCANO_CALDERA.x, lz - VOLCANO_CALDERA.z);
  // Cone do vulcão: sobe até a borda (r ~24) e a caldeira (r < 17) é plana, um pouco abaixo da borda.
  const volcano = dCal < 17 ? 6 : dCal < 24 ? 6 + (dCal - 17) * 0.6 : Math.max(0, 10.2 - (dCal - 24) * 0.22);
  const dFort = Math.hypot(lx - VOLCANO_FORT.x, lz - VOLCANO_FORT.z);
  const dForge = Math.hypot(lx - VOLCANO_FORGE.x, lz - VOLCANO_FORGE.z);
  const flatten = Math.min(smoothstep(13, 26, dFort), smoothstep(6, 14, dForge), smoothstep(14, 26, dCal));
  const trail = lz > VOLCANO_FORT.z ? smoothstep(4, 12, Math.abs(lx)) : 1;
  const ledge = 3 * (1 - smoothstep(6, 14, dForge));
  const edge = Math.max(Math.abs(lx), Math.abs(lz));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 16 * (lz > 0 ? smoothstep(5, 14, Math.abs(lx)) : 1);
  return 1 + (rough + cones) * flatten * trail + volcano + ledge + wall;
}

/** Lava das Terras Vulcânicas: queima quem pisa (ver `lavaSystem`). */
export function isLava(x: number, z: number): boolean {
  const zone = zoneAt(x, z);
  return zone.id === "vulcao" && lavaLocal(x - zone.center.x, z - zone.center.z);
}

/** O lago congelado dos Picos: chão liso, onde quem anda escorrega. */
export function isIce(x: number, z: number): boolean {
  const zone = zoneAt(x, z);
  if (zone.id !== "picos") return false;
  const lx = x - zone.center.x, lz = z - zone.center.z;
  return Math.hypot(lx - PEAKS_LAKE.x, lz - PEAKS_LAKE.z) < lakeRadius(lx, lz);
}

function valeHeightSmooth(x: number, z: number): number {
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.05) * 4.5 +
    Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 - 0.7) * 1.4 +
    Math.sin((x + z) * 0.021 + 0.4) * 3.2 +
    Math.cos((x - z) * 0.017 - 1.1) * 2.1;

  const distFromCenter = Math.hypot(x, z);
  const distFromArena = Math.hypot(x - 0, z - -82);
  const distFromSwampArena = Math.hypot(x - SWAMP_BOSS_HOME.x, z - SWAMP_BOSS_HOME.z);
  const distFromDesertArena = Math.hypot(x - DESERT_BOSS_HOME.x, z - DESERT_BOSS_HOME.z);
  const flatten = Math.min(
    smoothstep(SPAWN_FLAT_RADIUS, SPAWN_FLAT_RADIUS + 22, distFromCenter),
    smoothstep(13, 24, distFromArena),
    smoothstep(13, 24, distFromSwampArena),
    smoothstep(14, 24, distFromDesertArena),
  );
  const w = biomeWeights(x);
  // Pântano: baixo e encharcado (poças onde o relevo mergulha); deserto: dunas largas e suaves.
  const swampRelief = hills * 0.5 - 1.4 + Math.sin(x * 0.21) * Math.cos(z * 0.19) * 1.4;
  const desertRelief = Math.sin(x * 0.07 + 2) * Math.cos(z * 0.06) * 3 + Math.sin((x - z) * 0.03) * 1.5;
  const relief = hills * w.meadow + swampRelief * w.swamp + desertRelief * w.desert;

  // Bordas sobem para formar uma "muralha" natural, mantendo o jogador dentro.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  // Passagem na muralha norte, onde fica o portão para a Floresta Ancestral.
  const gateNotch = smoothstep(5, 13, Math.hypot(x - 22, z + 102));
  const wall = smoothstep(WORLD_HALF - 18, WORLD_HALF, edge) * 14 * gateNotch;

  // Arenas dos chefes: platô de 6 m ao norte; clareira seca no nível do pântano a oeste;
  // tablado de areia batida, um degrau acima das dunas, a leste.
  const plateau = 6 * (1 - smoothstep(13, 24, distFromArena));
  const swampArena = -1 * (1 - smoothstep(13, 24, distFromSwampArena));
  const desertArena = 1 * (1 - smoothstep(14, 24, distFromDesertArena));
  return relief * flatten + wall + plateau + swampArena + desertArena;
}

/**
 * Altura do terreno em blocos: constante dentro de cada célula e quantizada em degraus.
 * Compartilhada entre domínio (movimento) e apresentação (malha), então o que você vê
 * é exatamente onde as entidades pisam.
 */
export function terrainHeight(x: number, z: number): number {
  if (x >= DUNGEON_REGION_X) return 0;
  const cx = Math.floor(x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const cz = Math.floor(z / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const h = Math.round(terrainHeightSmooth(cx, cz) / STEP_HEIGHT) * STEP_HEIGHT;
  // O lago dos Picos é um espelho de gelo plano; a lava, um espelho incandescente afundado.
  if (isIce(cx, cz)) return PEAKS_ICE;
  if (isLava(cx, cz)) return LAVA_LEVEL;
  // No rio da floresta, o fundo vira espelho d'água plano.
  if (h < FOREST_WATER && zoneAt(cx, cz).id === "floresta") return FOREST_WATER;
  // No pântano, tudo abaixo do nível da água vira um espelho plano (o fundo não importa).
  if (h < WATER_LEVEL && biomeWeights(cx).swamp > 0.5) return WATER_LEVEL;
  return h;
}


/** Água só existe no pântano; o herói anda mais devagar dentro dela. */
export function isWater(x: number, z: number): boolean {
  const zone = zoneAt(x, z);
  if (zone.id === "floresta") return terrainHeight(x, z) <= FOREST_WATER && Math.abs(z - zone.center.z - forestRiverZ(x - zone.center.x)) < 9;
  return biomeWeights(x).swamp > 0.5 && terrainHeight(x, z) <= WATER_LEVEL;
}
