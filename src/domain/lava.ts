import { isAlive } from "./components";
import { isLava } from "./terrain";
import { applyDamage } from "./systems/combat";
import type { World } from "./world";

/**
 * Lava das Terras Vulcânicas: queima o herói enquanto ele estiver em cima, em pulsos, uma fração da
 * vida máxima por pulso (rolar por cima não queima). Os bichos de fogo não se importam: só o herói se
 * fere. É chão proibido, como a água funda que não existe: atravessar é possível, ficar é morrer.
 */
export const LAVA = { tick: 0.5, fraction: 0.07 };

export function lavaSystem(world: World, dt: number): void {
  const p = world.player;
  if (!p || !isAlive(p) || !isLava(p.transform.position.x, p.transform.position.z)) {
    world.lavaClock = 0;
    return;
  }
  world.lavaClock += dt;
  while (world.lavaClock >= LAVA.tick) {
    world.lavaClock -= LAVA.tick;
    if (p.abilities?.dash) continue;
    applyDamage(world, p, p, Math.max(1, Math.round(p.health.max * LAVA.fraction)), "hazard");
    world.emit({ type: "lavaBurn", entity: p.id });
  }
}
