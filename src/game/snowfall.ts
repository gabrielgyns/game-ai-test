import * as THREE from "three";

/**
 * Neve caindo em volta do herói: uma caixa de flocos que acompanha a câmera, cada floco descendo com
 * um balanço de vento e voltando ao topo quando chega ao chão da caixa. Tudo num `Points` só.
 */
const COUNT = 1600;
const SIZE = { x: 44, y: 18, z: 44 };

export class Snowfall {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly speed: Float32Array;

  constructor() {
    this.base = new Float32Array(COUNT * 3);
    this.speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.base[i * 3] = (Math.random() - 0.5) * SIZE.x;
      this.base[i * 3 + 1] = Math.random() * SIZE.y;
      this.base[i * 3 + 2] = (Math.random() - 0.5) * SIZE.z;
      this.speed[i] = 0.8 + Math.random() * 0.9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  update(time: number, focus: { x: number; y: number; z: number }): void {
    if (!this.points.visible) return;
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const fall = (this.base[i * 3 + 1]! - time * this.speed[i]!) % SIZE.y;
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
