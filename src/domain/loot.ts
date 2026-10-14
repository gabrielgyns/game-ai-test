import type { Entity } from "./components";
import { entityLevel } from "./levels";
import { createEquipment, createPotion, rollRarity } from "./items";
import { createSetPiece, pickSetSlot, setForBoss } from "./sets";
import type { World } from "./world";

interface LootTable {
  tier: 1 | 2 | 3;
  equipmentChance: number;
  potionChance: number;
  /** Chance de a poção ser grande em vez de pequena. */
  largePotionChance: number;
}

const LOOT_TABLES: Record<string, LootTable> = {
  slime: { tier: 1, equipmentChance: 0.18, potionChance: 0.3, largePotionChance: 0 },
  goblin: { tier: 2, equipmentChance: 0.4, potionChance: 0.3, largePotionChance: 0.25 },
  orc: { tier: 3, equipmentChance: 0.85, potionChance: 0.45, largePotionChance: 0.7 },
  spider: { tier: 2, equipmentChance: 0.3, potionChance: 0.25, largePotionChance: 0.3 },
  bogZombie: { tier: 3, equipmentChance: 0.6, potionChance: 0.4, largePotionChance: 0.6 },
  scorpion: { tier: 3, equipmentChance: 0.5, potionChance: 0.3, largePotionChance: 0.6 },
  bandit: { tier: 3, equipmentChance: 0.7, potionChance: 0.35, largePotionChance: 0.6 },
  skeleton: { tier: 2, equipmentChance: 0.4, potionChance: 0.3, largePotionChance: 0.4 },
  skeletonArcher: { tier: 2, equipmentChance: 0.4, potionChance: 0.3, largePotionChance: 0.4 },
  goblinArcher: { tier: 2, equipmentChance: 0.45, potionChance: 0.3, largePotionChance: 0.25 },
  banditArcher: { tier: 3, equipmentChance: 0.7, potionChance: 0.35, largePotionChance: 0.6 },
};

/** Sorteia e espalha os drops de um inimigo morto ao redor de onde ele caiu. */
export function rollLoot(world: World, victim: Entity): void {
  const rand = world.random;
  const scatter = (spread = 1.6) => ({
    x: victim.transform.position.x + (rand() - 0.5) * spread,
    y: victim.transform.position.y,
    z: victim.transform.position.z + (rand() - 0.5) * spread,
  });
  // O item tem o nível de quem o derrubou: na dificuldade alta (ou na cripta) o loot cresce junto.
  const level = entityLevel(victim);
  if (victim.boss) {
    // Chefe: loot garantido e generoso, com uma peça do conjunto dele (de preferência uma que falta).
    const set = setForBoss(victim.archetype);
    const hero = world.player;
    if (set) world.addDrop(createSetPiece(set.id, pickSetSlot(set.id, hero ?? {}, rand), hero?.classId ?? "warrior", level), scatter(3));
    world.addDrop(createEquipment(rand, 3, set ? (rand() < 0.5 ? "rare" : "epic") : "epic", level), scatter(3));
    if (!set) world.addDrop(createEquipment(rand, 3, rand() < 0.5 ? "rare" : "epic", level), scatter(3));
    world.addDrop(createPotion("large", 2), scatter(3));
    return;
  }
  if (victim.miniboss) {
    // Guardião: um raro ou épico garantido, além do sorteio normal abaixo.
    world.addDrop(createEquipment(rand, victim.ai?.lootTier ?? 3, rand() < 0.3 ? "epic" : "rare", level), scatter(2));
  }
  const table = LOOT_TABLES[victim.archetype];
  if (!table) return;
  // Inimigos de dungeon carregam o tier do nível da dungeon; acima do nível 12 (dificuldade alta), tier 3.
  const tier = victim.ai?.lootTier ?? (level > 12 ? 3 : table.tier);
  if (rand() < table.equipmentChance) {
    world.addDrop(createEquipment(rand, tier, rollRarity(rand, tier), level), scatter());
  }
  if (rand() < table.potionChance) {
    world.addDrop(createPotion(rand() < table.largePotionChance ? "large" : "small"), scatter());
  }
}
