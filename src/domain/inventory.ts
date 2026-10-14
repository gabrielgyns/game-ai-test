import type { Bonuses, Entity } from "./components";
import { activeSetBonuses } from "./sets";
import { AFFIXES, type BonusStat } from "./affixes";
import { canStack, type EquipSlot, type Item } from "./items";
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

/** Guarda o item, empilhando em pilhas existentes do mesmo tipo antes de ocupar um slot vazio. */
export function addItem(inv: Inventory, item: Item): boolean {
  let remaining = item.quantity;
  if (item.maxStack > 1) {
    for (const existing of inv.items) {
      if (!existing || !canStack(existing, item) || existing.quantity >= existing.maxStack) continue;
      const moved = Math.min(remaining, existing.maxStack - existing.quantity);
      existing.quantity += moved;
      remaining -= moved;
      if (remaining === 0) return true;
    }
  }
  item.quantity = remaining; // parte pode ter sido empilhada; o resto segue com o item
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

/** Conta unidades (somando pilhas) dos itens que satisfazem o predicado. */
export function countItems(inv: Inventory, predicate: (item: Item) => boolean): number {
  return inv.items.reduce((n, i) => (i && predicate(i) ? n + i.quantity : n), 0);
}

export type BonusTotals = Record<BonusStat, number>;

export const emptyBonus = (): BonusTotals => ({ damage: 0, maxHealth: 0, speedPercent: 0, regen: 0, critChance: 0, lifesteal: 0, cooldownPercent: 0, goldPercent: 0 });

/** Tudo que um item concede: atributos do modelo mais os afixos. */
export function itemBonus(item: Item): BonusTotals {
  const total = emptyBonus();
  total.damage += item.stats.damage ?? 0;
  total.maxHealth += item.stats.maxHealth ?? 0;
  total.speedPercent += item.stats.speedPercent ?? 0;
  for (const a of item.affixes ?? []) total[AFFIXES[a.id].stat] += a.value;
  return total;
}

/** Soma dos bônus de tudo que está equipado. */
export function equipmentBonus(eq: Equipment): BonusTotals {
  const total = emptyBonus();
  for (const item of [eq.weapon, eq.armor, eq.accessory]) {
    if (!item) continue;
    const b = itemBonus(item);
    for (const k of Object.keys(total) as BonusStat[]) total[k] += b[k];
  }
  // Conjuntos: duas peças do mesmo conjunto somam o bônus de atributo.
  const sets = activeSetBonuses(eq).stats;
  for (const k of Object.keys(sets) as BonusStat[]) total[k] += sets[k] ?? 0;
  return total;
}

/** Limite da redução de recarga, para habilidades nunca ficarem sem custo. */
export const MAX_COOLDOWN_REDUCTION = 40;

/**
 * Recalcula os atributos efetivos a partir dos valores base (que o nível altera)
 * mais os bônus de equipamento. Vida atual é mantida proporcional quando a máxima muda.
 */
export function recomputeStats(entity: Entity): void {
  const eq = entity.equipment;
  const bonus = eq ? equipmentBonus(eq) : emptyBonus();
  entity.combat.damage = entity.combat.baseDamage + bonus.damage;
  if (eq) {
    const bonuses: Bonuses = {
      critChance: bonus.critChance,
      lifesteal: bonus.lifesteal,
      cooldownPercent: Math.min(MAX_COOLDOWN_REDUCTION, bonus.cooldownPercent),
      goldPercent: bonus.goldPercent,
      regen: bonus.regen,
      powers: activeSetBonuses(eq).powers,
    };
    entity.bonuses = bonuses;
  }
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
  item.quantity -= 1;
  if (item.quantity <= 0) inv.items[index] = null;
  world.emit({ type: "consume", entity: entity.id, itemId: item.id });
  return true;
}

/**
 * Atalho da poção: escolhe a menor que ainda cura bem o que falta, para não desperdiçar
 * uma grande quando uma pequena resolve.
 */
export function useFirstPotion(world: World, entity: Entity): boolean {
  const inv = entity.inventory;
  if (!inv) return false;
  const missing = 1 - entity.health.current / entity.health.max;
  let best = -1;
  let bestScore = Infinity;
  inv.items.forEach((item, i) => {
    if (!item || item.kind !== "consumable" || !item.healFraction) return;
    // Prefere a menor poção que cobre o que falta; se nenhuma cobre, a maior.
    const score = item.healFraction >= missing ? item.healFraction : 10 - item.healFraction;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best === -1 ? false : useItem(world, entity, best);
}
