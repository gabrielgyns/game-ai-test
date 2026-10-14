import { beforeEach, describe, expect, it } from "vitest";
import { generateWorld } from "./worldgen";
import { isWater, terrainHeight } from "./terrain";
import { zoneAt } from "./zones";
import { entityLevel } from "./levels";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { createEnemy } from "./factories";
import { resetItemIds } from "./items";
import { createSetPiece } from "./sets";
import { recomputeStats } from "./inventory";
import { descend, DUNGEON_THEMES, dungeonInteraction, enterDungeon, inDungeonSpace } from "./dungeon";
import { questById } from "./quests";
import { mapMarkers } from "./mapMarkers";

beforeEach(() => resetItemIds());

function sanctum(level = 5) {
  const world = generateWorld({ seed: 3 });
  const p = world.player!;
  p.progression!.level = level;
  const t = DUNGEON_THEMES.elvenSanctum;
  p.transform.position = { x: t.entrance.x, y: 0, z: t.entrance.z };
  expect(dungeonInteraction(world, p)).toBe("enter");
  const r = enterDungeon(world, p, 31, "elvenSanctum");
  return { world, p, r };
}

describe("Santuário Élfico", () => {
  it("a porta fica no pátio plano das ruínas de Elar, na floresta, e aparece no mapa", () => {
    const t = DUNGEON_THEMES.elvenSanctum;
    expect(zoneAt(t.entrance.x, t.entrance.z).id).toBe("floresta");
    expect(isWater(t.entrance.x, t.entrance.z)).toBe(false);
    expect(Math.abs(terrainHeight(t.entrance.x, t.entrance.z) - terrainHeight(t.entrance.x + 3, t.entrance.z - 2))).toBeLessThan(1);
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { x: t.entrance.x - 10, y: 0, z: t.entrance.z };
    expect(mapMarkers(world, p).find((m) => m.kind === "portal")?.label).toBe("Santuário Élfico");
  });

  it("nunca abaixo do nível 12, com espíritos, lobos e entes e a Sentinela de Elar na escada", () => {
    const { world, p, r } = sanctum(5);
    expect(r.level).toBe(12);
    expect(inDungeonSpace(p.transform.position.x)).toBe(true);
    const inside = [...world.entities.values()].filter((e) => e.kind === "enemy" && inDungeonSpace(e.transform.position.x));
    for (const e of inside) expect(["elvenSpirit", "wolf", "ent"]).toContain(e.archetype);
    expect(world.get(r.guardianId!)!.name).toBe("Sentinela de Elar");
  });

  it("no fundo, o Oráculo de Elar escala com o herói e guarda o Véu de Elar; a Guardiã pede ele", () => {
    const { world, p, r } = sanctum(17);
    applyDamage(world, p, world.get(r.guardianId!)!, 9e9);
    stepWorld(world, 1 / 60);
    expect(descend(world, p)).toBe(true);
    const oracle = world.get(r.bossId!)!;
    expect(oracle.archetype).toBe("elvenOracle");
    expect(entityLevel(oracle)).toBe(19);
    applyDamage(world, p, oracle, 9e9);
    expect([...world.drops.values()].some((d) => d.item.set === "elvenOracle")).toBe(true);
    const q = questById("sanctum")!;
    expect(q.giver).toBe("ranger");
    expect(q.objective.archetype).toBe("elvenOracle");
  });

  it("Passo Etéreo: com o conjunto, alguns golpes passam direto", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("elvenOracle", slot, p.classId);
    recomputeStats(p);
    const wolf = world.spawn((id) => createEnemy(id, "wolf", { x: 1, y: 0, z: 0 }));
    let dodged = 0;
    for (let i = 0; i < 400; i++) {
      p.health.current = p.health.max;
      const before = p.health.current;
      applyDamage(world, wolf, p, 10);
      if (p.health.current === before) dodged++;
    }
    expect(dodged).toBeGreaterThan(30);
    expect(dodged).toBeLessThan(100);
  });
});
