import { smoothstep } from "./math";
import { zoneAt } from "./zones";

export type Biome = "meadow" | "swamp" | "desert" | "forest" | "ruins" | "snow" | "volcano";

/** Fronteiras em X: pântano a oeste, deserto a leste, campina no meio. */
export const SWAMP_EDGE = -34;
export const DESERT_EDGE = 34;
const BLEND = 10;

export function biomeAt(x: number, z: number): Biome {
  const zone = zoneAt(x, z);
  if (zone.id === "floresta") return x - zone.center.x > 45 ? "ruins" : "forest";
  if (zone.id === "picos") return "snow";
  if (zone.id === "vulcao") return "volcano";
  if (x < SWAMP_EDGE) return "swamp";
  if (x > DESERT_EDGE) return "desert";
  return "meadow";
}

/** Peso contínuo (0..1) de cada bioma num ponto, para misturar relevo e cor sem degraus bruscos. */
export function biomeWeights(x: number): { meadow: number; swamp: number; desert: number } {
  const swamp = 1 - smoothstep(SWAMP_EDGE - BLEND / 2, SWAMP_EDGE + BLEND / 2, x);
  const desert = smoothstep(DESERT_EDGE - BLEND / 2, DESERT_EDGE + BLEND / 2, x);
  return { meadow: 1 - swamp - desert, swamp, desert };
}

/** Centro da arena da Rainha Aranha, no extremo oeste. */
export const SWAMP_BOSS_HOME = { x: -82, z: 0 };
/** Centro da arena do Imperador Escorpião, no extremo leste. */
export const DESERT_BOSS_HOME = { x: 82, z: 0 };

export const BIOME_LABEL: Record<Biome, string> = {
  meadow: "Campinas do Vale",
  swamp: "Pântano Sombrio",
  desert: "Deserto Escaldante",
  forest: "Floresta Ancestral",
  ruins: "Ruínas de Elar",
  snow: "Picos Gelados",
  volcano: "Terras Vulcânicas",
};
