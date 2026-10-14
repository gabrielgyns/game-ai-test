import { beforeEach, describe, expect, it } from "vitest";
import { generateWorld } from "./worldgen";
import { biomeAt } from "./biomes";
import { isIce, isWater, PEAKS_BOSS_HOME, PEAKS_CAVE, PEAKS_LAKE, PEAKS_VILLAGE, terrainHeight } from "./terrain";
import { ZONES, zoneAt } from "./zones";
import { entityLevel } from "./levels";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { createEnemy } from "./factories";
import { resetItemIds } from "./items";
import { createSetPiece } from "./sets";
import { recomputeStats } from "./inventory";
import { applySlow } from "./status";
import { descend, DUNGEON_THEMES, dungeonInteraction, enterDungeon, exitDungeon, inDungeonSpace } from "./dungeon";
import { questById } from "./quests";
import { ensureShop } from "./shop";
import { knownVillages, VILLAGES } from "./villages";
import { fireProjectile } from "./systems/projectiles";
import { FROST_POOL } from "./hazards";
import type { World } from "./world";

beforeEach(() => resetItemIds());

const P = ZONES.picos;
const peaks = (lx: number, lz: number) => ({ x: P.center.x + lx, z: P.center.z + lz });
const steps = (world: World, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) stepWorld(world, 1 / 60);
};

describe("Picos Gelados", () => {
  it("é uma zona própria, de neve, com lago de gelo plano, vila e patamar da caverna planos", () => {
    expect(zoneAt(P.center.x, P.center.z).id).toBe("picos");
    expect(P.center.z + P.half).toBeLessThan(ZONES.floresta.center.z - ZONES.floresta.half);
    expect(biomeAt(P.center.x, P.center.z)).toBe("snow");
    const lake = peaks(PEAKS_LAKE.x, PEAKS_LAKE.z);
    expect(isIce(lake.x, lake.z)).toBe(true);
    expect(isWater(lake.x, lake.z)).toBe(false);
    expect(terrainHeight(lake.x, lake.z)).toBe(terrainHeight(lake.x + 8, lake.z + 5));
    for (const spot of [PEAKS_VILLAGE, PEAKS_BOSS_HOME, PEAKS_CAVE]) {
      const p = peaks(spot.x, spot.z);
      expect(isIce(p.x, p.z)).toBe(false);
      expect(Math.abs(terrainHeight(p.x, p.z) - terrainHeight(p.x + 3, p.z + 2))).toBeLessThan(1);
    }
  });

  it("no gelo se escorrega: a velocidade vem aos poucos e não para na hora", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const lake = peaks(PEAKS_LAKE.x, PEAKS_LAKE.z);
    p.transform.position = { x: lake.x, y: 0, z: lake.z };
    p.movement.intent = { x: 1, z: 0 };
    stepWorld(world, 1 / 60);
    const firstStep = p.transform.position.x - lake.x;
    expect(firstStep).toBeLessThan(p.movement.speed / 60 / 2); // arranca devagar
    steps(world, 1);
    p.movement.intent = { x: 0, z: 0 };
    const x0 = p.transform.position.x;
    steps(world, 0.3);
    expect(p.transform.position.x - x0).toBeGreaterThan(0.5); // continua deslizando
    // Fora do gelo, parar é na hora.
    p.transform.position = { ...peaks(PEAKS_VILLAGE.x, PEAKS_VILLAGE.z), y: 0 };
    p.movement.intent = { x: 1, z: 0 };
    steps(world, 0.2);
    p.movement.intent = { x: 0, z: 0 };
    const x1 = p.transform.position.x;
    steps(world, 0.2);
    expect(p.transform.position.x).toBe(x1);
  });

  it("povoada na faixa 20–28, com a vila de Pedra-Fria e o Gigante de Gelo", () => {
    const world = generateWorld({ seed: 3 });
    const here = [...world.entities.values()].filter((e) => zoneAt(e.transform.position.x, e.transform.position.z).id === "picos");
    const enemies = here.filter((e) => e.kind === "enemy");
    expect([...new Set(enemies.map((e) => e.archetype))].sort()).toEqual(["frostGiant", "iceWraith", "snowWolf", "yeti"]);
    for (const e of enemies) {
      expect(entityLevel(e)).toBeGreaterThanOrEqual(P.levels[0]);
      expect(entityLevel(e)).toBeLessThanOrEqual(P.levels[1]);
    }
    expect(here.filter((e) => e.npc).map((e) => e.npc!.id).sort()).toEqual(["hunter", "jarl", "trader"]);
  });

  it("a vila tem pedra de teleporte, e a loja vende no nível 20 para cima", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { ...VILLAGES.pedraFria.arrive, y: 0 };
    stepWorld(world, 1 / 60);
    expect(knownVillages(p)).toContain("pedraFria");
    p.progression!.level = 9;
    expect(ensureShop(world, p, "trader").offers.every((o) => o.item.level === 20)).toBe(true);
  });

  it("o Gigante de Gelo derruba peça da Armadura do Inverno e a quest final pede ele", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    const giant = [...world.entities.values()].find((e) => e.archetype === "frostGiant")!;
    p.transform.position = { ...giant.transform.position, x: giant.transform.position.x + 50 };
    applyDamage(world, p, giant, 9e9);
    const piece = [...world.drops.values()].map((d) => d.item).find((i) => i.set);
    expect(piece?.set).toBe("frostGiant");
    expect(piece?.level).toBe(28);
    expect(questById("frostGiant")!.objective.archetype).toBe("frostGiant");
    expect(questById("iceCave")!.objective.archetype).toBe("iceQueen");
  });

  it("estilhaços de gelo e chão congelado deixam lento", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.transform.position = { x: 0, y: 0, z: 0 };
    const wraith = world.spawn((id) => createEnemy(id, "iceWraith", { x: 0, y: 0, z: -4 }));
    fireProjectile(world, wraith, "iceShard", { x: 0, z: 1 }, 10, 15);
    steps(world, 0.4);
    expect(p.status?.slowLeft ?? 0).toBeGreaterThan(0);
    p.status!.slowLeft = 0;
    world.despawn(wraith.id);
    const giant = world.spawn((id) => createEnemy(id, "yeti", { x: 30, y: 0, z: 30 }));
    world.addHazard(giant, FROST_POOL, { x: 0, y: 0, z: 0 });
    steps(world, 0.6);
    expect(p.status?.slowLeft ?? 0).toBeGreaterThan(0);
  });

  it("Pele de Geleira corta golpes enormes; Estilhaçar bate mais em alvo lento", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("frostGiant", slot, p.classId);
    recomputeStats(p);
    p.health.current = p.health.max;
    const yeti = world.spawn((id) => createEnemy(id, "yeti", { x: 1, y: 0, z: 0 }));
    const cap = p.health.max * 0.15;
    const hp = p.health.current;
    applyDamage(world, yeti, p, Math.round(cap * 3));
    expect(hp - p.health.current).toBeCloseTo(cap + cap, -1);

    const q = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) q.equipment![slot] = createSetPiece("iceQueen", slot, q.classId);
    recomputeStats(q);
    world.random = () => 0.99; // sem crítico
    const a = world.spawn((id) => createEnemy(id, "yeti", { x: 2, y: 0, z: 0 }));
    const b = world.spawn((id) => createEnemy(id, "yeti", { x: 3, y: 0, z: 0 }));
    applySlow(world, b, 0.5, 5);
    applyDamage(world, q, a, 100);
    applyDamage(world, q, b, 100);
    expect(a.health.max - a.health.current).toBe(100);
    expect(b.health.max - b.health.current).toBe(140);
  });
});

describe("Caverna de Gelo", () => {
  function cave(level = 5) {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.progression!.level = level;
    const t = DUNGEON_THEMES.iceCave;
    p.transform.position = { x: t.entrance.x, y: 0, z: t.entrance.z };
    expect(dungeonInteraction(world, p)).toBe("enter");
    const r = enterDungeon(world, p, 77, "iceCave");
    return { world, p, r };
  }

  it("a entrada fica no patamar da encosta, em chão firme dos Picos", () => {
    const t = DUNGEON_THEMES.iceCave;
    expect(zoneAt(t.entrance.x, t.entrance.z).id).toBe("picos");
    expect(isIce(t.entrance.x, t.entrance.z)).toBe(false);
  });

  it("nunca abaixo do nível 20, com bichos do gelo e o Guardião Glacial na escada", () => {
    const { world, p, r } = cave(5);
    expect(r.theme).toBe("iceCave");
    expect(r.level).toBe(20);
    expect(inDungeonSpace(p.transform.position.x)).toBe(true);
    const inside = [...world.entities.values()].filter((e) => e.kind === "enemy" && inDungeonSpace(e.transform.position.x));
    const kinds = new Set(inside.map((e) => e.archetype));
    for (const k of kinds) expect(["snowWolf", "iceWraith", "yeti"]).toContain(k);
    expect(world.get(r.guardianId!)!.name).toBe("Guardião Glacial");
  });

  it("o andar de baixo termina na Rainha Gélida, que escala com o herói e guarda o conjunto", () => {
    const { world, p, r } = cave(26);
    applyDamage(world, p, world.get(r.guardianId!)!, 9e9);
    steps(world, 1 / 60);
    expect(descend(world, p)).toBe(true);
    const queen = world.get(r.bossId!)!;
    expect(queen.archetype).toBe("iceQueen");
    expect(entityLevel(queen)).toBe(28);
    applyDamage(world, p, queen, 9e9);
    expect([...world.drops.values()].some((d) => d.item.set === "iceQueen")).toBe(true);
  });

  it("sair volta para a porta da caverna nos Picos; perder as vidas acorda em Pedra-Fria", () => {
    const { world, p } = cave(22);
    exitDungeon(world, p, "leave");
    expect(zoneAt(p.transform.position.x, p.transform.position.z).id).toBe("picos");
    expect(Math.hypot(p.transform.position.x - DUNGEON_THEMES.iceCave.entrance.x, p.transform.position.z - DUNGEON_THEMES.iceCave.entrance.z)).toBeLessThan(4);

    const again = cave(22);
    const yeti = again.world.spawn((id) => createEnemy(id, "yeti", { ...again.p.transform.position, x: again.p.transform.position.x + 1 }));
    for (let i = 0; i < 3; i++) {
      applyDamage(again.world, yeti, again.p, 9e9);
      steps(again.world, 6);
    }
    expect(again.world.dungeon).toBeUndefined();
    expect(Math.hypot(again.p.transform.position.x - P.respawn.x, again.p.transform.position.z - P.respawn.z)).toBeLessThan(2);
  });
});
