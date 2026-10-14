import { beforeEach, describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { acceptQuest, completeQuest, questsForNpc, questState, QUESTS } from "./quests";
import { stepWorld } from "./simulation";
import { generateWorld, seededRandom } from "./worldgen";
import { World } from "./world";
import { countItems } from "./inventory";

beforeEach(() => resetItemIds());

function setup() {
  const world = new World();
  world.random = seededRandom(11);
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  return { world, player };
}

function killOne(world: World, kind: "slime" | "goblin" | "orc") {
  const player = world.player!;
  const e = world.spawn((id) => createEnemy(id, kind, { x: 1, y: 0, z: 0 }));
  e.health.current = 1;
  player.combat.wantsAttack = true;
  player.combat.cooldownLeft = 0;
  return stepWorld(world, 1 / 60);
}

describe("quests", () => {
  it("a anciã oferece só a primeira quest; as seguintes destravam ao concluir", () => {
    const { player } = setup();
    const log = player.quests!;
    expect(questsForNpc(log, "elder").offer.map((q) => q.id)).toEqual(["slimes"]);
    expect(questState(log, "goblins")).toBe("locked");
    expect(questsForNpc(log, "smith").offer).toHaveLength(0); // ferreiro exige a primeira
  });

  it("abates avançam a quest ativa e disparam questReady ao completar", () => {
    const { world, player } = setup();
    expect(acceptQuest(world, player, "slimes")).toBe(true);
    expect(acceptQuest(world, player, "slimes")).toBe(false); // já ativa
    let ready = false;
    for (let i = 0; i < 5; i++) {
      const events = killOne(world, "slime");
      if (events.some((e) => e.type === "questReady" && e.questId === "slimes")) ready = true;
    }
    expect(player.quests!.slimes?.progress).toBe(5);
    expect(ready).toBe(true);
    killOne(world, "slime");
    expect(player.quests!.slimes?.progress).toBe(5); // não passa do objetivo
    expect(questsForNpc(player.quests!, "elder").turnIn.map((q) => q.id)).toEqual(["slimes"]);
  });

  it("abates de outro arquétipo não contam", () => {
    const { world, player } = setup();
    acceptQuest(world, player, "slimes");
    killOne(world, "goblin");
    expect(player.quests!.slimes?.progress).toBe(0);
  });

  it("entregar dá XP, ouro e item, e destrava as próximas", () => {
    const { world, player } = setup();
    acceptQuest(world, player, "slimes");
    expect(completeQuest(world, player, "slimes")).toBe(false); // objetivo incompleto
    for (let i = 0; i < 5; i++) killOne(world, "slime");
    const goldBefore = player.wallet!.gold;
    const xpBefore = player.progression!.xp + 0; // nível 1, sem acúmulo relevante
    const events = (() => {
      expect(completeQuest(world, player, "slimes")).toBe(true);
      return world.drainEvents();
    })();
    expect(player.wallet!.gold).toBe(goldBefore + 25);
    expect(events.some((e) => e.type === "questCompleted" && e.questId === "slimes")).toBe(true);
    expect(player.progression!.level > 1 || player.progression!.xp > xpBefore).toBe(true);
    expect(questState(player.quests!, "goblins")).toBe("available");
    expect(questState(player.quests!, "orcs")).toBe("available");
    expect(questState(player.quests!, "king")).toBe("locked");

    // Quest dos goblins recompensa poções grandes empilhadas.
    acceptQuest(world, player, "goblins");
    for (let i = 0; i < 5; i++) killOne(world, "goblin");
    completeQuest(world, player, "goblins");
    expect(countItems(player.inventory!, (i) => i.name === "Poção Grande")).toBeGreaterThanOrEqual(2);
    expect(questState(player.quests!, "king")).toBe("available");
  });

  it("mundo gerado tem os quatro NPCs no santuário e eles não são alvo de golpes", () => {
    const world = generateWorld();
    const npcs = [...world.npcs()];
    expect(npcs.map((n) => n.npc!.id).sort()).toEqual(["elder", "guard", "merchant", "smith"]);
    for (const n of npcs) expect(Math.hypot(n.transform.position.x, n.transform.position.z)).toBeLessThan(10);
    const player = world.player!;
    player.combat.wantsAttack = true;
    player.transform.position.x = npcs[0]!.transform.position.x;
    player.transform.position.z = npcs[0]!.transform.position.z;
    const events = stepWorld(world, 1 / 60);
    expect(events.some((e) => e.type === "damage")).toBe(false);
  });

  it("todas as quests referenciam NPCs e pré-requisitos existentes", () => {
    const ids = new Set(QUESTS.map((q) => q.id));
    for (const q of QUESTS) {
      expect(["elder", "smith", "guard"]).toContain(q.giver);
      for (const r of q.requires) expect(ids.has(r)).toBe(true);
    }
    expect(ids.has("spiderQueen")).toBe(true);
    expect(ids.has("scorpions")).toBe(true);
    expect(ids.has("bandits")).toBe(true);
  });
});
