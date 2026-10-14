import type { Equipment } from "../domain/inventory";
import type { ClassId } from "../domain/classes";
import type { CharacterModel } from "./characters/common";
import { createHero } from "./characters/hero";
import { createBandit, createBogZombie, createGoblin, createOrc, createScorpion, createSlime, createSpider } from "./characters/mobs";
import { createGoblinKing, createSpiderQueen } from "./characters/bosses";
import { createVillager } from "./characters/npcs";

export type { CharacterModel } from "./characters/common";
export { equipmentSignature, createHero, paintWeapon } from "./characters/hero";
export { createBandit, createBogZombie, createGoblin, createOrc, createScorpion, createSlime, createSpider } from "./characters/mobs";
export { createGoblinKing, createSpiderQueen } from "./characters/bosses";
export { createVillager } from "./characters/npcs";

/** Todos os arquétipos conhecidos, na ordem em que aparecem no jogo. */
export const ARCHETYPES = [
  "hero", "slime", "goblin", "orc", "spider", "bogZombie", "scorpion", "bandit",
  "goblinKing", "spiderQueen", "elder", "smith", "guard",
] as const;

export function createModel(archetype: string, equipment?: Equipment, classId?: ClassId): CharacterModel {
  switch (archetype) {
    case "hero": return createHero(equipment, classId);
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "orc": return createOrc();
    case "goblinKing": return createGoblinKing();
    case "spider": return createSpider(false);
    case "spiderQueen": return createSpiderQueen();
    case "bogZombie": return createBogZombie();
    case "scorpion": return createScorpion();
    case "bandit": return createBandit();
    case "elder": return createVillager("elder");
    case "smith": return createVillager("smith");
    case "guard": return createVillager("guard");
    default: return createSlime();
  }
}
