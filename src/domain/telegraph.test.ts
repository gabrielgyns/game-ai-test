import { describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { stepWorld } from "./simulation";
import { World } from "./world";

function run(world: World, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

describe("telegraph dos ataques inimigos", () => {
  it("sair do alcance durante o aviso faz o golpe errar", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1.5, y: 0, z: 0 }));
    run(world, 0.1); // aggro, aproxima e começa o aviso
    expect(orc.combat.windupLeft).toBeGreaterThan(0);
    player.transform.position.x = -10; // fugiu
    const events = run(world, orc.combat.windupTime + 0.1);
    const attack = events.find((e) => e.type === "attack" && e.source === orc.id);
    expect(attack).toBeDefined();
    expect(attack && attack.type === "attack" ? attack.target : null).toBeUndefined();
    expect(player.health.current).toBe(player.health.max);
  });

  it("esquivar no momento do golpe evita o dano", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1.5, y: 0, z: 0 }));
    run(world, 0.1);
    expect(orc.combat.windupLeft).toBeGreaterThan(0);
    // Espera até faltar pouco para o golpe e rola através do orc (continua em alcance, mas invulnerável).
    while (orc.combat.windupLeft > 0.3) stepWorld(world, 1 / 60);
    player.abilities!.aimDirection = { x: 1, z: 0 };
    player.abilities!.wantsRoll = true;
    const events = run(world, 0.35);
    expect(events.some((e) => e.type === "dodge" && e.source === orc.id)).toBe(true);
    expect(player.health.current).toBe(player.health.max);
  });

  it("ficar parado durante o aviso leva o dano cheio", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1.5, y: 0, z: 0 }));
    run(world, 0.1 + orc.combat.windupTime + 0.1);
    expect(player.health.current).toBe(player.health.max - orc.combat.damage);
  });

  it("o jogador ataca sem aviso", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    player.combat.wantsAttack = true;
    stepWorld(world, 1 / 60);
    expect(slime.health.current).toBeLessThan(slime.health.max);
  });
});
