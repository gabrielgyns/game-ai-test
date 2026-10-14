import { isAlive, isHostile, type Entity } from "../components";
import { distanceXZ, type Vec3 } from "../math";
import {
  ARCANE_SHIELD, ARROW_RAIN, BLINK, CHARGE, DISENGAGE, FIREBALL, FOCUS, FROST_NOVA, getSkill, PIERCING, ROLL, SECOND_WIND, WARCRY, WHIRLWIND,
  type Abilities, type SkillId,
} from "../skills";
import { effectiveCooldown, hasTalent, skillMods } from "../skillTree";
import { applySlow, applyStun, applyVulnerable } from "../status";
import { ARROW_STORM, FIRE_POOL } from "../hazards";
import { fireProjectile } from "./projectiles";
import type { World } from "../world";
import { applyDamage, effectiveDamage } from "./combat";

/**
 * Esquiva, investida, habilidades e buffs. Roda antes do movimento, para que um dash
 * iniciado neste tick já desloque o personagem. Cada habilidade lê os ranks e talentos da árvore
 * (`skillMods`) e combina as primitivas de status (atordoar, lentidão, vulnerável).
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
    if (ab.guard) {
      ab.guard.timeLeft -= dt;
      if (ab.guard.timeLeft <= 0) ab.guard = null;
    }
    if (ab.shield) {
      ab.shield.timeLeft -= dt;
      // Mana Viva: cura enquanto o escudo dura.
      if (ab.shield.amount > 0 && isAlive(e) && hasTalent(e, "arcaneShield", "shieldRegen")) {
        e.health.current = Math.min(e.health.max, e.health.current + e.health.max * 0.03 * dt);
      }
      if (ab.shield.timeLeft <= 0 || ab.shield.amount <= 0) endShield(world, e, ab);
    }

    const alive = isAlive(e);
    if (!alive) {
      ab.dash = null;
      ab.queuedSkill = null;
      ab.wantsRoll = false;
      continue;
    }

    // Dash em andamento: investida acerta quem atravessa; ao fim, aplica o buff do talento.
    if (ab.dash) {
      ab.dash.timeLeft -= dt;
      if (ab.dash.kind === "charge") chargeHits(world, e);
      if (ab.dash.timeLeft <= 0) {
        const after = ab.dash.afterBuff;
        ab.dash = null;
        if (after) grantBuff(ab, after.multiplier, after.duration);
      }
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

/** Buff de dano: o mais forte vence; empate renova a duração. */
function grantBuff(ab: Abilities, multiplier: number, duration: number, critBonus?: number): void {
  const current = ab.damageBuff;
  if (current && current.multiplier > multiplier && current.timeLeft > 0) return;
  ab.damageBuff = { multiplier, timeLeft: Math.max(duration, current && current.multiplier === multiplier ? current.timeLeft : 0), critBonus };
}

/** Escudo acabou (tempo ou dano). Com Retorno, explode em volta. */
function endShield(world: World, e: Entity, ab: Abilities): void {
  ab.shield = null;
  world.emit({ type: "shieldEnd", entity: e.id });
  if (isAlive(e) && hasTalent(e, "arcaneShield", "shieldNova")) {
    burst(world, e, e.transform.position, 4, Math.round(effectiveDamage(e) * 1.5));
    world.emit({ type: "projectileHit", projectileId: -2, position: { ...e.transform.position }, explodeRadius: 4 });
  }
}

/** Dano em área a partir de um ponto, em todo hostil no raio. Devolve quem foi atingido. */
function burst(world: World, e: Entity, center: Vec3, radius: number, damage: number): Entity[] {
  const hit: Entity[] = [];
  for (const other of world.alive()) {
    if (!isHostile(e, other)) continue;
    if (distanceXZ(center, other.transform.position) > radius + (other.boss ? 1 : 0)) continue;
    applyDamage(world, e, other, damage, "skill");
    hit.push(other);
  }
  return hit;
}

/** Leque de direções em volta de uma direção base (para Rajada e Bola Dupla). */
function spread(dir: { x: number; z: number }, count: number, totalDeg: number): { x: number; z: number }[] {
  const base = Math.atan2(dir.z, dir.x);
  const total = (totalDeg * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * total);
    return { x: Math.cos(a), z: Math.sin(a) };
  });
}

function useSkill(world: World, e: Entity, id: SkillId): boolean {
  const ab = e.abilities!;
  const state = getSkill(ab, id);
  if (!state || state.cooldownLeft > 0) return false;
  const m = skillMods(e, id);
  const has = (t: Parameters<typeof hasTalent>[2]) => m.talents.includes(t);
  const pos = e.transform.position;

  switch (id) {
    case "whirlwind": {
      const hit = burst(world, e, pos, WHIRLWIND.radius + m.radius, Math.round(effectiveDamage(e) * WHIRLWIND.damageMultiplier * (1 + m.damage)));
      if (has("whirlHeal") && hit.length) e.health.current = Math.min(e.health.max, e.health.current + e.health.max * 0.03 * hit.length);
      if (has("whirlVuln")) for (const t of hit) applyVulnerable(world, t, 0.25, 4);
      world.emit({ type: "skill", entity: e.id, skill: id, hits: hit.length });
      break;
    }
    case "charge": {
      const distance = CHARGE.distance + m.distance;
      const duration = CHARGE.duration * (distance / CHARGE.distance);
      ab.dash = {
        kind: "charge",
        timeLeft: duration,
        duration,
        direction: { ...ab.aimDirection },
        speed: distance / duration,
        invulnerable: false,
        damageMultiplier: CHARGE.damageMultiplier * (1 + m.damage),
        hitEntityIds: [],
        stun: has("chargeStun") ? 1.2 : undefined,
        afterBuff: has("chargeBuff") ? { multiplier: 1.3, duration: 4 } : undefined,
      };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "warcry": {
      grantBuff(ab, WARCRY.multiplier + m.buff, WARCRY.duration + m.duration);
      if (has("warcrySlow")) {
        for (const other of world.alive()) {
          if (isHostile(e, other) && distanceXZ(pos, other.transform.position) <= 7) applySlow(world, other, 0.6, 5);
        }
      }
      if (has("warcryHeal")) heal(world, e, Math.round(e.health.max * 0.2));
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "secondWind": {
      if (e.health.current >= e.health.max) return false;
      heal(world, e, Math.round(e.health.max * (SECOND_WIND.healFraction + m.heal)));
      if (has("ironSkin")) ab.guard = { reduction: 0.4, timeLeft: 5 };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    // ---- Arqueiro ----
    case "piercingShot": {
      const dirs = has("pierceVolley") ? spread(ab.aimDirection, 3, 16) : [ab.aimDirection];
      const damage = Math.round(effectiveDamage(e) * PIERCING.damageMultiplier * (1 + m.damage));
      dirs.forEach((dir, i) => {
        const p = fireProjectile(world, e, "piercingArrow", dir, damage, PIERCING.range, { pierce: true, fromSkill: true, aimAssist: i === Math.floor(dirs.length / 2) });
        if (has("pierceStun")) p.stun = 0.8;
      });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "arrowRain": {
      const center = { x: pos.x + ab.aimDirection.x * ARROW_RAIN.distance, y: pos.y, z: pos.z + ab.aimDirection.z * ARROW_RAIN.distance };
      const radius = ARROW_RAIN.radius + m.radius;
      const hit = burst(world, e, center, radius, Math.round(effectiveDamage(e) * ARROW_RAIN.damageMultiplier * (1 + m.damage)));
      if (has("rainSlow")) for (const t of hit) applySlow(world, t, 0.5, 3);
      if (has("rainStorm")) world.addHazard(e, { ...ARROW_STORM, radius }, center);
      world.emit({ type: "projectileHit", projectileId: -1, position: center, explodeRadius: radius });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: hit.length });
      break;
    }
    case "disengage": {
      const distance = DISENGAGE.distance + m.distance;
      if (has("disengageTrap")) {
        for (const other of world.alive()) {
          if (isHostile(e, other) && distanceXZ(pos, other.transform.position) <= 3.5) applySlow(world, other, 0.4, 3);
        }
      }
      ab.dash = {
        kind: "roll",
        timeLeft: DISENGAGE.duration,
        duration: DISENGAGE.duration,
        direction: { x: -ab.aimDirection.x, z: -ab.aimDirection.z },
        speed: distance / DISENGAGE.duration,
        invulnerable: true,
        damageMultiplier: 0,
        hitEntityIds: [],
        afterBuff: has("disengageBuff") ? { multiplier: 1.5, duration: 3 } : undefined,
      };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "focus": {
      grantBuff(ab, FOCUS.multiplier + m.buff, FOCUS.duration + m.duration, has("focusCrit") ? 25 : undefined);
      if (has("focusReset")) {
        const pierce = getSkill(ab, "piercingShot");
        if (pierce) pierce.cooldownLeft = 0;
      }
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    // ---- Mago ----
    case "fireball": {
      const dirs = has("fireballTwin") ? spread(ab.aimDirection, 2, 14) : [ab.aimDirection];
      const damage = Math.round(effectiveDamage(e) * FIREBALL.damageMultiplier * (1 + m.damage));
      const radius = FIREBALL.radius + m.radius;
      dirs.forEach((dir) => {
        fireProjectile(world, e, "fireball", dir, damage, FIREBALL.range, {
          explodeRadius: radius,
          fromSkill: true,
          aimAssist: dirs.length === 1,
          pool: has("fireballPool") ? { ...FIRE_POOL, radius } : undefined,
        });
      });
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "frostNova": {
      const hit = burst(world, e, pos, FROST_NOVA.radius + m.radius, Math.round(effectiveDamage(e) * FROST_NOVA.damageMultiplier * (1 + m.damage)));
      for (const t of hit) {
        if (t.health.current <= 0) continue;
        if (has("novaFreeze")) applyStun(world, t, 1.5);
        if (has("novaShatter")) applyVulnerable(world, t, 0.3, 4);
      }
      world.emit({ type: "skill", entity: e.id, skill: id, hits: hit.length });
      break;
    }
    case "blink": {
      if (has("blinkBlast")) {
        burst(world, e, pos, 2.5, Math.round(effectiveDamage(e) * 0.9));
        world.emit({ type: "projectileHit", projectileId: -2, position: { ...pos }, explodeRadius: 2.5 });
      }
      const distance = BLINK.distance + m.distance;
      ab.dash = {
        kind: "charge",
        timeLeft: BLINK.duration,
        duration: BLINK.duration,
        direction: { ...ab.aimDirection },
        speed: distance / BLINK.duration,
        invulnerable: true,
        damageMultiplier: 0,
        hitEntityIds: [],
      };
      if (has("blinkShield")) {
        const amount = Math.round(e.health.max * 0.2);
        if (!ab.shield || ab.shield.amount < amount) ab.shield = { amount, timeLeft: 4 };
      }
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
    }
    case "arcaneShield":
      ab.shield = { amount: Math.round(e.health.max * (ARCANE_SHIELD.fraction + m.heal)), timeLeft: ARCANE_SHIELD.duration + m.duration };
      world.emit({ type: "skill", entity: e.id, skill: id, hits: 0 });
      break;
  }
  state.cooldownLeft = effectiveCooldown(e, id);
  return true;
}

function heal(world: World, e: Entity, amount: number): void {
  const before = e.health.current;
  e.health.current = Math.min(e.health.max, e.health.current + amount);
  const gained = Math.round(e.health.current - before);
  if (gained > 0) world.emit({ type: "heal", entity: e.id, amount: gained });
}

function chargeHits(world: World, e: Entity): void {
  const dash = e.abilities!.dash!;
  if (dash.damageMultiplier <= 0) return;
  for (const other of world.alive()) {
    if (!isHostile(e, other) || dash.hitEntityIds.includes(other.id)) continue;
    if (distanceXZ(e.transform.position, other.transform.position) > (e.boss ? 2.4 : 1.6)) continue;
    dash.hitEntityIds.push(other.id);
    applyDamage(world, e, other, Math.round(effectiveDamage(e) * dash.damageMultiplier), "skill");
    if (dash.stun && other.health.current > 0) applyStun(world, other, dash.stun);
  }
}
