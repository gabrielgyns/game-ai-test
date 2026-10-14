import { beforeEach, describe, expect, it } from "vitest";
import { biomeAt, biomeWeights, SWAMP_BOSS_HOME } from "./biomes";
import { createSpiderQueen } from "./boss";
import { createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { stepWorld } from "./simulation";
import { isWater, terrainHeight } from "./terrain";
import { generateWorld, seededRandom } from "./worldgen";
import { World } from "./world";

beforeEach(() => resetItemIds());

function run(world: World, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

describe("biomas", () => {
  it("divide o mapa em pântano (oeste), campina e deserto (leste), com transição suave", () => {
    expect(biomeAt(-60, 0)).toBe("swamp");
    expect(biomeAt(0, 50)).toBe("meadow");
    expect(biomeAt(60, 0)).toBe("desert");
    const w = biomeWeights(-34);
    expect(w.swamp).toBeCloseTo(0.5, 1);
    expect(w.meadow + w.swamp + w.desert).toBeCloseTo(1);
  });

  it("o pântano é mais baixo e tem água; a campina e o deserto não", () => {
    let swampAvg = 0, meadowAvg = 0, n = 0, water = 0;
    for (let z = -60; z <= 60; z += 3) {
      swampAvg += terrainHeight(-70, z);
      meadowAvg += terrainHeight(-10, z);
      if (isWater(-70, z)) water++;
      n++;
    }
    expect(swampAvg / n).toBeLessThan(meadowAvg / n - 1);
    expect(water).toBeGreaterThan(0);
    for (let z = -60; z <= 60; z += 3) {
      expect(isWater(10, z)).toBe(false);
      expect(isWater(70, z)).toBe(false);
    }
  });

  it("andar na água é mais lento", () => {
    const world = new World();
    let wet: { x: number; z: number } | null = null;
    for (let x = -100; x < -40 && !wet; x += 1) for (let z = -90; z < 90; z += 1) if (isWater(x, z) && isWater(x + 1, z)) { wet = { x, z }; break; }
    expect(wet).not.toBeNull();
    const p = world.spawn((id) => createPlayer(id, { x: wet!.x + 0.5, y: 0, z: wet!.z + 0.5 }));
    p.movement.intent = { x: 1, z: 0 };
    stepWorld(world, 0.1);
    expect(p.transform.position.x - (wet!.x + 0.5)).toBeCloseTo(7 * 0.6 * 0.1, 3);
  });

  it("gera inimigos de cada bioma na região certa, sem invadir as arenas", () => {
    const world = generateWorld();
    const byKind = new Map<string, { x: number; z: number }[]>();
    for (const e of world.enemies()) {
      const list = byKind.get(e.archetype) ?? [];
      list.push({ x: e.transform.position.x, z: e.transform.position.z });
      byKind.set(e.archetype, list);
    }
    for (const kind of ["spider", "bogZombie"]) for (const p of byKind.get(kind)!) expect(biomeAt(p.x, p.z)).toBe("swamp");
    for (const kind of ["scorpion", "bandit"]) for (const p of byKind.get(kind)!) expect(biomeAt(p.x, p.z)).toBe("desert");
    for (const kind of ["slime", "goblin", "orc"]) for (const p of byKind.get(kind)!) expect(biomeAt(p.x, p.z)).toBe("meadow");
    expect(byKind.get("spider")!.length).toBeGreaterThanOrEqual(10);
    expect(byKind.get("scorpion")!.length).toBeGreaterThanOrEqual(8);
    expect(byKind.get("spiderQueen")).toHaveLength(1);
    for (const [kind, list] of byKind) {
      if (kind.endsWith("Queen") || kind === "goblinKing") continue;
      for (const p of list) expect(Math.hypot(p.x - SWAMP_BOSS_HOME.x, p.z - SWAMP_BOSS_HOME.z)).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("Rainha Aranha", () => {
  function setup(distance: number) {
    const world = new World();
    world.random = seededRandom(9);
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const queen = world.spawn((id) => createSpiderQueen(id, { x: distance, y: 0, z: 0 }));
    return { world, player, queen };
  }

  it("Teia Venenosa mira onde o jogador estava: ficar leva dano, sair escapa", () => {
    const { world, player, queen } = setup(8); // fora da mordida, dentro do alcance da teia
    const events = run(world, 0.1);
    const windup = events.find((e) => e.type === "windup" && e.source === queen.id);
    expect(queen.combat.pending?.pattern.id).toBe("web");
    expect(windup && windup.type === "windup" && windup.shape.kind === "circle" ? windup.shape.at?.x : null).toBeCloseTo(0, 1);
    player.transform.position.x = -6; // saiu da área
    run(world, queen.combat.windupLeft + 0.05);
    expect(player.health.current).toBe(player.health.max);

    // Nova teia (cooldown zerado, rainha afastada de novo), agora ficando parado.
    queen.boss!.cooldowns = {};
    queen.transform.position.x = player.transform.position.x + 8;
    queen.transform.position.z = player.transform.position.z;
    run(world, 0.1);
    expect(queen.combat.pending?.pattern.id).toBe("web");
    run(world, queen.combat.windupLeft + 0.05);
    expect(player.health.current).toBe(player.health.max - Math.round(queen.combat.damage * 1.6));
  });

  it("na fase final convoca três aranhas", () => {
    const { world, queen } = setup(8);
    run(world, 0.05);
    queen.health.current = queen.health.max * 0.2;
    const events = run(world, 0.05);
    const summon = events.find((e) => e.type === "bossSummon");
    expect(summon && summon.type === "bossSummon" ? summon.minions.length : 0).toBe(3);
    expect([...world.enemies()].filter((e) => e.archetype === "spider")).toHaveLength(3);
  });
});
