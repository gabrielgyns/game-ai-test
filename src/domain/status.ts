import type { Entity } from "./components";
import type { World } from "./world";

/**
 * Efeitos de status: as "primitivas" que os talentos combinam. Em vez de cada talento inventar sua
 * regra, todos pedem uma destas três coisas, e os sistemas sabem respeitá-las:
 * - atordoado: não anda nem ataca, e perde o golpe que preparava;
 * - lento: anda mais devagar;
 * - vulnerável: leva mais dano.
 * Chefes resistem: atordoamento e lentidão duram metade.
 */
export interface StatusEffects {
  stunLeft: number;
  slowLeft: number;
  /** Multiplicador de velocidade enquanto lento (0,6 = 40% mais lento). */
  slowFactor: number;
  vulnerableLeft: number;
  /** Dano extra recebido enquanto vulnerável (0,25 = +25%). */
  vulnerableBonus: number;
}

function ensure(e: Entity): StatusEffects {
  if (!e.status) e.status = { stunLeft: 0, slowLeft: 0, slowFactor: 1, vulnerableLeft: 0, vulnerableBonus: 0 };
  return e.status;
}

const resist = (e: Entity, seconds: number) => (e.boss ? seconds * 0.5 : seconds);

export function applyStun(world: World, e: Entity, seconds: number): void {
  const s = ensure(e);
  const d = resist(e, seconds);
  if (d <= s.stunLeft) return;
  s.stunLeft = d;
  e.combat.windupLeft = 0;
  e.combat.pending = undefined;
  if (e.abilities?.dash && !e.abilities.dash.invulnerable) e.abilities.dash = null;
  e.movement.intent = { x: 0, z: 0 };
  world.emit({ type: "status", entity: e.id, effect: "stun", seconds: d });
}

export function applySlow(world: World, e: Entity, factor: number, seconds: number): void {
  const s = ensure(e);
  const d = resist(e, seconds);
  // Vale o mais forte; a duração renova.
  s.slowFactor = s.slowLeft > 0 ? Math.min(s.slowFactor, factor) : factor;
  s.slowLeft = Math.max(s.slowLeft, d);
  world.emit({ type: "status", entity: e.id, effect: "slow", seconds: d });
}

export function applyVulnerable(world: World, e: Entity, bonus: number, seconds: number): void {
  const s = ensure(e);
  s.vulnerableBonus = s.vulnerableLeft > 0 ? Math.max(s.vulnerableBonus, bonus) : bonus;
  s.vulnerableLeft = Math.max(s.vulnerableLeft, seconds);
  world.emit({ type: "status", entity: e.id, effect: "vulnerable", seconds });
}

export const isStunned = (e: Entity): boolean => (e.status?.stunLeft ?? 0) > 0;
export const speedFactor = (e: Entity): number => ((e.status?.slowLeft ?? 0) > 0 ? e.status!.slowFactor : 1);
export const vulnerability = (e: Entity): number => ((e.status?.vulnerableLeft ?? 0) > 0 ? e.status!.vulnerableBonus : 0);

/** Conta o tempo dos efeitos. Roda no começo do passo, antes da IA. */
export function statusSystem(world: World, dt: number): void {
  for (const e of world.entities.values()) {
    const s = e.status;
    if (!s) continue;
    s.stunLeft = Math.max(0, s.stunLeft - dt);
    s.slowLeft = Math.max(0, s.slowLeft - dt);
    if (s.slowLeft === 0) s.slowFactor = 1;
    s.vulnerableLeft = Math.max(0, s.vulnerableLeft - dt);
    if (s.vulnerableLeft === 0) s.vulnerableBonus = 0;
    // Morreu: limpa tudo para renascer sem efeitos.
    if (e.health.current <= 0) e.status = undefined;
  }
}
