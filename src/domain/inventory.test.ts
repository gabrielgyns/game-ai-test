import { beforeEach, describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { addItem, equipFromInventory, unequip, useFirstPotion, useItem } from "./inventory";
import { createEquipment, createPotion, resetItemIds, rollRarity, RARITY_MULTIPLIER } from "./items";
import { stepWorld } from "./simulation";
import { seededRandom } from "./worldgen";
import { World } from "./world";

beforeEach(() => resetItemIds());

function setup() {
  const world = new World();
  world.random = seededRandom(42);
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  return { world, player };
}

describe("itens", () => {
  it("raridade multiplica os atributos", () => {
    const rand = () => 0; // sempre o primeiro modelo do tier
    const common = createEquipment(rand, 2, "common");
    const epic = createEquipment(rand, 2, "epic");
    expect(epic.stats.damage).toBe(Math.round(common.stats.damage! * RARITY_MULTIPLIER.epic));
    expect(epic.name).not.toBe(common.name);
  });

  it("tiers altos sorteiam raridades melhores com mais frequência", () => {
    const rand = seededRandom(7);
    const count = (tier: 1 | 3) => {
      let good = 0;
      for (let i = 0; i < 2000; i++) if (["rare", "epic"].includes(rollRarity(rand, tier))) good++;
      return good;
    };
    expect(count(3)).toBeGreaterThan(count(1) * 3);
  });
});

describe("inventário e equipamento", () => {
  it("herói começa com espada equipada e duas poções", () => {
    const { player } = setup();
    expect(player.equipment?.weapon?.name).toBe("Espada Velha");
    expect(player.combat.damage).toBe(player.combat.baseDamage + 4);
    expect(player.inventory?.items.filter((i) => i?.kind === "consumable")).toHaveLength(2);
  });

  it("equipar troca com o item anterior e recalcula atributos", () => {
    const { world, player } = setup();
    const sword = createEquipment(() => 0.3, 1, "rare"); // Espada Curta rara
    addItem(player.inventory!, sword);
    const index = player.inventory!.items.indexOf(sword);
    expect(equipFromInventory(world, player, index)).toBe(true);
    expect(player.equipment?.weapon).toBe(sword);
    expect(player.inventory!.items[index]?.name).toBe("Espada Velha");
    expect(player.combat.damage).toBe(player.combat.baseDamage + sword.stats.damage!);
  });

  it("armadura aumenta vida máxima mantendo a proporção da vida atual", () => {
    const { world, player } = setup();
    player.health.current = 50; // 50%
    const armor = createEquipment(() => 0.5, 1, "common"); // Túnica de Couro (+15)
    addItem(player.inventory!, armor);
    equipFromInventory(world, player, player.inventory!.items.indexOf(armor));
    expect(player.health.max).toBe(115);
    expect(player.health.current).toBe(Math.round(0.5 * 115));
    expect(unequip(world, player, "armor")).toBe(true);
    expect(player.health.max).toBe(100);
  });

  it("botas aumentam a velocidade efetiva", () => {
    const { world, player } = setup();
    const boots = createEquipment(() => 0.9, 1, "common"); // Botas Ligeiras (+8%)
    addItem(player.inventory!, boots);
    equipFromInventory(world, player, player.inventory!.items.indexOf(boots));
    expect(player.movement.speedMultiplier).toBeCloseTo(1.08);
    player.movement.intent = { x: 1, z: 0 };
    stepWorld(world, 1);
    expect(player.transform.position.x).toBeCloseTo(7 * 1.08, 3);
  });

  it("poção cura 40% e é consumida", () => {
    const { world, player } = setup();
    player.health.current = 10;
    expect(useFirstPotion(world, player)).toBe(true);
    expect(player.health.current).toBe(50);
    expect(player.inventory?.items.filter((i) => i?.kind === "consumable")).toHaveLength(1);
    player.health.current = player.health.max;
    expect(useFirstPotion(world, player)).toBe(false); // vida cheia não desperdiça
  });

  it("inventário cheio recusa itens", () => {
    const { player } = setup();
    for (let i = 0; i < 30; i++) addItem(player.inventory!, createPotion());
    expect(player.inventory!.items.every((i) => i !== null)).toBe(true);
    expect(addItem(player.inventory!, createPotion())).toBe(false);
  });

  it("useItem ignora equipamentos", () => {
    const { world, player } = setup();
    const sword = createEquipment(() => 0, 1, "common");
    addItem(player.inventory!, sword);
    expect(useItem(world, player, player.inventory!.items.indexOf(sword))).toBe(false);
  });
});

describe("loot e coleta", () => {
  it("orc morto deixa drops e o jogador coleta ao se aproximar", () => {
    const { world, player } = setup();
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    orc.health.current = 1;
    player.combat.wantsAttack = true;
    const events = stepWorld(world, 0.016);
    const dropped = events.filter((e) => e.type === "drop").length;
    expect(dropped).toBeGreaterThan(0); // orc tem 85% de chance de item; seed 42 garante pelo menos um
    // Jogador está a ~1 m: coleta automática no mesmo tick ou no próximo.
    const picked = [...events, ...stepWorld(world, 0.016)].filter((e) => e.type === "pickup").length;
    expect(picked).toBe(dropped);
    expect(world.drops.size).toBe(0);
    expect(player.inventory!.items.filter((i) => i !== null).length).toBe(2 + dropped);
  });

  it("drops longe não são coletados e expiram", () => {
    const { world, player } = setup();
    world.addDrop(createPotion(), { x: 20, y: 0, z: 0 });
    stepWorld(world, 1);
    expect(world.drops.size).toBe(1);
    expect(player.inventory!.items.filter((i) => i !== null)).toHaveLength(2);
    stepWorld(world, 200);
    expect(world.drops.size).toBe(0);
  });

  it("com inventário cheio o drop fica no chão e avisa", () => {
    const { world, player } = setup();
    for (let i = 0; i < 30; i++) addItem(player.inventory!, createPotion());
    world.addDrop(createPotion(), { x: 0.5, y: 0, z: 0 });
    const events = stepWorld(world, 0.016);
    expect(events.some((e) => e.type === "inventoryFull")).toBe(true);
    expect(world.drops.size).toBe(1);
  });
});
