import { beforeEach, describe, expect, it } from "vitest";
import { addItem, equipFromInventory } from "./inventory";
import { createEquipment, createPotion, resetItemIds } from "./items";
import { acceptQuest } from "./quests";
import { describeSave, isSaveData, restoreGame, serializeGame } from "./save";
import { stepWorld } from "./simulation";
import { generateWorld } from "./worldgen";

beforeEach(() => resetItemIds());

describe("salvar e carregar", () => {
  it("faz a viagem de ida e volta do estado do herói, mochila, equipamento, quests e drops", () => {
    const world = generateWorld({ seed: 99 });
    const p = world.player!;
    p.transform.position = { x: 12, y: 0, z: -7 };
    p.health.baseMax = 150;
    p.combat.baseDamage = 20;
    p.progression!.level = 4;
    p.progression!.xp = 33;
    p.wallet!.gold = 321;
    p.stats!.kills = 17;
    const axe = createEquipment(() => 0.1, 2, "epic");
    addItem(p.inventory!, axe);
    equipFromInventory(world, p, p.inventory!.items.indexOf(axe));
    addItem(p.inventory!, createPotion("large", 4));
    acceptQuest(world, p, "slimes");
    p.quests!.slimes!.progress = 3;
    world.addDrop(createPotion("small"), { x: 1, y: 0, z: 1 });
    stepWorld(world, 0.5);
    p.health.current = 77;

    const json = JSON.stringify(serializeGame(world, 99));
    const parsed: unknown = JSON.parse(json);
    expect(isSaveData(parsed)).toBe(true);
    const restored = restoreGame(parsed as never);
    const r = restored.player!;

    expect(r.transform.position).toEqual(p.transform.position);
    expect(r.health.current).toBe(77);
    expect(r.health.max).toBe(p.health.max);
    expect(r.combat.damage).toBe(p.combat.damage); // base + machado épico
    expect(r.progression).toEqual(p.progression);
    expect(r.wallet!.gold).toBe(321);
    expect(r.stats!.kills).toBe(17);
    expect(r.equipment!.weapon?.name).toBe(axe.name);
    expect(r.inventory!.items.filter(Boolean).map((i) => `${i!.name}x${i!.quantity}`)).toEqual(
      p.inventory!.items.filter(Boolean).map((i) => `${i!.name}x${i!.quantity}`),
    );
    expect(r.quests).toEqual({ slimes: { state: "active", progress: 3 } });
    expect([...restored.drops.values()].map((d) => d.item.name)).toEqual(["Poção Pequena"]);
    expect(restored.time).toBeCloseTo(0.5);
    expect(restored.drainEvents()).toEqual([]);
  });

  it("novos itens depois de carregar não colidem com ids salvos", () => {
    const world = generateWorld({ seed: 5 });
    const p = world.player!;
    addItem(p.inventory!, createEquipment(() => 0, 1, "common"));
    const restored = restoreGame(serializeGame(world, 5));
    const fresh = createPotion();
    const ids = new Set([...restored.player!.inventory!.items.filter(Boolean).map((i) => i!.id)]);
    expect(ids.has(fresh.id)).toBe(false);
  });

  it("rejeita dados inválidos e descreve um save", () => {
    expect(isSaveData(null)).toBe(false);
    expect(isSaveData({ version: 0 })).toBe(false);
    const save = serializeGame(generateWorld(), 1337);
    expect(describeSave(save)).toContain("Nível 1");
  });

  it("vida salva acima do máximo é limitada e nunca carrega morto", () => {
    const world = generateWorld({ seed: 2 });
    const save = serializeGame(world, 2);
    save.player.health = 9999;
    expect(restoreGame(save).player!.health.current).toBe(100);
    save.player.health = 0;
    expect(restoreGame(save).player!.health.current).toBe(1);
  });
});
