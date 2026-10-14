import { beforeEach, describe, expect, it } from "vitest";
import { generateWorld } from "./worldgen";
import { biomeAt } from "./biomes";
import { isLava, LAVA_LEVEL, lavaRiverX, terrainHeight, VOLCANO_CALDERA, VOLCANO_FORT } from "./terrain";
import { ZONES, zoneAt } from "./zones";
import { entityLevel } from "./levels";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { createEnemy } from "./factories";
import { resetItemIds } from "./items";
import { createSetPiece } from "./sets";
import { recomputeStats } from "./inventory";
import { descend, DUNGEON_THEMES, dungeonInteraction, enterDungeon, exitDungeon, inDungeonSpace } from "./dungeon";
import { questById } from "./quests";
import { ensureShop } from "./shop";
import { knownVillages, VILLAGES } from "./villages";
import { LAVA } from "./lava";

beforeEach(() => resetItemIds());

const Z = ZONES.vulcao;
const volcano = (lx: number, lz: number) => ({ x: Z.center.x + lx, z: Z.center.z + lz });

describe("Terras Vulcânicas", () => {
  it("é uma zona própria ao norte dos Picos, com lava plana e afundada, forte e caldeira planos", () => {
    expect(zoneAt(Z.center.x, Z.center.z).id).toBe("vulcao");
    expect(Z.center.z + Z.half).toBeLessThan(ZONES.picos.center.z - ZONES.picos.half);
    expect(biomeAt(Z.center.x, Z.center.z)).toBe("volcano");
    const river = volcano(lavaRiverX(0), 0);
    expect(isLava(river.x, river.z)).toBe(true);
    expect(terrainHeight(river.x, river.z)).toBe(LAVA_LEVEL);
    for (const spot of [VOLCANO_FORT, VOLCANO_CALDERA]) {
      const p = volcano(spot.x, spot.z);
      expect(isLava(p.x, p.z)).toBe(false);
      expect(Math.abs(terrainHeight(p.x, p.z) - terrainHeight(p.x + 3, p.z + 2))).toBeLessThan(1);
    }
    // A caldeira tem entrada sem lava ao sul.
    const gate = volcano(VOLCANO_CALDERA.x, VOLCANO_CALDERA.z + 19);
    expect(isLava(gate.x, gate.z)).toBe(false);
  });

  it("a lava queima o herói em pulsos e não fere inimigos", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const river = volcano(lavaRiverX(0), 0);
    p.transform.position = { x: river.x, y: 0, z: river.z };
    const hound = world.spawn((id) => createEnemy(id, "lavaHound", { x: river.x, y: 0, z: river.z + 0.5 }));
    hound.ai!.aggroRange = 0;
    const hp = p.health.current;
    for (let i = 0; i < 61; i++) stepWorld(world, 1 / 60);
    expect(hp - p.health.current).toBeGreaterThanOrEqual(Math.round(p.health.max * LAVA.fraction) * 2 - 1);
    expect(hound.health.current).toBe(hound.health.max);
  });

  it("povoada na faixa 28–36, com o Bastião de Brasa e o Senhor das Chamas, ninguém nasce na lava", () => {
    const world = generateWorld({ seed: 3 });
    const here = [...world.entities.values()].filter((e) => zoneAt(e.transform.position.x, e.transform.position.z).id === "vulcao");
    const enemies = here.filter((e) => e.kind === "enemy");
    expect([...new Set(enemies.map((e) => e.archetype))].sort()).toEqual(["fireLord", "flameCaster", "lavaHound", "magmaGolem"]);
    for (const e of enemies) {
      expect(entityLevel(e)).toBeGreaterThanOrEqual(Z.levels[0]);
      expect(entityLevel(e)).toBeLessThanOrEqual(Z.levels[1]);
      expect(isLava(e.transform.position.x, e.transform.position.z)).toBe(false);
    }
    expect(here.filter((e) => e.npc).map((e) => e.npc!.id).sort()).toEqual(["commander", "forgeSmith", "scout"]);
  });

  it("a vila tem pedra de teleporte e a loja da Ferreira vende do nível 28 para cima", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { ...VILLAGES.bastiao.arrive, y: 0 };
    stepWorld(world, 1 / 60);
    expect(knownVillages(p)).toContain("bastiao");
    expect(ensureShop(world, p, "forge").offers.every((o) => o.item.level === 28)).toBe(true);
  });

  it("o Senhor das Chamas derruba a Coroa das Chamas e a quest final pede ele", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const lord = [...world.entities.values()].find((e) => e.archetype === "fireLord")!;
    p.transform.position = { ...lord.transform.position, x: lord.transform.position.x + 50 };
    applyDamage(world, p, lord, 9e9);
    const piece = [...world.drops.values()].map((d) => d.item).find((i) => i.set);
    expect(piece?.set).toBe("fireLord");
    expect(piece?.level).toBe(36);
    expect(questById("fireLord")!.objective.archetype).toBe("fireLord");
  });

  it("Queimar a Vida soma 2% da vida do alvo; Metal Derretido fortalece habilidades", () => {
    const world = generateWorld({ seed: 3 });
    world.random = () => 0.99;
    const p = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("fireLord", slot, p.classId);
    recomputeStats(p);
    const golem = world.spawn((id) => createEnemy(id, "magmaGolem", { x: 2, y: 0, z: 0 }));
    applyDamage(world, p, golem, 100);
    expect(golem.health.max - golem.health.current).toBe(100 + Math.round(golem.health.max * 0.02));
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("forgeMaster", slot, p.classId);
    recomputeStats(p);
    const g2 = world.spawn((id) => createEnemy(id, "magmaGolem", { x: 3, y: 0, z: 0 }));
    applyDamage(world, p, g2, 100, "skill");
    expect(g2.health.max - g2.health.current).toBe(125);
  });
});

describe("Forja Vulcânica", () => {
  it("entrada a oeste dos vulcões, nunca abaixo do nível 28, guarda e Mestre da Forja com conjunto", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.progression!.level = 30;
    const t = DUNGEON_THEMES.volcanicForge;
    expect(zoneAt(t.entrance.x, t.entrance.z).id).toBe("vulcao");
    expect(isLava(t.entrance.x, t.entrance.z)).toBe(false);
    p.transform.position = { x: t.entrance.x, y: 0, z: t.entrance.z };
    expect(dungeonInteraction(world, p)).toBe("enter");
    const r = enterDungeon(world, p, 5, "volcanicForge");
    expect(r.level).toBe(30);
    const inside = [...world.entities.values()].filter((e) => e.kind === "enemy" && inDungeonSpace(e.transform.position.x));
    for (const e of inside) expect(["lavaHound", "flameCaster", "magmaGolem"]).toContain(e.archetype);
    expect(world.get(r.guardianId!)!.name).toBe("Guarda da Forja");
    applyDamage(world, p, world.get(r.guardianId!)!, 9e9);
    stepWorld(world, 1 / 60);
    expect(descend(world, p)).toBe(true);
    const boss = world.get(r.bossId!)!;
    expect(boss.archetype).toBe("forgeMaster");
    applyDamage(world, p, boss, 9e9);
    expect([...world.drops.values()].some((d) => d.item.set === "forgeMaster")).toBe(true);
    exitDungeon(world, p, "complete");
    expect(zoneAt(p.transform.position.x, p.transform.position.z).id).toBe("vulcao");
  });
});
