import type { Equipment } from "../domain/inventory";
import type { ClassId } from "../domain/classes";
import type { CharacterModel } from "./characters/common";
import { createHero } from "./characters/hero";
import { createBandit, createBogZombie, createGoblin, createOrc, createScorpion, createSkeleton, createSlime, createSpider } from "./characters/mobs";
import { createGoblinKing, createScorpionEmperor, createSkeletonLord, createSpiderQueen } from "./characters/bosses";
import { createVillager } from "./characters/npcs";
import { createAncientTreant, createElvenSpirit, createEnt, createRanger, createWolf } from "./characters/forest";

export type { CharacterModel } from "./characters/common";
export { equipmentSignature, createHero, paintWeapon } from "./characters/hero";
export { createBandit, createBogZombie, createGoblin, createOrc, createScorpion, createSlime, createSpider } from "./characters/mobs";
export { createGoblinKing, createScorpionEmperor, createSpiderQueen } from "./characters/bosses";
export { createVillager } from "./characters/npcs";

/** Todos os arquétipos conhecidos, na ordem em que aparecem no jogo. */
export const ARCHETYPES = [
  "hero", "slime", "goblin", "goblinArcher", "orc", "spider", "bogZombie", "scorpion", "bandit", "banditArcher",
  "goblinKing", "spiderQueen", "scorpionEmperor", "skeleton", "skeletonArcher", "skeletonLord", "wolf", "ent", "elvenSpirit", "ancientTreant",
  "elder", "smith", "guard", "merchant", "ranger",
] as const;

export function createModel(archetype: string, equipment?: Equipment, classId?: ClassId): CharacterModel {
  switch (archetype) {
    case "hero": return createHero(equipment, classId);
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "goblinArcher": return createGoblin(true);
    case "orc": return createOrc();
    case "goblinKing": return createGoblinKing();
    case "spider": return createSpider(false);
    case "spiderQueen": return createSpiderQueen();
    case "bogZombie": return createBogZombie();
    case "scorpion": return createScorpion();
    case "bandit": return createBandit();
    case "banditArcher": return createBandit(true);
    case "scorpionEmperor": return createScorpionEmperor();
    case "skeleton": return createSkeleton();
    case "skeletonArcher": return createSkeleton(true);
    case "skeletonLord": return createSkeletonLord();
    case "wolf": return createWolf();
    case "ent": return createEnt();
    case "elvenSpirit": return createElvenSpirit();
    case "ancientTreant": return createAncientTreant();
    case "ranger": return createRanger();
    case "elder": return createVillager("elder");
    case "smith": return createVillager("smith");
    case "guard": return createVillager("guard");
    case "merchant": return createVillager("merchant");
    default: return createSlime();
  }
}
