import { isAlive, type Entity } from "../components";
import { distanceXZ } from "../math";
import { grantXp } from "../progression";
import { rollLoot } from "../loot";
import type { World } from "../world";

export function combatSystem(world: World, dt: number): void {
  for (const e of world.alive()) {
    const c = e.combat;
    c.cooldownLeft = Math.max(0, c.cooldownLeft - dt);

    // Golpe telegrafado: o aviso termina e só então o alcance é conferido de novo.
    if (c.windupLeft > 0) {
      c.windupLeft = Math.max(0, c.windupLeft - dt);
      if (c.windupLeft === 0) resolveAttack(world, e);
      c.wantsAttack = false;
      continue;
    }

    if (!c.wantsAttack) continue;
    c.wantsAttack = false;
    if (c.cooldownLeft > 0) continue;
    if (e.abilities?.dash) continue; // não ataca no meio de uma esquiva ou investida

    c.cooldownLeft = c.cooldown;
    if (c.windupTime > 0) {
      c.windupLeft = c.windupTime;
      world.emit({ type: "windup", source: e.id, duration: c.windupTime });
    } else {
      resolveAttack(world, e);
    }
  }

  regenerate(world, dt);
}

function resolveAttack(world: World, e: Entity): void {
  const target = findTarget(world, e);
  world.emit({ type: "attack", source: e.id, target: target?.id });
  if (target) applyDamage(world, e, target, effectiveDamage(e));
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

/** Dano do ataque básico com buffs aplicados. */
export function effectiveDamage(e: Entity): number {
  const buff = e.abilities?.damageBuff;
  return Math.round(e.combat.damage * (buff ? buff.multiplier : 1));
}

export function applyDamage(world: World, source: Entity, target: Entity, amount: number): void {
  if (!isAlive(target)) return;
  if (target.abilities?.dash?.invulnerable) {
    world.emit({ type: "dodge", entity: target.id, source: source.id });
    return;
  }
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
