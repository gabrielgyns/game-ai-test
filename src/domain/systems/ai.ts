import { isAlive } from "../components";
import { directionXZ, distanceXZ, lerpAngle, yawFromDirection, clamp } from "../math";
import type { World } from "../world";

/**
 * Máquina de estados simples por inimigo:
 * idle -> chase (jogador entrou no aggro) -> attack (em alcance) -> return (longe de casa).
 */
export function aiSystem(world: World, dt: number): void {
  const player = world.player;
  const playerAlive = player !== undefined && isAlive(player);

  for (const e of world.alive()) {
    const ai = e.ai;
    if (!ai) continue;
    const pos = e.transform.position;
    e.movement.intent = { x: 0, z: 0 };
    e.combat.wantsAttack = false;

    const distHome = distanceXZ(pos, ai.home);
    const distPlayer = playerAlive ? distanceXZ(pos, player.transform.position) : Infinity;

    switch (ai.state) {
      case "idle":
        if (playerAlive && distPlayer <= ai.aggroRange) ai.state = "chase";
        break;

      case "chase":
        if (!playerAlive || distHome > ai.leashRange) {
          ai.state = "return";
        } else if (distPlayer <= e.combat.range) {
          ai.state = "attack";
        } else {
          e.movement.intent = directionXZ(pos, player.transform.position);
        }
        break;

      case "attack":
        if (!playerAlive || distHome > ai.leashRange) {
          ai.state = "return";
        } else if (distPlayer > e.combat.range * 1.15) {
          ai.state = "chase";
        } else {
          // Vira para o jogador e tenta atacar; o sistema de combate decide pelo cooldown.
          const dir = directionXZ(pos, player.transform.position);
          e.transform.yaw = lerpAngle(e.transform.yaw, yawFromDirection(dir), clamp(10 * dt, 0, 1));
          e.combat.wantsAttack = true;
        }
        break;

      case "return":
        if (distHome < 1) {
          ai.state = "idle";
          // Volta para casa recuperado: evita "kiting" infinito.
          e.health.current = e.health.max;
        } else {
          e.movement.intent = directionXZ(pos, ai.home);
        }
        break;
    }
  }
}
