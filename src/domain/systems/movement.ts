import { clamp, lerpAngle, yawFromDirection } from "../math";
import { isIce, isWater, terrainHeight, WORLD_HALF } from "../terrain";
import { zoneAt } from "../zones";
import type { World } from "../world";
import { speedFactor } from "../status";
import { canStand, inDungeonSpace } from "../dungeon";

const TURN_SPEED = 14; // quão rápido a entidade gira para a direção de movimento
/** No gelo: quão rápido a velocidade alcança a direção desejada (menor = escorrega mais). */
export const ICE_GRIP = 1.6;

export function movementSystem(world: World, dt: number): void {
  for (const e of world.alive()) {
    const pos = e.transform.position;
    const dash = e.abilities?.dash;
    // Um dash substitui o movimento normal: direção e velocidade fixas, corpo virado para onde vai.
    const intent = dash ? dash.direction : e.movement.intent;
    const inWater = !dash && isWater(pos.x, pos.z);
    const speed = dash ? dash.speed : e.movement.speed * e.movement.speedMultiplier * (inWater ? 0.6 : 1) * speedFactor(e);
    let moving = intent.x !== 0 || intent.z !== 0;
    let vx = intent.x * speed, vz = intent.z * speed;
    // Gelo: a velocidade só alcança a desejada aos poucos, e parar também leva tempo.
    // Fora do gelo a velocidade é a desejada; ela fica guardada para quem pisar no gelo entrar embalado.
    const s = (e.movement.slide ??= { x: 0, z: 0 });
    if (!dash && isIce(pos.x, pos.z)) {
      const k = 1 - Math.exp(-ICE_GRIP * dt);
      s.x += (vx - s.x) * k;
      s.z += (vz - s.z) * k;
      vx = s.x;
      vz = s.z;
      moving = Math.hypot(vx, vz) > 0.05;
    } else {
      s.x = vx;
      s.z = vz;
    }

    if (moving) {
      const nx = pos.x + vx * dt;
      const nz = pos.z + vz * dt;
      if (inDungeonSpace(pos.x)) {
        // Dentro da cripta: paredes de verdade. Cada eixo separado, para deslizar rente à parede.
        if (canStand(world, nx, pos.z)) pos.x = nx;
        if (canStand(world, pos.x, nz)) pos.z = nz;
      } else {
        // Cada zona é um quadrado próprio: ninguém sai pela borda.
        const zone = zoneAt(pos.x, pos.z);
        pos.x = clamp(nx, zone.center.x - WORLD_HALF + 2, zone.center.x + WORLD_HALF - 2);
        pos.z = clamp(nz, zone.center.z - WORLD_HALF + 2, zone.center.z + WORLD_HALF - 2);
      }
    }
    const targetYaw = dash ? yawFromDirection(intent) : (e.movement.faceYaw ?? (intent.x !== 0 || intent.z !== 0 ? yawFromDirection(intent) : undefined));
    if (targetYaw !== undefined) {
      e.transform.yaw = lerpAngle(e.transform.yaw, targetYaw, clamp(TURN_SPEED * dt, 0, 1));
    }
    pos.y = terrainHeight(pos.x, pos.z);
  }
}
