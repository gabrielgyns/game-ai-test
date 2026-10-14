export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Direção normalizada no plano XZ de `from` até `to`. Retorna zero se coincidirem. */
export function directionXZ(from: Vec3, to: Vec3): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

export function normalizeXZ(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: v.x / len, z: v.z / len };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ângulo (yaw) em radianos a partir de uma direção XZ. Convenção: yaw 0 aponta para -Z. */
export function yawFromDirection(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}

/** Interpola ângulos pelo caminho mais curto. */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
