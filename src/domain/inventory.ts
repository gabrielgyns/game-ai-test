import type { Entity } from "./components";
import type { EquipSlot, Item, ItemStats } from "./items";
import type { World } from "./world";

export interface Inventory {
  items: (Item | null)[];
  capacity: number;
}

export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
}

export function createInventory(capacity = 20): Inventory {
  return { items: Array.from({ length: capacity }, () => null), capacity };
}

export function createEquipment(): Equipment {
  return { weapon: null, armor: null, accessory: null };
}

export function addItem(inv: Inventory, item: Item): boolean {
  const i = inv.items.indexOf(null);
  if (i === -1) return false;
  inv.items[i] = item;
  return true;
}

export function removeAt(inv: Inventory, index: number): Item | null {
  const item = inv.items[index] ?? null;
  if (item) inv.items[index] = null;
  return item;
}

export function countItems(inv: Inventory, predicate: (item: Item) => boolean): number {
  return inv.items.filter((i): i is Item => i !== null && predicate(i)).length;
}

/** Soma dos bônus de tudo que está equipado. */
export function equipmentBonus(eq: Equipment): Required<ItemStats> {
  const total = { damage: 0, maxHealth: 0, speedPercent: 0 };
  for (const item of [eq.weapon, eq.armor, eq.accessory]) {
    if (!item) continue;
    total.damage += item.stats.damage ?? 0;
    total.maxHealth += item.stats.maxHealth ?? 0;
    total.speedPercent += item.stats.speedPercent ?? 0;
  }
  return total;
}

/**
 * Recalcula os atributos efetivos a partir dos valores base (que o nível altera)
 * mais os bônus de equipamento. Vida atual é mantida proporcional quando a máxima muda.
 */
export function recomputeStats(entity: Entity): void {
  const eq = entity.equipment;
  const bonus = eq ? equipmentBonus(eq) : { damage: 0, maxHealth: 0, speedPercent: 0 };
  entity.combat.damage = entity.combat.baseDamage + bonus.damage;
  const oldMax = entity.health.max;
  entity.health.max = entity.health.baseMax + bonus.maxHealth;
  if (oldMax > 0 && entity.health.current > 0) {
    entity.health.current = Math.min(entity.health.max, Math.round((entity.health.current / oldMax) * entity.health.max));
  }
  entity.movement.speedMultiplier = 1 + bonus.speedPercent / 100;
}

/** Equipa o item do slot `index` do inventário, devolvendo o anterior para o mesmo slot. */
export function equipFromInventory(world: World, entity: Entity, index: number): boolean {
  const inv = entity.inventory;
  const eq = entity.equipment;
  if (!inv || !eq) return false;
  const item = inv.items[index];
  if (!item || item.kind !== "equipment" || !item.slot) return false;
  const previous = eq[item.slot];
  eq[item.slot] = item;
  inv.items[index] = previous;
  recomputeStats(entity);
  world.emit({ type: "equip", entity: entity.id, itemId: item.id, slot: item.slot });
  return true;
}

/** Tira o item do slot de equipamento e o guarda no inventário (se houver espaço). */
export function unequip(world: World, entity: Entity, slot: EquipSlot): boolean {
  const inv = entity.inventory;
  const eq = entity.equipment;
  if (!inv || !eq) return false;
  const item = eq[slot];
  if (!item) return false;
  if (!addItem(inv, item)) {
    world.emit({ type: "inventoryFull", entity: entity.id });
    return false;
  }
  eq[slot] = null;
  recomputeStats(entity);
  world.emit({ type: "unequip", entity: entity.id, itemId: item.id, slot });
  return true;
}

/** Usa um consumível do inventário. */
export function useItem(world: World, entity: Entity, index: number): boolean {
  const inv = entity.inventory;
  if (!inv) return false;
  const item = inv.items[index];
  if (!item || item.kind !== "consumable") return false;
  if (item.healFraction) {
    if (entity.health.current >= entity.health.max) return false;
    const amount = Math.round(entity.health.max * item.healFraction);
    entity.health.current = Math.min(entity.health.max, entity.health.current + amount);
    world.emit({ type: "heal", entity: entity.id, amount });
  }
  inv.items[index] = null;
  world.emit({ type: "consume", entity: entity.id, itemId: item.id });
  return true;
}

/** Usa a primeira poção encontrada (atalho rápido). */
export function useFirstPotion(world: World, entity: Entity): boolean {
  const inv = entity.inventory;
  if (!inv) return false;
  const index = inv.items.findIndex((i) => i?.kind === "consumable");
  return index === -1 ? false : useItem(world, entity, index);
}
