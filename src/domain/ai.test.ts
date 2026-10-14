import { describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { stepWorld } from "./simulation";
import { distanceXZ } from "./math";
import { World } from "./world";

describe("IA de inimigos", () => {
  it("persegue o jogador dentro do aggro e para de perseguir ao voltar para casa", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const goblin = world.spawn((id) => createEnemy(id, "goblin", { x: 8, y: 0, z: 0 }));

    stepWorld(world, 0.016);
    expect(goblin.ai?.state).toBe("chase");
    const before = distanceXZ(goblin.transform.position, player.transform.position);
    stepWorld(world, 0.5);
    expect(distanceXZ(goblin.transform.position, player.transform.position)).toBeLessThan(before);

    // Jogador foge para muito longe: inimigo desiste.
    player.transform.position.x = 200;
    stepWorld(world, 0.016);
    goblin.transform.position.x = 100;
    stepWorld(world, 0.016);
    expect(goblin.ai?.state).toBe("return");
  });

  it("fica parado se o jogador estiver longe", () => {
    const world = new World();
    world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 50, y: 0, z: 0 }));
    stepWorld(world, 1);
    expect(slime.ai?.state).toBe("idle");
    expect(slime.transform.position.x).toBe(50);
  });

  it("ataca o jogador quando em alcance, depois do tempo de aviso", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    stepWorld(world, 0.016); // idle -> chase
    stepWorld(world, 0.016); // chase -> attack
    const events = stepWorld(world, 0.016); // começa o aviso
    expect(events).toContainEqual(expect.objectContaining({ type: "windup", source: slime.id, duration: slime.combat.windupTime }));
    expect(player.health.current).toBe(player.health.max);
    for (let t = 0; t < slime.combat.windupTime + 0.02; t += 0.016) stepWorld(world, 0.016);
    expect(player.health.current).toBeLessThan(player.health.max);
  });
});
