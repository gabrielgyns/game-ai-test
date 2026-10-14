import { describe, expect, it } from "vitest";
import { createPlayer } from "./factories";
import { grantXp, xpForLevel } from "./progression";
import { World } from "./world";

describe("progressão", () => {
  it("sobe de nível ao atingir a XP necessária e cura por completo", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const before = { hp: player.health.max, dmg: player.combat.damage };
    player.health.current = 10;

    grantXp(world, player, xpForLevel(1));

    expect(player.progression?.level).toBe(2);
    expect(player.progression?.xp).toBe(0);
    expect(player.health.max).toBeGreaterThan(before.hp);
    expect(player.health.current).toBe(player.health.max);
    expect(player.combat.damage).toBeGreaterThan(before.dmg);
    expect(world.drainEvents()).toContainEqual({ type: "levelUp", entity: player.id, level: 2 });
  });

  it("pode subir vários níveis de uma vez e carrega o excedente", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    grantXp(world, player, xpForLevel(1) + xpForLevel(2) + 5);
    expect(player.progression?.level).toBe(3);
    expect(player.progression?.xp).toBe(5);
  });
});
