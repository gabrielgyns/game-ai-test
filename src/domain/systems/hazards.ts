import { isHostile } from "../components";
import { distanceXZ } from "../math";
import type { World } from "../world";
import { applyDamage } from "./combat";

/** Poças: pulsam dano em quem é hostil ao dono e somem quando o tempo acaba. */
export function hazardSystem(world: World, dt: number): void {
  for (const h of world.hazards.values()) {
    h.timeLeft -= dt;
    if (h.timeLeft <= 0) {
      world.hazards.delete(h.id);
      world.emit({ type: "hazardEnd", hazardId: h.id });
      continue;
    }
    h.tickLeft -= dt;
    if (h.tickLeft > 0) continue;
    h.tickLeft += h.tickEvery;
    const owner = world.get(h.owner);
    if (!owner) continue;
    for (const e of world.alive()) {
      if (!isHostile(owner, e)) continue;
      if (distanceXZ(h.position, e.transform.position) > h.radius) continue;
      applyDamage(world, owner, e, h.damage, "hazard");
    }
  }
}
