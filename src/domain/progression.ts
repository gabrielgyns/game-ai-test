import type { Entity } from "./components";
import type { World } from "./world";
import { recomputeStats } from "./inventory";

/** XP necessária para sair do nível `level`. Curva suave, cresce ~35% por nível. */
export function xpForLevel(level: number): number {
  return Math.round(40 * Math.pow(1.35, level - 1));
}

export function grantXp(world: World, entity: Entity, amount: number): void {
  const prog = entity.progression;
  if (!prog || amount <= 0) return;
  prog.xp += amount;
  world.emit({ type: "xp", entity: entity.id, amount });

  while (prog.xp >= prog.xpToNext) {
    prog.xp -= prog.xpToNext;
    prog.level += 1;
    prog.xpToNext = xpForLevel(prog.level);
    applyLevelUp(entity);
    world.emit({ type: "levelUp", entity: entity.id, level: prog.level });
  }
}

/** Cada nível fortalece o personagem e cura por completo. */
function applyLevelUp(entity: Entity): void {
  entity.health.baseMax = Math.round(entity.health.baseMax * 1.12 + 8);
  entity.combat.baseDamage = Math.round(entity.combat.baseDamage * 1.1 + 1);
  recomputeStats(entity);
  entity.health.current = entity.health.max;
}
