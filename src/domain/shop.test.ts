import { beforeEach, describe, expect, it } from "vitest";
import { AFFIXES, affixCount, rollAffixes, type AffixId } from "./affixes";
import { createEnemy, createPlayer } from "./factories";
import { addItem, equipFromInventory, MAX_COOLDOWN_REDUCTION } from "./inventory";
import { createEquipment, createPotion, resetItemIds, type Item } from "./items";
import { restoreGame, serializeGame } from "./save";
import {
  BUY_RATE, POTION_PRICES, buyBack, buyOffer, buyPotion, ensureShop, rollStock, sellAllCommon, sellFromInventory, sellPrice, stockTier,
} from "./shop";
import { stepWorld } from "./simulation";
import { applyDamage, CRIT_MULTIPLIER } from "./systems/combat";
import { DAY_LENGTH } from "./dayCycle";
import { generateWorld, seededRandom } from "./worldgen";
import { World } from "./world";

beforeEach(() => resetItemIds());

/** Equipamento com um único afixo escolhido, para testar o efeito isolado. */
function gear(slot: "weapon" | "armor" | "accessory", affix: AffixId, value: number): Item {
  return { id: 900, name: `Teste${AFFIXES[affix].suffix}`, kind: "equipment", slot, rarity: "rare", stats: {}, icon: "ring", value: 50, quantity: 1, maxStack: 1, affixes: [{ id: affix, value }] };
}

function equip(world: World, player: ReturnType<typeof createPlayer>, item: Item) {
  addItem(player.inventory!, item);
  equipFromInventory(world, player, player.inventory!.items.indexOf(item));
}

describe("afixos", () => {
  it("raridade decide quantos: comum nenhum, incomum um, épico dois", () => {
    const r = seededRandom(1);
    expect(affixCount("common", r)).toBe(0);
    expect(affixCount("uncommon", r)).toBe(1);
    expect(affixCount("epic", r)).toBe(2);
  });

  it("só sorteia afixos permitidos no slot, sem repetir, com valor que cresce com o tier", () => {
    const r = seededRandom(5);
    for (let i = 0; i < 50; i++) {
      const affixes = rollAffixes(r, "weapon", 2, "epic");
      expect(new Set(affixes.map((a) => a.id)).size).toBe(affixes.length);
      for (const a of affixes) expect(AFFIXES[a.id].slots).toContain("weapon");
    }
    const avg = (tier: 1 | 2 | 3) => {
      const rr = seededRandom(9);
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += rollAffixes(rr, "armor", tier, "uncommon").find((a) => a.id === "bear")?.value ?? 0;
      return sum;
    };
    expect(avg(3)).toBeGreaterThan(avg(1));
  });

  it("o primeiro afixo vira o sobrenome do item e aumenta o valor", () => {
    const r = seededRandom(3);
    let found: Item | undefined;
    for (let i = 0; i < 30 && !found; i++) {
      const item = createEquipment(r, 2, "rare");
      if (item.affixes?.length) found = item;
    }
    expect(found).toBeDefined();
    expect(found!.name.endsWith(AFFIXES[found!.affixes![0]!.id].suffix)).toBe(true);
    const plain = createEquipment(() => 0, 2, "common");
    expect(plain.affixes).toBeUndefined();
  });

  it("da Serpente regenera vida mesmo em combate", () => {
    const world = new World();
    const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    equip(world, p, gear("armor", "serpent", 4));
    p.health.current = 50;
    p.health.lastDamagedAt = 0; // acabou de apanhar: a regeneração normal está parada
    stepWorld(world, 1);
    expect(p.health.current).toBeCloseTo(54, 0);
  });

  it("da Águia acerta críticos de 75% a mais, e o evento avisa", () => {
    const world = new World();
    world.random = () => 0; // sempre crítico
    const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    equip(world, p, gear("weapon", "eagle", 10));
    world.drainEvents();
    applyDamage(world, p, slime, 10);
    const ev = world.drainEvents().find((e) => e.type === "damage");
    expect(ev && ev.type === "damage" && ev.crit).toBe(true);
    expect(slime.health.current).toBe(slime.health.max - Math.round(10 * CRIT_MULTIPLIER));
  });

  it("do Vampiro devolve parte do dano como vida", () => {
    const world = new World();
    const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    equip(world, p, gear("weapon", "vampire", 10));
    p.health.current = 50;
    applyDamage(world, p, orc, 40);
    expect(p.health.current).toBeCloseTo(54);
  });

  it("do Sábio reduz a recarga, até o limite", () => {
    const world = new World();
    const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    equip(world, p, gear("weapon", "sage", 100));
    expect(p.bonuses!.cooldownPercent).toBe(MAX_COOLDOWN_REDUCTION);
    p.abilities!.queuedSkill = "warcry";
    stepWorld(world, 1 / 60);
    const warcry = p.abilities!.skills.find((s) => s.id === "warcry")!;
    expect(warcry.cooldownLeft).toBeCloseTo(20 * 0.6, 0);
  });

  it("da Fortuna aumenta o ouro de cada inimigo", () => {
    const world = new World();
    const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    equip(world, p, gear("accessory", "fortune", 50));
    applyDamage(world, p, orc, 9999);
    expect(p.wallet!.gold).toBe(Math.round(orc.ai!.goldReward * 1.5));
  });
});

describe("nomes de item", () => {
  it("o adjetivo da raridade concorda em gênero e número", async () => {
    const { agree } = await import("./items");
    expect(agree(" Reforçad@", "Botas Ligeiras")).toBe(" Reforçadas");
    expect(agree(" Reforçad@", "Espada Longa")).toBe(" Reforçada");
    expect(agree(" Reforçad@", "Arco Longo")).toBe(" Reforçado");
  });
});

describe("loja da Mercadora", () => {
  function shopWorld(gold = 1000) {
    const world = generateWorld({ seed: 4 });
    const p = world.player!;
    p.wallet!.gold = gold;
    return { world, p };
  }

  it("a Mercadora vive no santuário e tem loja", () => {
    const world = generateWorld();
    const merchant = [...world.npcs()].find((n) => n.npc?.id === "merchant");
    expect(merchant).toBeDefined();
    expect(Math.hypot(merchant!.transform.position.x, merchant!.transform.position.z)).toBeLessThan(10);
  });

  it("vender paga 35% do valor; pilhas vendem uma unidade por vez", () => {
    const { world, p } = shopWorld(0);
    const sword = createEquipment(() => 0.3, 2, "rare");
    addItem(p.inventory!, sword);
    const idx = p.inventory!.items.indexOf(sword);
    expect(sellFromInventory(world, p, idx)).toBe(sellPrice(sword));
    expect(p.wallet!.gold).toBe(sellPrice(sword));
    expect(p.inventory!.items[idx]).toBeNull();

    const potions = p.inventory!.items.find((i) => i?.kind === "consumable")!; // 2 poções pequenas iniciais
    const pi = p.inventory!.items.indexOf(potions);
    sellFromInventory(world, p, pi);
    expect(potions.quantity).toBe(1);
  });

  it("vende todos os comuns de uma vez e deixa o resto", () => {
    const { world, p } = shopWorld(0);
    addItem(p.inventory!, createEquipment(() => 0.1, 1, "common"));
    addItem(p.inventory!, createEquipment(() => 0.2, 1, "common"));
    const rare = createEquipment(() => 0.3, 1, "rare");
    addItem(p.inventory!, rare);
    const total = sellAllCommon(world, p);
    expect(total).toBeGreaterThan(0);
    expect(p.inventory!.items.filter((i) => i?.kind === "equipment")).toEqual([rare]);
  });

  it("o estoque é fixo durante o dia e muda no dia seguinte, com tier pelo nível", () => {
    const { world, p } = shopWorld();
    const today = ensureShop(world, p).offers.map((o) => o.item.name);
    expect(ensureShop(world, p).offers.map((o) => o.item.name)).toEqual(today);
    world.time += DAY_LENGTH;
    const tomorrow = ensureShop(world, p).offers.map((o) => o.item.name);
    expect(tomorrow).not.toEqual(today);
    expect(stockTier(1)).toBe(1);
    expect(stockTier(5)).toBe(2);
    expect(stockTier(9)).toBe(3);
    const stock = rollStock(3, 9);
    expect(stock.every((o) => o.item.tier === 3 && o.price === Math.round(o.item.value * BUY_RATE))).toBe(true);
    expect(stock.some((o) => o.item.rarity === "rare" || o.item.rarity === "epic")).toBe(true);
  });

  it("comprar cobra, entrega o item e esgota a oferta; sem ouro ou sem espaço, recusa", () => {
    const { world, p } = shopWorld();
    const offer = ensureShop(world, p).offers[0]!;
    const gold = p.wallet!.gold;
    expect(buyOffer(world, p, 0)).toBe("ok");
    expect(p.wallet!.gold).toBe(gold - offer.price);
    expect(p.inventory!.items).toContain(offer.item);
    expect(buyOffer(world, p, 0)).toBe("unavailable");

    p.wallet!.gold = 0;
    expect(buyOffer(world, p, 1)).toBe("noGold");
    p.wallet!.gold = 99999;
    p.inventory!.items = p.inventory!.items.map((i) => i ?? createEquipment(() => 0, 1, "common"));
    expect(buyOffer(world, p, 1)).toBe("bagFull");
  });

  it("poções têm preço fixo e empilham", () => {
    const { world, p } = shopWorld(100);
    expect(buyPotion(world, p, "large")).toBe("ok");
    expect(buyPotion(world, p, "large")).toBe("ok");
    expect(p.wallet!.gold).toBe(100 - 2 * POTION_PRICES.large);
    const large = p.inventory!.items.find((i) => i?.name === "Poção Grande")!;
    expect(large.quantity).toBe(2);
    expect(buyPotion(world, p, "large")).toBe("noGold");
  });

  it("recompra devolve o item vendido pelo mesmo preço", () => {
    const { world, p } = shopWorld(0);
    const amulet = createEquipment(() => 0.9, 3, "epic");
    addItem(p.inventory!, amulet);
    const price = sellFromInventory(world, p, p.inventory!.items.indexOf(amulet));
    expect(ensureShop(world, p).buyback[0]!.item).toBe(amulet);
    expect(buyBack(world, p, 0)).toBe("ok");
    expect(p.wallet!.gold).toBe(0);
    expect(p.inventory!.items).toContain(amulet);
    expect(price).toBeGreaterThan(0);
  });

  it("loja e afixos fazem a viagem pelo save", () => {
    const { world, p } = shopWorld();
    const shop = ensureShop(world, p);
    buyOffer(world, p, 0);
    addItem(p.inventory!, createPotion("small"));
    sellFromInventory(world, p, p.inventory!.items.findIndex((i) => i?.kind === "consumable"));
    const restored = restoreGame(serializeGame(world, 4));
    expect(restored.shop!.day).toBe(shop.day);
    expect(restored.shop!.offers.map((o) => o.sold)).toEqual(shop.offers.map((o) => o.sold));
    expect(restored.shop!.buyback).toHaveLength(1);
    const bought = restored.player!.inventory!.items.find((i) => i?.name === shop.offers[0]!.item.name);
    expect(bought?.affixes).toEqual(shop.offers[0]!.item.affixes);
  });
});
