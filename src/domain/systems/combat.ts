import { isAlive, isHostile, type Entity } from "../components";
import { advanceKillQuests } from "../quests";
import type { AttackPattern, TelegraphShape } from "../boss";
import { directionFromYaw, directionXZ, distanceXZ } from "../math";
import { CHARGE } from "../skills";
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
    startAttack(world, e, defaultPattern(e), c.windupTime);
  }

  regenerate(world, dt);
}

/** Golpe básico de quem não tem padrões próprios. */
function defaultPattern(e: Entity): AttackPattern {
  return { id: "basic", name: "Golpe", kind: "melee", range: e.combat.range, windup: e.combat.windupTime, damageMultiplier: 1, cooldown: e.combat.cooldown, minPhase: 1 };
}

export function telegraphShape(pattern: AttackPattern, direction: { x: number; z: number }): TelegraphShape {
  if (pattern.kind === "charge") return { kind: "line", length: pattern.range, width: 2.4, direction };
  return { kind: "circle", radius: pattern.range };
}

/** Inicia um golpe: com aviso (windup > 0) ou imediato. A direção é fixada agora. */
export function startAttack(world: World, e: Entity, pattern: AttackPattern, windup: number): void {
  const player = world.player;
  const direction =
    e.kind === "enemy" && player ? directionXZ(e.transform.position, player.transform.position) : directionFromYaw(e.transform.yaw);
  if (windup > 0) {
    e.combat.windupLeft = windup;
    e.combat.pending = { pattern, direction };
    world.emit({ type: "windup", source: e.id, duration: windup, shape: telegraphShape(pattern, direction), patternName: pattern.id === "basic" ? undefined : pattern.name });
  } else {
    e.combat.pending = { pattern, direction };
    resolveAttack(world, e);
  }
}

function resolveAttack(world: World, e: Entity): void {
  const pending = e.combat.pending;
  e.combat.pending = undefined;
  const pattern = pending?.pattern ?? defaultPattern(e);
  const damage = Math.round(effectiveDamage(e) * pattern.damageMultiplier);

  switch (pattern.kind) {
    case "melee": {
      const target = findTarget(world, e, pattern.range);
      world.emit({ type: "attack", source: e.id, target: target?.id });
      if (target) applyDamage(world, e, target, damage);
      break;
    }
    case "slam": {
      let hit: Entity | undefined;
      for (const other of world.alive()) {
        if (!isHostile(e, other)) continue;
        if (distanceXZ(e.transform.position, other.transform.position) > pattern.range) continue;
        hit = other;
        applyDamage(world, e, other, damage);
      }
      world.emit({ type: "attack", source: e.id, target: hit?.id });
      break;
    }
    case "charge": {
      const ab = e.abilities;
      if (!ab) break;
      const duration = CHARGE.duration * (pattern.range / CHARGE.distance);
      ab.dash = {
        kind: "charge",
        timeLeft: duration,
        duration,
        direction: pending?.direction ?? directionFromYaw(e.transform.yaw),
        speed: pattern.range / duration,
        invulnerable: false,
        damageMultiplier: pattern.damageMultiplier,
        hitEntityIds: [],
      };
      world.emit({ type: "attack", source: e.id });
      break;
    }
  }
}

/** Jogador acerta o inimigo vivo mais próximo em alcance; inimigo só acerta o jogador. */
export function findTarget(world: World, attacker: Entity, range = attacker.combat.range): Entity | undefined {
  const pos = attacker.transform.position;
  if (attacker.kind === "enemy") {
    const p = world.player;
    return p && isAlive(p) && distanceXZ(pos, p.transform.position) <= range ? p : undefined;
  }
  let best: Entity | undefined;
  let bestDist = Infinity;
  for (const other of world.alive()) {
    if (other.kind !== "enemy") continue;
    const d = distanceXZ(pos, other.transform.position);
    if (d <= range && d < bestDist) {
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
  victim.combat.windupLeft = 0;
  victim.combat.pending = undefined;
  if (victim.abilities) victim.abilities.dash = null;

  if (victim.ai) {
    victim.ai.state = "idle";
    victim.respawn = { timeLeft: victim.ai.respawnSeconds, at: { ...victim.ai.home } };
    if (killer.kind === "player") {
      if (killer.stats) killer.stats.kills++;
      rollLoot(world, victim);
      advanceKillQuests(world, killer, victim.archetype);
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
