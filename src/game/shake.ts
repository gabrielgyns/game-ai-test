/**
 * Tremor de câmera por "trauma": cada impacto soma trauma (0..1), que decai com o tempo; o tremor
 * é proporcional a trauma², então pancadas fracas mal mexem a tela e pancadas fortes sacodem.
 * O deslocamento vem de senos em frequências que não se repetem juntas, um ruído suave e barato.
 *
 * Analogia: um sino. Cada golpe o faz vibrar mais; sem golpes, ele vai silenciando sozinho.
 */
export class CameraShake {
  trauma = 0;
  /** Ajuste do jogador (0 desliga, 1 é o padrão). */
  intensity = 1;
  private t = 0;
  static readonly DECAY = 1.5; // trauma por segundo
  static readonly MAX_OFFSET = 0.32; // metros
  static readonly MAX_ROLL = 0.045; // radianos

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  /** Avança o tempo e devolve o deslocamento da câmera (no espaço dela) e a rotação no eixo da visão. */
  update(dt: number): { x: number; y: number; roll: number } {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - CameraShake.DECAY * dt);
    const shake = this.trauma * this.trauma * this.intensity;
    if (shake <= 0) return { x: 0, y: 0, roll: 0 };
    const t = this.t * 28;
    const n1 = Math.sin(t * 1.0) * 0.6 + Math.sin(t * 2.31 + 1.7) * 0.4;
    const n2 = Math.sin(t * 1.17 + 4.1) * 0.6 + Math.sin(t * 2.73 + 0.3) * 0.4;
    const n3 = Math.sin(t * 0.83 + 2.2) * 0.6 + Math.sin(t * 1.91 + 5.3) * 0.4;
    return {
      x: n1 * shake * CameraShake.MAX_OFFSET,
      y: n2 * shake * CameraShake.MAX_OFFSET,
      roll: n3 * shake * CameraShake.MAX_ROLL,
    };
  }
}

/** Trauma de um golpe sofrido pelo herói: proporcional à fatia da vida que o golpe levou. */
export function traumaFromDamage(amount: number, maxHealth: number): number {
  if (maxHealth <= 0) return 0;
  return Math.min(0.65, 0.22 + (amount / maxHealth) * 1.4);
}

/** Impactos distantes tremem menos; além de `radius` metros, nada. */
export function attenuate(trauma: number, distance: number, radius = 18): number {
  if (distance >= radius) return 0;
  const k = 1 - distance / radius;
  return trauma * k * k;
}
