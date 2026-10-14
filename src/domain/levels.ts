import type { Entity } from "./components";

/**
 * Nível de qualquer criatura: o herói usa a progressão; inimigos e chefes têm um nível fixo (do
 * tipo, ou da dungeon onde nasceram).
 */
export function entityLevel(e: Entity): number {
  return e.progression?.level ?? e.level ?? 1;
}

/**
 * Quão perigoso um inimigo é para o herói, pela diferença de nível. É a convenção dos MMOs (Perfect
 * World, WoW): cinza não ameaça, verde é fácil, amarelo é páreo, laranja é duro, vermelho é perigo.
 */
export type LevelDifficulty = "trivial" | "easy" | "even" | "hard" | "deadly";

export function levelDifficulty(heroLevel: number, mobLevel: number): LevelDifficulty {
  const diff = mobLevel - heroLevel;
  if (diff <= -5) return "trivial";
  if (diff <= -2) return "easy";
  if (diff <= 1) return "even";
  if (diff <= 3) return "hard";
  return "deadly";
}
