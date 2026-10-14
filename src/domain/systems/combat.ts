import { isAlive, type Entity } from "../components";
import { distanceXZ } from "../math";
import { grantXp } from "../progression";
import { rollLoot } from "../loot";
import type { World } from "../world";

export function combatSystem(world: World, dt: number): void {
  for (const e of world.alive()) {
    e.combat.cooldownLeft = Math.max(0, e.combat.cooldownLeft - dt);
    if (!e.combat.wantsAttack) continue;
    e.combat.wantsAttack = false;
    if (e.combat.cooldownLeft > 0) continue;

    e.combat.cooldownLeft = e.combat.cooldown;
    const target = findTarget(world, e);
    world.emit({ type: "attack", source: e.id, target: target?.id });
    if (target) applyDamage(world, e, target, e.combat.damage);
  }

  regenerate(world, dt);
}

/** Jogador acerta o inimigo vivo mais próximo em alcance; inimigo só acerta o jogador. */
export function findTarget(world: World, attacker: Entity): Entity | undefined {
  const pos = attacker.transform.position;
  if (attacker.kind === "enemy") {
    const p = world.player;
    return p && isAlive(p) && distanceXZ(pos, p.transform.position) <= attacker.combat.range ? p : undefined;
  }
  let best: Entity | undefined;
  let bestDist = Infinity;
  for (const other of world.alive()) {
    if (other.kind !== "enemy") continue;
    const d = distanceXZ(pos, other.transform.position);
    if (d <= attacker.combat.range && d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

export function applyDamage(world: World, source: Entity, target: Entity, amount: number): void {
  if (!isAlive(target)) return;
  target.health.current = Math.max(0, target.health.current - amount);
  target.health.lastDamagedAt = world.time;
  world.emit({ type: "damage", source: source.id, target: target.id, amount });

  // Ser atacado acorda o inimigo mesmo fora do aggro.
  if (target.ai && target.ai.state === "idle") target.ai.state = "chase";

  if (target.health.current === 0) kill(world, target, source);
}

function kill(world: World, victim: Entity, killer: Entity): void {
  world.emit({ type: "death", entity: victim.id, killer: killer.id });
  victim.movement.intent = { x: 0, z: 0 };

  if (victim.ai) {
    victim.ai.state = "idle";
    victim.respawn = { timeLeft: victim.ai.respawnSeconds, at: { ...victim.ai.home } };
    if (killer.kind === "player") {
      rollLoot(world, victim);
      grantXp(world, killer, victim.ai.xpReward);
      if (killer.wallet) {
        killer.wallet.gold += victim.ai.goldReward;
        world.emit({ type: "loot", entity: killer.id, gold: victim.ai.goldReward });
      }
    }
  } else {
    // Jogador renasce no centro do mundo.
    victim.respawn = { timeLeft: 5, at: { x: 0, y: 0, z: 0 } };
  }
}

const REGEN_DELAY_SECONDS = 5;

function regenerate(world: World, dt: number): void {
  for (const e of world.alive()) {
    const h = e.health;
    if (h.current >= h.max) continue;
    if (world.time - h.lastDamagedAt < REGEN_DELAY_SECONDS) continue;
    h.current = Math.min(h.max, h.current + h.regenPerSecond * dt);
  }
}
