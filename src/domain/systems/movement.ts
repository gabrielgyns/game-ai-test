import { clamp, lerpAngle, yawFromDirection } from "../math";
import { terrainHeight, WORLD_HALF } from "../terrain";
import type { World } from "../world";

const TURN_SPEED = 14; // quão rápido a entidade gira para a direção de movimento

export function movementSystem(world: World, dt: number): void {
  for (const e of world.alive()) {
    const { intent, speed } = e.movement;
    const pos = e.transform.position;
    const moving = intent.x !== 0 || intent.z !== 0;

    if (moving) {
      pos.x = clamp(pos.x + intent.x * speed * dt, -WORLD_HALF + 2, WORLD_HALF - 2);
      pos.z = clamp(pos.z + intent.z * speed * dt, -WORLD_HALF + 2, WORLD_HALF - 2);
      const target = yawFromDirection(intent);
      e.transform.yaw = lerpAngle(e.transform.yaw, target, clamp(TURN_SPEED * dt, 0, 1));
    }
    pos.y = terrainHeight(pos.x, pos.z);
  }
}
