import type { Entity } from "./components";
import { createEquipment, createPotion, rollRarity } from "./items";
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
};

/** Sorteia e espalha os drops de um inimigo morto ao redor de onde ele caiu. */
export function rollLoot(world: World, victim: Entity): void {
  const table = LOOT_TABLES[victim.archetype];
  if (!table) return;
  const rand = world.random;
  const scatter = () => ({
    x: victim.transform.position.x + (rand() - 0.5) * 1.6,
    y: victim.transform.position.y,
    z: victim.transform.position.z + (rand() - 0.5) * 1.6,
  });
  if (rand() < table.equipmentChance) {
    world.addDrop(createEquipment(rand, table.tier, rollRarity(rand, table.tier)), scatter());
  }
  if (rand() < table.potionChance) {
    world.addDrop(createPotion(rand() < table.largePotionChance ? "large" : "small"), scatter());
  }
}
