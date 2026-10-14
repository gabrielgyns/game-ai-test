import { isAlive, isHostile, type Entity } from "../components";
import { distanceXZ } from "../math";
import { PROJECTILE_SPECS, type Projectile } from "../projectiles";
import { terrainHeight } from "../terrain";
import type { World } from "../world";
import { applyDamage } from "./combat";
import { applyStun } from "../status";
import { isWalkable } from "../dungeon";

/** Move projéteis, resolve acertos (primeiro hostil no raio) e explosões. */
export function projectileSystem(world: World, dt: number): void {
  for (const p of world.projectiles.values()) {
    const owner = world.get(p.owner);
    if (!owner) {
      world.projectiles.delete(p.id);
      continue;
    }
    const step = p.speed * dt;
    p.position.x += p.direction.x * step;
    p.position.z += p.direction.z * step;
    p.position.y = Math.max(p.position.y, terrainHeight(p.position.x, p.position.z) + 0.6);
    p.traveled += step;

    const hitRadius = PROJECTILE_SPECS[p.kind].hitRadius;
    let hit: Entity | undefined;
    for (const other of p.lob ? [] : world.alive()) {
      if (!isHostile(owner, other) || p.hitIds.includes(other.id)) continue;
      if (distanceXZ(p.position, other.transform.position) <= hitRadius + (other.boss ? 1.2 : 0)) {
        hit = other;
        break;
      }
    }

    if (hit) {
      p.hitIds.push(hit.id);
      if (p.explodeRadius > 0) {
        explode(world, owner, p);
      } else {
        applyDamage(world, owner, hit, p.damage, p.fromSkill ? "skill" : "basic");
        if (p.stun && hit.health.current > 0) applyStun(world, hit, p.stun);
        world.emit({ type: "projectileHit", projectileId: p.id, target: hit.id, position: { ...p.position }, explodeRadius: 0 });
      }
      if (!p.pierce) {
        world.projectiles.delete(p.id);
        continue;
      }
    }

    // Bateu numa parede da cripta (arremessos em arco passam por cima).
    if (!p.lob && !isWalkable(world, p.position.x, p.position.z)) {
      if (p.explodeRadius > 0) explode(world, owner, p);
      else world.emit({ type: "projectileHit", projectileId: p.id, position: { ...p.position }, explodeRadius: 0 });
      world.projectiles.delete(p.id);
      continue;
    }

    if (p.traveled >= p.maxDistance) {
      if (p.explodeRadius > 0) explode(world, owner, p);
      world.projectiles.delete(p.id);
    }
  }
}

function explode(world: World, owner: Entity, p: Projectile): void {
  let target: Entity | undefined;
  for (const other of world.alive()) {
    if (!isHostile(owner, other)) continue;
    if (distanceXZ(p.position, other.transform.position) > p.explodeRadius + (other.boss ? 1 : 0)) continue;
    target = other;
    applyDamage(world, owner, other, p.damage, p.fromSkill ? "skill" : "basic");
  }
  if (p.pool) world.addHazard(owner, p.pool, { x: p.position.x, y: terrainHeight(p.position.x, p.position.z), z: p.position.z });
  world.emit({ type: "projectileHit", projectileId: p.id, target: target?.id, position: { ...p.position }, explodeRadius: p.explodeRadius });
  world.projectiles.delete(p.id);
}

/**
 * Dispara um projétil a partir de uma entidade. Ajuda de mira: se houver um hostil num cone de 22°
 * dentro do alcance, a direção é corrigida para ele (sem isso, mirar só com a câmera é ingrato).
 */
export function fireProjectile(
  world: World,
  owner: Entity,
  kind: Projectile["kind"],
  direction: { x: number; z: number },
  damage: number,
  maxDistance: number,
  opts: { explodeRadius?: number; pierce?: boolean; aimAssist?: boolean; fromSkill?: boolean; lob?: boolean; pool?: Projectile["pool"] } = {},
): Projectile {
  let dir = { ...direction };
  // Ajuda de mira é para o jogador; o tiro do inimigo segue a linha avisada, para dar para desviar.
  if (opts.aimAssist !== false && owner.kind === "player") {
    let best: Entity | undefined;
    let bestDot = Math.cos((22 * Math.PI) / 180);
    for (const other of world.alive()) {
      if (!isHostile(owner, other) || !isAlive(other)) continue;
      const dx = other.transform.position.x - owner.transform.position.x;
      const dz = other.transform.position.z - owner.transform.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5 || d > maxDistance) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot > bestDot) {
        bestDot = dot;
        best = other;
      }
    }
    if (best) {
      const dx = best.transform.position.x - owner.transform.position.x;
      const dz = best.transform.position.z - owner.transform.position.z;
      const d = Math.hypot(dx, dz);
      dir = { x: dx / d, z: dz / d };
    }
  }
  const start = owner.transform.position;
  return world.addProjectile({
    kind,
    owner: owner.id,
    position: { x: start.x + dir.x * 0.6, y: start.y + 1.2, z: start.z + dir.z * 0.6 },
    direction: dir,
    speed: PROJECTILE_SPECS[kind].speed,
    maxDistance,
    damage,
    explodeRadius: opts.explodeRadius ?? 0,
    pierce: opts.pierce ?? false,
    fromSkill: opts.fromSkill,
    lob: opts.lob,
    pool: opts.pool,
  });
}
