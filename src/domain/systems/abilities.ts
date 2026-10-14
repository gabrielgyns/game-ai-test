import { isAlive, isHostile, type Entity } from "../components";
import { distanceXZ } from "../math";
import { ARCANE_SHIELD, ARROW_RAIN, BLINK, CHARGE, DISENGAGE, FIREBALL, FOCUS, FROST_NOVA, getSkill, PIERCING, ROLL, SECOND_WIND, SKILLS, WARCRY, WHIRLWIND, type SkillId } from "../skills";
import { fireProjectile } from "./projectiles";
import type { World } from "../world";
import { applyDamage, effectiveDamage } from "./combat";

/**
 * Esquiva, investida, habilidades e buffs. Roda antes do movimento, para que um dash
 * iniciado neste tick já desloque o personagem.
 */
export function abilitySystem(world: World, dt: number): void {
  for (const e of world.entities.values()) {
    const ab = e.abilities;
    if (!ab) continue;

    for (const s of ab.skills) s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
    ab.rollCooldownLeft = Math.max(0, ab.rollCooldownLeft - dt);
    if (ab.damageBuff) {
      ab.damageBuff.timeLeft -= dt;
      if (ab.damageBuff.timeLeft <= 0) {
        ab.damageBuff = null;
        world.emit({ type: "buffEnd", entity: e.id });
      }
    }
    if (ab.shield) {
      ab.shield.timeLeft -= dt;
      if (ab.shield.timeLeft <= 0) {
        ab.shield = null;
        world.emit({ type: "shieldEnd", entity: e.id });
      }
    }

    const alive = isAlive(e);
    if (!alive) {
      ab.dash = null;
      ab.queuedSkill = null;
      ab.wantsRoll = false;
      continue;
    }

    // Dash em andamento: investida acerta quem atravessa.
    if (ab.dash) {
      ab.dash.timeLeft -= dt;
      if (ab.dash.kind === "charge") chargeHits(world, e);
      if (ab.dash.timeLeft <= 0) ab.dash = null;
    }

    if (ab.wantsRoll) {
      ab.wantsRoll = false;
      if (!ab.dash && ab.rollCooldownLeft <= 0) {
        ab.dash = {
          kind: "roll",
          timeLeft: ROLL.duration,
          duration: ROLL.duration,
          direction: { ...ab.aimDirection },
          speed: ROLL.distance / ROLL.duration,
          invulnerable: true,
          damageMultiplier: 0,
          hitEntityIds: [],
        };
        ab.rollCooldownLeft = ROLL.cooldown;
        e.combat.wantsAttack = false;
        world.emit({ type: "roll", entity: e.id });
      }
    }

    if (ab.queuedSkill) {
      const id = ab.queuedSkill;
      ab.queuedSkill = null;
      if (!ab.dash) useSkill(world, e, id);
    }
  }
}

function useSkill(world: World, e: Entity, id: SkillId): boolean {
  const ab = e.abilities!;
  const state = getSkill(ab, id);
  if (!state || state.cooldownLeft > 0) return false;

  switch (id) {
    case "whirlwind": {
      let hits = 0;
      for (const other of world.alive()) {
        if (other.kind !== "enemy") continue;
        if (distanceXZ(e.transform.position, other.transform.position) > WHIRLWIND.radius) continue;
        applyDamage(world, e, other, Math.round(effectiveDamage(e) * WHIRLWIND.damageMultiplier), "skill");
        hits++;
      }
      world.emit({ type: "skill", entity: e.id, skill: id, hits });
      break;
    }
    case "charge":
      ab.dash = {
        kind: "charge",
        timeLeft: CHARGE.duration,
        duration: CHARGE.duration,
        direction: { ...ab.aimDirection },
        speed: CHARGE.distance / CHARGE.duration,
        invulnerable: false,
        damageMultiplier: CHARGE.damageMultiplier,
        hitEntityIds: [],
      };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "warcry":
      ab.damageBuff = { multiplier: WARCRY.multiplier, timeLeft: WARCRY.duration };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "secondWind": {
      if (e.health.current >= e.health.max) return false;
      const amount = Math.round(e.health.max * SECOND_WIND.healFraction);
      e.health.current = Math.min(e.health.max, e.health.current + amount);
      world.emit({ type: "heal", entity: e.id, amount });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    // ---- Arqueiro ----
    case "piercingShot":
      fireProjectile(world, e, "piercingArrow", ab.aimDirection, Math.round(effectiveDamage(e) * PIERCING.damageMultiplier), PIERCING.range, { pierce: true, fromSkill: true });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "arrowRain": {
      const center = {
        x: e.transform.position.x + ab.aimDirection.x * ARROW_RAIN.distance,
        y: e.transform.position.y,
        z: e.transform.position.z + ab.aimDirection.z * ARROW_RAIN.distance,
      };
      let hits = 0;
      for (const other of world.alive()) {
        if (other.kind !== "enemy") continue;
        if (distanceXZ(center, other.transform.position) > ARROW_RAIN.radius + (other.boss ? 1 : 0)) continue;
        applyDamage(world, e, other, Math.round(effectiveDamage(e) * ARROW_RAIN.damageMultiplier), "skill");
        hits++;
      }
      world.emit({ type: "projectileHit", projectileId: -1, position: center, explodeRadius: ARROW_RAIN.radius });
      world.emit({ type: "skill", entity: e.id, skill: id, hits });
      break;
    }
    case "disengage":
      ab.dash = {
        kind: "roll",
        timeLeft: DISENGAGE.duration,
        duration: DISENGAGE.duration,
        direction: { x: -ab.aimDirection.x, z: -ab.aimDirection.z },
        speed: DISENGAGE.distance / DISENGAGE.duration,
        invulnerable: true,
        damageMultiplier: 0,
        hitEntityIds: [],
      };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "focus":
      ab.damageBuff = { multiplier: FOCUS.multiplier, timeLeft: FOCUS.duration };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    // ---- Mago ----
    case "fireball":
      fireProjectile(world, e, "fireball", ab.aimDirection, Math.round(effectiveDamage(e) * FIREBALL.damageMultiplier), FIREBALL.range, { explodeRadius: FIREBALL.radius, fromSkill: true });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "frostNova": {
      let hits = 0;
      for (const other of world.alive()) {
        if (other.kind !== "enemy") continue;
        if (distanceXZ(e.transform.position, other.transform.position) > FROST_NOVA.radius + (other.boss ? 1 : 0)) continue;
        applyDamage(world, e, other, Math.round(effectiveDamage(e) * FROST_NOVA.damageMultiplier), "skill");
        hits++;
      }
      world.emit({ type: "skill", entity: e.id, skill: id, hits });
      break;
    }
    case "blink":
      ab.dash = {
        kind: "charge",
        timeLeft: BLINK.duration,
        duration: BLINK.duration,
        direction: { ...ab.aimDirection },
        speed: BLINK.distance / BLINK.duration,
        invulnerable: true,
        damageMultiplier: 0,
        hitEntityIds: [],
      };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    case "arcaneShield":
      ab.shield = { amount: Math.round(e.health.max * ARCANE_SHIELD.fraction), timeLeft: ARCANE_SHIELD.duration };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
  }
  state.cooldownLeft = SKILLS[id].cooldown;
  return true;
}

function chargeHits(world: World, e: Entity): void {
  const dash = e.abilities!.dash!;
  if (dash.damageMultiplier <= 0) return;
  for (const other of world.alive()) {
    if (!isHostile(e, other) || dash.hitEntityIds.includes(other.id)) continue;
    if (distanceXZ(e.transform.position, other.transform.position) > (e.boss ? 2.4 : 1.6)) continue;
    dash.hitEntityIds.push(other.id);
    applyDamage(world, e, other, Math.round(effectiveDamage(e) * dash.damageMultiplier), "skill");
  }
}
