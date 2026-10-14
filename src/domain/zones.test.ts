import { beforeEach, describe, expect, it } from "vitest";
import { gateNear, travel, ZONE_GATES, ZONES, zoneAt } from "./zones";
import { generateWorld } from "./worldgen";
import { biomeAt } from "./biomes";
import { FOREST_BOSS_HOME, FOREST_CAMP, forestRiverZ, isWater, terrainHeight } from "./terrain";
import { entityLevel } from "./levels";
import { mapMarkers } from "./mapMarkers";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { createSetPiece, SETS } from "./sets";
import { recomputeStats } from "./inventory";
import { createEnemy } from "./factories";
import { resetItemIds } from "./items";
import { questById } from "./quests";
import { restoreGame, serializeGame } from "./save";

beforeEach(() => resetItemIds());

const F = ZONES.floresta;
const forest = (lx: number, lz: number) => ({ x: F.center.x + lx, z: F.center.z + lz });

describe("zonas", () => {
  it("cada ponto pertence a uma zona; vale e floresta não se tocam", () => {
    expect(zoneAt(0, 0).id).toBe("vale");
    expect(zoneAt(F.center.x, F.center.z).id).toBe("floresta");
    expect(F.center.z + F.half).toBeLessThan(ZONES.vale.center.z - ZONES.vale.half);
    expect(biomeAt(forest(0, 0).x, forest(0, 0).z)).toBe("forest");
    expect(biomeAt(forest(80, 0).x, forest(80, 0).z)).toBe("ruins");
  });

  it("a floresta tem rio de água, acampamento e clareira planos", () => {
    const river = forest(-30, forestRiverZ(-30));
    expect(isWater(river.x, river.z)).toBe(true);
    const camp = forest(FOREST_CAMP.x, FOREST_CAMP.z);
    expect(isWater(camp.x, camp.z)).toBe(false);
    const boss = forest(FOREST_BOSS_HOME.x, FOREST_BOSS_HOME.z);
    expect(Math.abs(terrainHeight(boss.x, boss.z) - terrainHeight(boss.x + 6, boss.z))).toBeLessThan(1);
  });

  it("portões levam de uma zona à outra e de volta, sempre a chão firme e fora do alcance do portão", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    for (const gate of ZONE_GATES) {
      p.transform.position = { x: gate.at.x, y: 0, z: gate.at.z };
      expect(travel(world, p)?.id).toBe(gate.id);
      expect(zoneAt(p.transform.position.x, p.transform.position.z).id).toBe(gate.to);
      expect(isWater(p.transform.position.x, p.transform.position.z)).toBe(false);
      expect(gateNear(p.transform.position)).toBeUndefined(); // não volta sem querer
    }
    expect(world.drainEvents().filter((e) => e.type === "zoneTravel")).toHaveLength(2);
  });

  it("andar não atravessa a borda da zona", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { ...forest(0, -F.half + 4), y: 0 };
    p.movement.intent = { x: 0, z: -1 };
    for (let i = 0; i < 120; i++) stepWorld(world, 1 / 60);
    expect(zoneAt(p.transform.position.x, p.transform.position.z).id).toBe("floresta");
  });

  it("a floresta é povoada na faixa 12–20, com a Guardiã e o Ente Ancião", () => {
    const world = generateWorld({ seed: 3 });
    const inForest = [...world.entities.values()].filter((e) => zoneAt(e.transform.position.x, e.transform.position.z).id === "floresta");
    const kinds = new Set(inForest.filter((e) => e.kind === "enemy").map((e) => e.archetype));
    expect([...kinds].sort()).toEqual(["ancientTreant", "elvenSpirit", "ent", "wolf"]);
    for (const e of inForest.filter((x) => x.kind === "enemy")) {
      expect(entityLevel(e)).toBeGreaterThanOrEqual(F.levels[0]);
      expect(entityLevel(e)).toBeLessThanOrEqual(F.levels[1]);
      expect(isWater(e.transform.position.x, e.transform.position.z)).toBe(false);
    }
    expect(inForest.some((e) => e.npc?.id === "ranger")).toBe(true);
  });

  it("cair na floresta renasce no acampamento, não no santuário", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { ...forest(10, 10), y: 0 };
    const wolf = world.spawn((id) => createEnemy(id, "wolf", { ...forest(11, 10), y: 0 }));
    applyDamage(world, wolf, p, 9e9);
    for (let i = 0; i < 6 * 60; i++) stepWorld(world, 1 / 60);
    expect(Math.hypot(p.transform.position.x - F.respawn.x, p.transform.position.z - F.respawn.z)).toBeLessThan(2);
  });

  it("o mapa só mostra a zona do herói, com o portão de volta", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { ...forest(0, 60), y: 0 };
    const m = mapMarkers(world, p);
    expect(m.every((k) => zoneAt(k.x, k.z).id === "floresta")).toBe(true);
    expect(m.find((k) => k.kind === "gate")?.label).toBe("Vale das Gosmas");
    expect(m.filter((k) => k.kind === "boss").map((k) => k.label)).toEqual(["Ente Ancião"]);
    expect(m.some((k) => k.kind === "stash" || k.kind === "portal")).toBe(false);
  });

  it("estar na floresta vai no save: carregar volta para lá", () => {
    const world = generateWorld({ seed: 3 });
    world.player!.transform.position = { ...forest(5, 70), y: 0 };
    const restored = restoreGame(serializeGame(world, 3));
    expect(zoneAt(restored.player!.transform.position.x, restored.player!.transform.position.z).id).toBe("floresta");
  });
});

describe("Ente Ancião e o Coração da Floresta", () => {
  it("o chefe da floresta derruba peça do conjunto dele, e a quest final pede ele", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const treant = [...world.entities.values()].find((e) => e.archetype === "ancientTreant")!;
    p.transform.position = { ...treant.transform.position, x: treant.transform.position.x + 50 };
    applyDamage(world, p, treant, 9e9);
    const piece = [...world.drops.values()].map((d) => d.item).find((i) => i.set);
    expect(piece?.set).toBe("ancientTreant");
    expect(piece?.level).toBe(20);
    expect(questById("treant")!.objective.archetype).toBe("ancientTreant");
  });

  it("Casca de Espinhos: quem fere o herói leva 30% de volta", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("ancientTreant", slot, p.classId);
    recomputeStats(p);
    expect(p.bonuses!.regen).toBeGreaterThanOrEqual(SETS.ancientTreant.two.value);
    const wolf = world.spawn((id) => createEnemy(id, "wolf", { x: 1, y: 0, z: 0 }));
    const hp = wolf.health.current;
    applyDamage(world, wolf, p, 100);
    expect(hp - wolf.health.current).toBe(30);
  });
});
