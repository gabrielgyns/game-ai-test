import * as THREE from "three";

/**
 * Partículas no ar em volta do herói: uma caixa que acompanha a câmera, cada partícula andando com um
 * balanço de vento e voltando ao outro lado quando sai da caixa. Neve caindo nos Picos; cinza caindo e
 * brasas subindo nas Terras Vulcânicas. Tudo num `Points` só.
 */
const SIZE = { x: 44, y: 18, z: 44 };

export interface AirOptions {
  count: number;
  color: THREE.ColorRepresentation;
  size: number;
  opacity: number;
  /** Velocidade vertical (metros por segundo); positiva sobe (brasas), negativa cai. */
  speed: [number, number];
}

const SNOW: AirOptions = { count: 1600, color: "#ffffff", size: 0.09, opacity: 0.85, speed: [-1.7, -0.8] };

export class Snowfall {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly speed: Float32Array;
  private readonly count: number;

  constructor(opts: AirOptions = SNOW) {
    const COUNT = (this.count = opts.count);
    this.base = new Float32Array(COUNT * 3);
    this.speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.base[i * 3] = (Math.random() - 0.5) * SIZE.x;
      this.base[i * 3 + 1] = Math.random() * SIZE.y;
      this.base[i * 3 + 2] = (Math.random() - 0.5) * SIZE.z;
      this.speed[i] = opts.speed[0] + Math.random() * (opts.speed[1] - opts.speed[0]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: opts.color, size: opts.size, transparent: true, opacity: opts.opacity, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  update(time: number, focus: { x: number; y: number; z: number }): void {
    if (!this.points.visible) return;
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const fall = (this.base[i * 3 + 1]! + time * this.speed[i]!) % SIZE.y;
      const y = fall < 0 ? fall + SIZE.y : fall;
      const sway = Math.sin(time * 0.7 + i) * 0.6 + time * 0.8; // vento leve para o leste
      let x = (this.base[i * 3]! + sway) % SIZE.x;
      if (x > SIZE.x / 2) x -= SIZE.x;
      arr[i * 3] = focus.x + x;
      arr[i * 3 + 1] = focus.y - 3 + y;
      arr[i * 3 + 2] = focus.z + this.base[i * 3 + 2]!;
    }
    pos.needsUpdate = true;
  }
}
