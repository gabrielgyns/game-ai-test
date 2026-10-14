import { describe, expect, it } from "vitest";
import { createEnemy, createPlayer } from "./factories";
import { stepWorld } from "./simulation";
import { World } from "./world";
import { isAlive } from "./components";

function setup(enemyDistance = 1) {
  const world = new World();
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  const slime = world.spawn((id) => createEnemy(id, "slime", { x: enemyDistance, y: 0, z: 0 }));
  return { world, player, slime };
}

describe("combate", () => {
  it("jogador causa dano no inimigo em alcance ao pedir ataque", () => {
    const { world, player, slime } = setup();
    player.combat.wantsAttack = true;
    const events = stepWorld(world, 0.016);
    expect(slime.health.current).toBe(slime.health.max - player.combat.damage);
    expect(events).toContainEqual({ type: "damage", source: player.id, target: slime.id, amount: player.combat.damage });
  });

  it("respeita o cooldown entre ataques", () => {
    const { world, player, slime } = setup();
    player.combat.wantsAttack = true;
    stepWorld(world, 0.016);
    player.combat.wantsAttack = true;
    stepWorld(world, 0.016);
    expect(slime.health.current).toBe(slime.health.max - player.combat.damage);
  });

  it("não acerta inimigo fora do alcance", () => {
    const { world, player, slime } = setup(10);
    player.combat.wantsAttack = true;
    stepWorld(world, 0.016);
    expect(slime.health.current).toBe(slime.health.max);
  });

  it("matar inimigo concede XP e ouro e agenda renascimento", () => {
    const { world, player, slime } = setup();
    slime.health.current = 1;
    player.combat.wantsAttack = true;
    const events = stepWorld(world, 0.016);
    expect(isAlive(slime)).toBe(false);
    expect(slime.respawn?.timeLeft).toBeGreaterThan(0);
    expect(player.progression?.xp).toBe(slime.ai!.xpReward);
    expect(player.wallet?.gold).toBe(slime.ai!.goldReward);
    expect(events.some((e) => e.type === "death" && e.entity === slime.id)).toBe(true);
  });

  it("inimigo morto renasce em casa com vida cheia", () => {
    const { world, player, slime } = setup();
    slime.health.current = 1;
    player.combat.wantsAttack = true;
    stepWorld(world, 0.016);
    const events = stepWorld(world, slime.ai!.respawnSeconds + 1);
    expect(isAlive(slime)).toBe(true);
    expect(slime.health.current).toBe(slime.health.max);
    expect(events).toContainEqual({ type: "respawn", entity: slime.id });
  });

  it("jogador regenera vida fora de combate", () => {
    const { world, player } = setup(50);
    player.health.current = 50;
    player.health.lastDamagedAt = 0;
    stepWorld(world, 1);
    expect(player.health.current).toBe(50); // ainda dentro da janela pós-dano
    stepWorld(world, 10);
    expect(player.health.current).toBeGreaterThan(50);
  });
});
