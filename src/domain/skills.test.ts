import { beforeEach, describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { stepWorld } from "./simulation";
import { CHARGE, getSkill, ROLL, SKILLS, WARCRY } from "./skills";
import { World } from "./world";

beforeEach(() => resetItemIds());

function setup() {
  const world = new World();
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  return { world, player };
}

function run(world: World, seconds: number, step = 1 / 60) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += step) events.push(...stepWorld(world, step));
  return events;
}

describe("esquiva", () => {
  it("desloca o jogador na direção mirada e o torna invulnerável durante o rolamento", () => {
    const { world, player } = setup();
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    slime.combat.cooldownLeft = 0;
    player.abilities!.aimDirection = { x: 0, z: -1 };
    player.abilities!.wantsRoll = true;
    const events = run(world, ROLL.duration + 0.05);
    expect(events.some((e) => e.type === "roll")).toBe(true);
    expect(player.transform.position.z).toBeLessThan(-ROLL.distance * 0.8);
    expect(player.health.current).toBe(player.health.max);
    expect(events.some((e) => e.type === "dodge")).toBe(true);
    expect(player.abilities!.dash).toBeNull();
  });

  it("respeita o cooldown da esquiva", () => {
    const { world, player } = setup();
    player.abilities!.wantsRoll = true;
    stepWorld(world, 1 / 60);
    expect(player.abilities!.dash?.kind).toBe("roll");
    run(world, ROLL.duration);
    player.abilities!.wantsRoll = true;
    stepWorld(world, 1 / 60);
    expect(player.abilities!.dash).toBeNull(); // ainda em cooldown
    run(world, ROLL.cooldown);
    player.abilities!.wantsRoll = true;
    stepWorld(world, 1 / 60);
    expect(player.abilities!.dash?.kind).toBe("roll");
  });
});

describe("habilidades", () => {
  it("Golpe Giratório acerta todos os inimigos no raio por 150% do dano", () => {
    const { world, player } = setup();
    const near1 = world.spawn((id) => createEnemy(id, "slime", { x: 2, y: 0, z: 0 }));
    const near2 = world.spawn((id) => createEnemy(id, "slime", { x: -2, y: 0, z: 1 }));
    const far = world.spawn((id) => createEnemy(id, "slime", { x: 6, y: 0, z: 0 }));
    player.abilities!.queuedSkill = "whirlwind";
    const events = stepWorld(world, 1 / 60);
    const expected = Math.round(player.combat.damage * 1.5);
    expect(near1.health.current).toBe(near1.health.max - expected);
    expect(near2.health.current).toBe(near2.health.max - expected);
    expect(far.health.current).toBe(far.health.max);
    expect(events).toContainEqual({ type: "skill", entity: player.id, skill: "whirlwind", hits: 2 });
    expect(getSkill(player.abilities!, "whirlwind")!.cooldownLeft).toBe(SKILLS.whirlwind.cooldown);
  });

  it("habilidade em cooldown não dispara", () => {
    const { world, player } = setup();
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 2, y: 0, z: 0 }));
    player.abilities!.queuedSkill = "whirlwind";
    stepWorld(world, 1 / 60);
    const hp = slime.health.current;
    player.abilities!.queuedSkill = "whirlwind";
    stepWorld(world, 1 / 60);
    expect(slime.health.current).toBe(hp);
  });

  it("Investida avança e acerta uma vez cada inimigo atravessado", () => {
    const { world, player } = setup();
    const inPath = world.spawn((id) => createEnemy(id, "goblin", { x: 0, y: 0, z: -3 }));
    inPath.movement.speed = 0;
    player.abilities!.aimDirection = { x: 0, z: -1 };
    player.abilities!.queuedSkill = "charge";
    run(world, CHARGE.duration + 0.05);
    expect(player.transform.position.z).toBeLessThan(-CHARGE.distance * 0.8);
    expect(inPath.health.current).toBe(inPath.health.max - Math.round(player.combat.damage * CHARGE.damageMultiplier));
  });

  it("Grito de Guerra aumenta o dano por um tempo e depois expira", () => {
    const { world, player } = setup();
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    slime.combat.damage = 0;
    player.abilities!.queuedSkill = "warcry";
    stepWorld(world, 1 / 60);
    player.combat.wantsAttack = true;
    stepWorld(world, 1 / 60);
    expect(slime.health.current).toBe(slime.health.max - Math.round(player.combat.damage * WARCRY.multiplier));
    const events = run(world, WARCRY.duration + 0.1);
    expect(events.some((e) => e.type === "buffEnd")).toBe(true);
    expect(player.abilities!.damageBuff).toBeNull();
  });

  it("Segundo Fôlego cura 35% e não é gasto com vida cheia", () => {
    const { world, player } = setup();
    player.abilities!.queuedSkill = "secondWind";
    stepWorld(world, 1 / 60);
    expect(getSkill(player.abilities!, "secondWind")!.cooldownLeft).toBe(0);
    player.health.current = 10;
    player.health.lastDamagedAt = world.time; // suprime a regeneração natural no tick
    player.abilities!.queuedSkill = "secondWind";
    stepWorld(world, 1 / 60);
    expect(player.health.current).toBe(10 + Math.round(player.health.max * 0.35));
    expect(getSkill(player.abilities!, "secondWind")!.cooldownLeft).toBeGreaterThan(0);
  });
});
