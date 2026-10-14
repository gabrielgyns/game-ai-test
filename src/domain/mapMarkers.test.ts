import { beforeEach, describe, expect, it } from "vitest";
import { mapMarkers } from "./mapMarkers";
import { DUNGEON_ENTRANCE, enterDungeon } from "./dungeon";
import { generateWorld } from "./worldgen";
import { acceptQuest, questsForNpc } from "./quests";
import { createEquipment, resetItemIds } from "./items";
import { applyDamage } from "./systems/combat";
import { stepWorld } from "./simulation";

beforeEach(() => resetItemIds());

describe("marcadores do mapa", () => {
  it("no vale: inimigos, os três chefes, NPCs com quest e o portal da cripta", () => {
    const world = generateWorld({ seed: 3 });
    const m = mapMarkers(world, world.player!);
    expect(m.filter((k) => k.kind === "boss")).toHaveLength(3);
    expect(m.filter((k) => k.kind === "enemy").length).toBeGreaterThan(50);
    const offer = m.find((k) => k.kind === "questOffer")!;
    expect(offer.label).toBe(world.get(offer.id!)!.name);
    expect(m.find((k) => k.kind === "portal")).toMatchObject({ x: DUNGEON_ENTRANCE.x, z: DUNGEON_ENTRANCE.z });
    expect(m.some((k) => k.kind === "chest" || k.kind === "exit")).toBe(false);
  });

  it("aceitar a quest tira o ! do NPC; inimigos mortos somem do mapa", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const offers = mapMarkers(world, p).filter((k) => k.kind === "questOffer");
    const giver = world.get(offers[0]!.id!)!;
    for (const q of questsForNpc(p.quests!, giver.npc!.id).offer) acceptQuest(world, p, q.id);
    const after = mapMarkers(world, p).find((k) => k.id === giver.id)!;
    expect(after.kind).not.toBe("questOffer");
    const enemy = mapMarkers(world, p).find((k) => k.kind === "enemy")!;
    applyDamage(world, p, world.get(enemy.id!)!, 99999);
    expect(mapMarkers(world, p).some((k) => k.id === enemy.id)).toBe(false);
  });

  it("na cripta: só o que é da cripta, com saída e baú depois do chefe", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
    const run = enterDungeon(world, p, 9);
    let m = mapMarkers(world, p);
    expect(m.every((k) => k.x >= 500)).toBe(true);
    expect(m.filter((k) => k.kind === "boss")).toHaveLength(1);
    expect(m.filter((k) => k.kind === "exit")).toHaveLength(1);
    applyDamage(world, p, world.get(run.bossId)!, 999999);
    stepWorld(world, 1 / 60);
    m = mapMarkers(world, p);
    expect(m.some((k) => k.kind === "chest")).toBe(true);
    expect(m.filter((k) => k.kind === "exit")).toHaveLength(2);
  });

  it("itens raros e épicos no chão aparecem; comuns não", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const rare = createEquipment(() => 0.5, 2, "rare");
    const common = createEquipment(() => 0.5, 2, "common");
    world.addDrop(rare, { x: 50, y: 0, z: 50 });
    world.addDrop(common, { x: 52, y: 0, z: 50 });
    const loot = mapMarkers(world, p).filter((k) => k.kind === "loot");
    expect(loot).toHaveLength(1);
    expect(loot[0]!.label).toBe(rare.name);
  });
});
