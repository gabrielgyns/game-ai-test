import { describe, expect, it } from "vitest";
import { createPlayer } from "./factories";
import { stepWorld } from "./simulation";
import { World } from "./world";

describe("movimento", () => {
  it("sem faceYaw, o personagem gira para a direção do movimento", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    player.movement.intent = { x: 0, z: 1 }; // para +Z (trás)
    for (let i = 0; i < 60; i++) stepWorld(world, 1 / 60);
    expect(Math.abs(Math.abs(player.transform.yaw) - Math.PI)).toBeLessThan(0.05);
    expect(player.transform.position.z).toBeGreaterThan(0.5);
  });

  it("com faceYaw, anda de ré mantendo o corpo virado para a frente", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    player.movement.faceYaw = 0; // encara -Z
    player.movement.intent = { x: 0, z: 1 }; // move para +Z
    for (let i = 0; i < 60; i++) stepWorld(world, 1 / 60);
    expect(Math.abs(player.transform.yaw)).toBeLessThan(0.05);
    expect(player.transform.position.z).toBeGreaterThan(0.5);
  });
});
