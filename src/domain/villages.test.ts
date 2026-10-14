import { beforeEach, describe, expect, it } from "vitest";
import { generateWorld } from "./worldgen";
import { stepWorld } from "./simulation";
import { resetItemIds } from "./items";
import { restoreGame, serializeGame } from "./save";
import { knownVillages, teleport, teleportFee, villageInteraction, VILLAGES } from "./villages";
import { zoneAt } from "./zones";
import { isWater } from "./terrain";
import { enterDungeon } from "./dungeon";

beforeEach(() => resetItemIds());

const at = (p: { x: number; z: number }) => ({ x: p.x, y: 0, z: p.z });

describe("vilas e pedras de teleporte", () => {
  it("o herói começa conhecendo só o santuário", () => {
    const world = generateWorld({ seed: 3 });
    expect(knownVillages(world.player!)).toEqual(["santuario"]);
  });

  it("cada vila fica na sua zona, em chão firme, com baú e pedra ao alcance", () => {
    for (const v of Object.values(VILLAGES)) {
      expect(zoneAt(v.stone.x, v.stone.z).id).toBe(v.zone);
      expect(isWater(v.arrive.x, v.arrive.z)).toBe(false);
      const world = generateWorld({ seed: 3 });
      const p = world.player!;
      p.transform.position = at(v.stone);
      expect(villageInteraction(p)).toMatchObject({ village: { id: v.id }, spot: "stone" });
      p.transform.position = at(v.stash);
      expect(villageInteraction(p)).toMatchObject({ village: { id: v.id }, spot: "stash" });
    }
  });

  it("chegar perto da pedra a ativa uma vez só", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = at(VILLAGES.acampamento.arrive);
    const events = [...stepWorld(world, 1 / 60), ...stepWorld(world, 1 / 60)];
    expect(knownVillages(p)).toEqual(["santuario", "acampamento"]);
    expect(events.filter((e) => e.type === "villageAttuned")).toHaveLength(1);
  });

  it("teleportar cobra a taxa, muda de zona e só vai para vila ativada", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.wallet!.gold = 1000;
    expect(teleport(world, p, "acampamento")).toBe("unknown");
    expect(teleport(world, p, "santuario")).toBe("same");
    p.villages = ["santuario", "acampamento"];
    const fee = teleportFee(p);
    expect(teleport(world, p, "acampamento")).toBe("ok");
    expect(p.wallet!.gold).toBe(1000 - fee);
    expect(zoneAt(p.transform.position.x, p.transform.position.z).id).toBe("floresta");
    const events = world.drainEvents().map((e) => e.type);
    expect(events).toContain("teleport");
    expect(events).toContain("zoneTravel");
    p.wallet!.gold = fee - 1;
    expect(teleport(world, p, "santuario")).toBe("noGold");
  });

  it("não se teleporta de dentro da cripta", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.wallet!.gold = 1000;
    p.villages = ["santuario", "acampamento"];
    enterDungeon(world, p);
    expect(teleport(world, p, "acampamento")).toBe("inDungeon");
  });

  it("as pedras ativadas vão no save", () => {
    const world = generateWorld({ seed: 3 });
    world.player!.villages = ["santuario", "acampamento"];
    expect(knownVillages(restoreGame(serializeGame(world, 3)).player!)).toEqual(["santuario", "acampamento"]);
  });
});
