import type { World } from "../world";
import { resetBoss } from "../boss";

export function respawnSystem(world: World, dt: number): void {
  for (const e of world.entities.values()) {
    const r = e.respawn;
    if (!r) continue;
    r.timeLeft -= dt;
    if (r.timeLeft > 0) continue;

    e.transform.position = { ...r.at };
    e.health.current = e.health.max;
    e.health.lastDamagedAt = -Infinity;
    e.combat.cooldownLeft = 0;
    e.combat.wantsAttack = false;
    e.combat.windupLeft = 0;
    if (e.ai) e.ai.state = "idle";
    if (e.boss) resetBoss(e);
    e.combat.pending = undefined;
    delete e.respawn;
    world.emit({ type: "respawn", entity: e.id });
  }
}
