import type { Entity } from "./components";
import { clockAt } from "./dayCycle";
import { addItem } from "./inventory";
import { createEquipment, createPotion, type Item, type PotionSize, type Rarity } from "./items";
import { seededRandom } from "./worldgen";
import type { World } from "./world";

/**
 * A loja da Mercadora: compra o que o herói não quer, vende poções sempre e alguns equipamentos que
 * mudam a cada dia do relógio do mundo. É o que dá uso ao ouro e um destino ao loot repetido.
 *
 * Regras de preço (pensadas para o ouro dos inimigos: gosma 3, orc 20, chefes 150+):
 * - vender rende 35% do valor do item;
 * - equipamentos à venda custam 3× o valor; poções têm preço fixo;
 * - o que foi vendido pode ser recomprado pelo mesmo preço (rede de segurança contra clique errado).
 */
export const SELL_RATE = 0.35;
export const BUY_RATE = 3;
export const POTION_PRICES: Record<PotionSize, number> = { small: 15, large: 40 };
export const OFFERS_PER_DAY = 4;
export const BUYBACK_LIMIT = 6;

export interface ShopOffer {
  item: Item;
  price: number;
  sold: boolean;
}

export interface ShopState {
  /** Dia do relógio em que o estoque foi montado. */
  day: number;
  offers: ShopOffer[];
  /** Últimos itens vendidos pelo herói, recompráveis pelo preço de venda. */
  buyback: { item: Item; price: number }[];
}

/** Ouro que a loja paga por uma unidade do item. */
export function sellPrice(item: Item): number {
  return Math.max(1, Math.round(item.value * SELL_RATE));
}

/** Tier do estoque conforme o nível do herói. */
export function stockTier(level: number): 1 | 2 | 3 {
  return level <= 3 ? 1 : level <= 7 ? 2 : 3;
}

/** Estoque do dia: determinístico por dia e nível, com ao menos um raro e chance de épico. */
export function rollStock(day: number, level: number): ShopOffer[] {
  const rand = seededRandom(day * 7919 + level * 131 + 17);
  const tier = stockTier(level);
  const rarities: Rarity[] = ["uncommon", "uncommon", "rare", rand() < 0.2 ? "epic" : "rare"];
  return rarities.slice(0, OFFERS_PER_DAY).map((rarity) => {
    const item = createEquipment(rand, tier, rarity);
    return { item, price: Math.round(item.value * BUY_RATE), sold: false };
  });
}

/** Garante o estoque do dia atual (troca à meia-noite do relógio do mundo). */
export function ensureShop(world: World, player: Entity): ShopState {
  const day = clockAt(world.time).day;
  if (!world.shop || world.shop.day !== day) {
    world.shop = { day, offers: rollStock(day, player.progression?.level ?? 1), buyback: world.shop?.buyback ?? [] };
  }
  return world.shop;
}

export type ShopResult = "ok" | "noGold" | "bagFull" | "unavailable";

function pay(player: Entity, price: number): boolean {
  const wallet = player.wallet;
  if (!wallet || wallet.gold < price) return false;
  wallet.gold -= price;
  return true;
}

/** Vende o item da posição da mochila: uma unidade de uma pilha, ou o equipamento inteiro. */
export function sellFromInventory(world: World, player: Entity, index: number): number {
  const inv = player.inventory;
  const item = inv?.items[index];
  if (!inv || !item || !player.wallet) return 0;
  const price = sellPrice(item);
  let sold: Item;
  if (item.quantity > 1) {
    item.quantity -= 1;
    sold = { ...structuredClone(item), quantity: 1 };
  } else {
    inv.items[index] = null;
    sold = item;
  }
  player.wallet.gold += price;
  const shop = ensureShop(world, player);
  shop.buyback.unshift({ item: sold, price });
  shop.buyback.length = Math.min(shop.buyback.length, BUYBACK_LIMIT);
  world.emit({ type: "sell", entity: player.id, itemName: sold.name, gold: price });
  return price;
}

/** Vende de uma vez todos os equipamentos comuns da mochila (lixo de começo de jogo). */
export function sellAllCommon(world: World, player: Entity): number {
  const inv = player.inventory;
  if (!inv) return 0;
  let total = 0;
  inv.items.forEach((item, i) => {
    if (item && item.kind === "equipment" && item.rarity === "common") total += sellFromInventory(world, player, i);
  });
  return total;
}

export function buyOffer(world: World, player: Entity, index: number): ShopResult {
  const shop = ensureShop(world, player);
  const offer = shop.offers[index];
  if (!offer || offer.sold) return "unavailable";
  if ((player.wallet?.gold ?? 0) < offer.price) return "noGold";
  if (!player.inventory || !player.inventory.items.includes(null)) return "bagFull";
  pay(player, offer.price);
  addItem(player.inventory, offer.item);
  offer.sold = true;
  world.emit({ type: "buy", entity: player.id, itemName: offer.item.name, gold: offer.price });
  return "ok";
}

export function buyPotion(world: World, player: Entity, size: PotionSize): ShopResult {
  const price = POTION_PRICES[size];
  if ((player.wallet?.gold ?? 0) < price) return "noGold";
  const potion = createPotion(size, 1);
  if (!player.inventory || !addItem(player.inventory, potion)) return "bagFull";
  pay(player, price);
  world.emit({ type: "buy", entity: player.id, itemName: potion.name, gold: price });
  return "ok";
}

export function buyBack(world: World, player: Entity, index: number): ShopResult {
  const shop = ensureShop(world, player);
  const entry = shop.buyback[index];
  if (!entry) return "unavailable";
  if ((player.wallet?.gold ?? 0) < entry.price) return "noGold";
  if (!player.inventory || !addItem(player.inventory, entry.item)) return "bagFull";
  pay(player, entry.price);
  shop.buyback.splice(index, 1);
  world.emit({ type: "buy", entity: player.id, itemName: entry.item.name, gold: entry.price });
  return "ok";
}
