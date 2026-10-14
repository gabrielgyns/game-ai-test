import { clamp, lerpAngle, yawFromDirection } from "../math";
import { isWater, terrainHeight, WORLD_HALF } from "../terrain";
import type { World } from "../world";
import { speedFactor } from "../status";

const TURN_SPEED = 14; // quão rápido a entidade gira para a direção de movimento

export function movementSystem(world: World, dt: number): void {
  for (const e of world.alive()) {
    const pos = e.transform.position;
    const dash = e.abilities?.dash;
    // Um dash substitui o movimento normal: direção e velocidade fixas, corpo virado para onde vai.
    const intent = dash ? dash.direction : e.movement.intent;
    const inWater = !dash && isWater(pos.x, pos.z);
    const speed = dash ? dash.speed : e.movement.speed * e.movement.speedMultiplier * (inWater ? 0.6 : 1) * speedFactor(e);
    const moving = intent.x !== 0 || intent.z !== 0;

    if (moving) {
      pos.x = clamp(pos.x + intent.x * speed * dt, -WORLD_HALF + 2, WORLD_HALF - 2);
      pos.z = clamp(pos.z + intent.z * speed * dt, -WORLD_HALF + 2, WORLD_HALF - 2);
    }
    const targetYaw = dash ? yawFromDirection(intent) : (e.movement.faceYaw ?? (moving ? yawFromDirection(intent) : undefined));
    if (targetYaw !== undefined) {
      e.transform.yaw = lerpAngle(e.transform.yaw, targetYaw, clamp(TURN_SPEED * dt, 0, 1));
    }
    pos.y = terrainHeight(pos.x, pos.z);
  }
}
