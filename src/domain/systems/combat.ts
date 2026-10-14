import { isAlive, isHostile, type Entity } from "../components";
import { advanceKillQuests } from "../quests";
import { CARAPACE, lobCount, type AttackPattern, type TelegraphShape } from "../boss";
import { directionFromYaw, directionXZ, distanceXZ } from "../math";
import { CHARGE } from "../skills";
import { CLASSES } from "../classes";
import { fireProjectile } from "./projectiles";
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

/** Golpe básico de quem não tem padrões próprios: o do inimigo, melee, ou projétil conforme a classe. */
function defaultPattern(e: Entity): AttackPattern {
  if (e.combat.basicPattern) return e.combat.basicPattern;
  const style = e.classId ? CLASSES[e.classId].attackStyle : "melee";
  if (style !== "melee") {
    return { id: "basic", name: "Disparo", kind: "projectile", range: e.combat.range, windup: 0, damageMultiplier: 1, cooldown: e.combat.cooldown, minPhase: 1, projectile: style };
  }
  return { id: "basic", name: "Golpe", kind: "melee", range: e.combat.range, windup: e.combat.windupTime, damageMultiplier: 1, cooldown: e.combat.cooldown, minPhase: 1 };
}

export function telegraphShape(pattern: AttackPattern, direction: { x: number; z: number }, point?: { x: number; y: number; z: number }): TelegraphShape {
  if (pattern.kind === "charge") return { kind: "line", length: pattern.range, width: 2.4, direction };
  if (pattern.kind === "projectile") return { kind: "line", length: pattern.range, width: 1.1, direction };
  if (pattern.kind === "fan") return { kind: "cone", length: pattern.range, angle: ((pattern.spreadDeg ?? 40) * Math.PI) / 180, direction };
  if ((pattern.kind === "aoe" || pattern.kind === "lob") && point) return { kind: "circle", radius: pattern.range, at: { ...point } };
  return { kind: "circle", radius: pattern.range };
}

/** Pontos de queda de um arremesso: o primeiro no alvo, os demais num anel em volta dele. */
export function lobPoints(world: World, center: { x: number; y: number; z: number }, count: number): { x: number; y: number; z: number }[] {
  const points = [{ ...center }];
  const offset = world.random() * Math.PI * 2;
  for (let i = 1; i < count; i++) {
    const a = offset + ((i - 1) / Math.max(1, count - 1)) * Math.PI * 2;
    const r = 3.6 + world.random() * 1.6;
    points.push({ x: center.x + Math.cos(a) * r, y: center.y, z: center.z + Math.sin(a) * r });
  }
  return points;
}

/** Inicia um golpe: com aviso (windup > 0) ou imediato. A direção é fixada agora. */
export function startAttack(world: World, e: Entity, pattern: AttackPattern, windup: number): void {
  const player = world.player;
  const direction =
    e.kind === "enemy" && player
      ? directionXZ(e.transform.position, player.transform.position)
      : e.abilities?.aimDirection ?? directionFromYaw(e.transform.yaw);
  // Área mirada: o ponto é a posição do alvo agora; quem sair dela até o fim do aviso escapa.
  const aimed = (pattern.kind === "aoe" || pattern.kind === "lob") && player;
  const point = aimed ? { ...player.transform.position } : undefined;
  const points = pattern.kind === "lob" && point ? lobPoints(world, point, lobCount(pattern, e.boss?.phase ?? 1)) : undefined;
  if (windup > 0) {
    e.combat.windupLeft = windup;
    e.combat.pending = { pattern, direction, point, points };
    world.emit({ type: "windup", source: e.id, duration: windup, shape: telegraphShape(pattern, direction, point), patternName: pattern.id === "basic" || pattern.id === "shot" ? undefined : pattern.name });
    // Os outros pontos de queda ganham um aviso próprio, que dura o aviso mais o voo.
    for (const extra of points?.slice(1) ?? []) {
      world.emit({ type: "groundWarning", at: extra, radius: pattern.range, duration: windup + 0.9 });
    }
  } else {
    e.combat.pending = { pattern, direction, point, points };
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
    case "slam":
    case "aoe": {
      const center = pattern.kind === "aoe" && pending?.point ? pending.point : e.transform.position;
      let hit: Entity | undefined;
      for (const other of world.alive()) {
        if (!isHostile(e, other)) continue;
        if (distanceXZ(center, other.transform.position) > pattern.range) continue;
        hit = other;
        applyDamage(world, e, other, damage);
      }
      world.emit({ type: "attack", source: e.id, target: hit?.id });
      break;
    }
    case "projectile": {
      const direction = pending?.direction ?? directionFromYaw(e.transform.yaw);
      fireProjectile(world, e, pattern.projectile ?? "arrow", direction, damage, pattern.range);
      world.emit({ type: "attack", source: e.id });
      break;
    }
    case "fan": {
      // Leque: N projéteis igualmente espaçados na abertura avisada, sem ajuda de mira.
      const base = pending?.direction ?? directionFromYaw(e.transform.yaw);
      const count = Math.max(1, pattern.count ?? 3);
      const spread = ((pattern.spreadDeg ?? 40) * Math.PI) / 180;
      const baseAngle = Math.atan2(base.z, base.x);
      for (let i = 0; i < count; i++) {
        const a = baseAngle + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
        fireProjectile(world, e, pattern.projectile ?? "stinger", { x: Math.cos(a), z: Math.sin(a) }, damage, pattern.range, { aimAssist: false });
      }
      world.emit({ type: "attack", source: e.id });
      break;
    }
    case "lob": {
      // Arremesso: cada globo voa até um ponto avisado e explode lá (deixando poça, se houver).
      const from = e.transform.position;
      for (const point of pending?.points ?? (pending?.point ? [pending.point] : [])) {
        const dx = point.x - from.x, dz = point.z - from.z;
        const dist = Math.max(0.5, Math.hypot(dx, dz));
        fireProjectile(world, e, pattern.projectile ?? "acidGlob", { x: dx / dist, z: dz / dist }, damage, dist, {
          aimAssist: false,
          lob: true,
          explodeRadius: pattern.impactRadius ?? 1.5,
          pool: pattern.pool,
        });
      }
      world.emit({ type: "attack", source: e.id });
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

/** De onde vem o dano: golpe básico, habilidade (quebra carapaça) ou poça no chão. */
export type DamageKind = "basic" | "skill" | "hazard";

export function applyDamage(world: World, source: Entity, target: Entity, amount: number, kind: DamageKind = "basic"): void {
  if (!isAlive(target)) return;
  if (target.abilities?.dash?.invulnerable) {
    // Rolar por cima de uma poça não precisa de "Esquivou!" a cada pulso.
    if (kind !== "hazard") world.emit({ type: "dodge", entity: target.id, source: source.id });
    return;
  }
  // Crítico (afixo da Águia): sorteado antes de escudos, para o número grande valer o golpe inteiro.
  let crit = false;
  const critChance = kind === "hazard" ? 0 : (source.bonuses?.critChance ?? 0);
  if (critChance > 0 && world.random() * 100 < critChance) {
    crit = true;
    amount = Math.round(amount * CRIT_MULTIPLIER);
  }
  // Carapaça de Areia: só habilidades a quebram; partida, o chefe fica vulnerável.
  const shell = target.boss?.carapace;
  if (shell?.active) {
    if (kind !== "skill") {
      world.emit({ type: "immune", entity: target.id, source: source.id });
      return;
    }
    shell.layers = Math.max(0, shell.layers - 1);
    amount = Math.max(1, Math.round(amount * CARAPACE.skillDamageFraction));
    world.emit({ type: "carapaceHit", entity: target.id, layersLeft: shell.layers });
    if (shell.layers === 0) {
      shell.active = false;
      shell.stunLeft = CARAPACE.stun;
      // O golpe que ele preparava se perde.
      target.combat.windupLeft = 0;
      target.combat.pending = undefined;
      if (target.abilities) target.abilities.dash = null;
      world.emit({ type: "carapaceBreak", entity: target.id, stun: CARAPACE.stun });
    }
  } else if (shell && shell.stunLeft > 0) {
    amount = Math.round(amount * CARAPACE.vulnerableMultiplier);
  }
  // Escudo absorve antes da vida.
  const shield = target.abilities?.shield;
  if (shield && shield.amount > 0) {
    const absorbed = Math.min(shield.amount, amount);
    shield.amount -= absorbed;
    amount -= absorbed;
    world.emit({ type: "shieldAbsorb", entity: target.id, amount: absorbed });
    if (shield.amount <= 0) {
      target.abilities!.shield = null;
      world.emit({ type: "shieldEnd", entity: target.id });
    }
    if (amount <= 0) return;
  }
  const dealt = Math.min(target.health.current, amount);
  target.health.current = Math.max(0, target.health.current - amount);
  target.health.lastDamagedAt = world.time;
  world.emit({ type: "damage", source: source.id, target: target.id, amount, crit: crit || undefined });

  // Roubo de vida (afixo do Vampiro): parte do dano causado volta para quem bateu.
  const lifesteal = kind === "hazard" ? 0 : (source.bonuses?.lifesteal ?? 0);
  if (lifesteal > 0 && isAlive(source)) {
    source.health.current = Math.min(source.health.max, source.health.current + (dealt * lifesteal) / 100);
  }

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
        // Afixo da Fortuna: ouro extra por inimigo.
        const gold = Math.round(victim.ai.goldReward * (1 + (killer.bonuses?.goldPercent ?? 0) / 100));
        killer.wallet.gold += gold;
        world.emit({ type: "loot", entity: killer.id, gold });
      }
    }
  } else {
    // Jogador renasce no centro do mundo.
    victim.respawn = { timeLeft: 5, at: { x: 0, y: 0, z: 0 } };
  }
}

const REGEN_DELAY_SECONDS = 5;
export const CRIT_MULTIPLIER = 1.75;

function regenerate(world: World, dt: number): void {
  for (const e of world.alive()) {
    const h = e.health;
    if (h.current >= h.max) continue;
    // Afixo da Serpente: regenera sempre, mesmo em combate.
    const always = e.bonuses?.regen ?? 0;
    if (always > 0) h.current = Math.min(h.max, h.current + always * dt);
    if (world.time - h.lastDamagedAt < REGEN_DELAY_SECONDS) continue;
    h.current = Math.min(h.max, h.current + h.regenPerSecond * dt);
  }
}
