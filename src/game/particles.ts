import * as THREE from "three";
import { terrainHeight } from "../domain/terrain";

/**
 * Partículas em voxel: cubinhos que voam, caem, quicam no chão e encolhem até sumir.
 * Um único InstancedMesh com um pool fixo; cada emissão reaproveita os mais antigos.
 * Cores acima de 1 (faíscas) passam do limiar do bloom e brilham.
 */
interface Particle {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Rotação acumulada e velocidade de giro (só visual). */
  rot: number; spin: number;
  size: number;
  age: number;
  life: number;
  gravity: number;
  /** Quanto da velocidade sobra ao quicar (0 = gruda no chão). */
  bounce: number;
  /** Arrasto do ar por segundo (faíscas param rápido, poeira flutua). */
  drag: number;
}

export interface BurstOptions {
  count: number;
  colors: THREE.ColorRepresentation[];
  /** Velocidade radial (min, max) em m/s. */
  speed: [number, number];
  /** Impulso para cima (min, max). */
  up: [number, number];
  size: [number, number];
  life: [number, number];
  gravity?: number;
  bounce?: number;
  drag?: number;
  /** Multiplicador de brilho (> 1 brilha com bloom). */
  glow?: number;
  /** Espalhamento inicial em volta do ponto. */
  spread?: number;
}

export class Particles {
  private readonly pool: Particle[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private cursor = 0;
  /** Partículas vivas (para medir e testar). */
  active = 0;

  constructor(scene: THREE.Scene, capacity = 700) {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    for (let i = 0; i < capacity; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, size: 0, age: 0, life: 1, gravity: 0, bounce: 0, drag: 0 });
      this.mesh.setColorAt(i, this.color.set("#ffffff"));
    }
    scene.add(this.mesh);
  }

  burst(origin: { x: number; y: number; z: number }, o: BurstOptions): void {
    const r = (a: [number, number]) => a[0] + Math.random() * (a[1] - a[0]);
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.pool.length;
      const p = this.pool[i]!;
      const angle = Math.random() * Math.PI * 2;
      const speed = r(o.speed);
      const spread = o.spread ?? 0.2;
      p.alive = true;
      p.x = origin.x + (Math.random() - 0.5) * spread;
      p.y = origin.y + (Math.random() - 0.5) * spread;
      p.z = origin.z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = r(o.up);
      p.rot = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 14;
      p.size = r(o.size);
      p.age = 0;
      p.life = r(o.life);
      p.gravity = o.gravity ?? 14;
      p.bounce = o.bounce ?? 0.35;
      p.drag = o.drag ?? 0.6;
      this.color.set(o.colors[n % o.colors.length]!).multiplyScalar(o.glow ?? 1);
      this.mesh.setColorAt(i, this.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let maxIndex = -1;
    let active = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]!;
      if (!p.alive) {
        // Instâncias mortas abaixo do maior índice vivo viram escala zero.
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const floor = terrainHeight(p.x, p.z) + p.size / 2;
      if (p.y < floor) {
        p.y = floor;
        if (p.vy < 0) p.vy = -p.vy * p.bounce;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.spin *= 0.6;
      }
      p.rot += p.spin * dt;
      // Encolhe no último terço da vida.
      const t = p.age / p.life;
      const s = p.size * (t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rot * 0.7, p.rot, 0);
      this.dummy.scale.setScalar(Math.max(s, 0.0001));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      maxIndex = i;
      active++;
    }
    this.active = active;
    this.mesh.count = maxIndex + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Receitas ---------- */

  /** Acerto: lascas na cor da criatura e faíscas brilhantes. */
  hit(at: { x: number; y: number; z: number }, colors: THREE.ColorRepresentation[], heavy = false): void {
    this.burst(at, { count: heavy ? 12 : 7, colors, speed: [1.5, heavy ? 4.5 : 3.2], up: [2, 4.5], size: [0.07, 0.14], life: [0.45, 0.8] });
    this.burst(at, { count: heavy ? 8 : 5, colors: ["#fff3c4", "#ffd37a"], glow: 2.2, speed: [3, 7], up: [1, 4], size: [0.04, 0.07], life: [0.12, 0.25], gravity: 4, drag: 6, bounce: 0 });
  }

  /** Morte: a criatura se desfaz em blocos que quicam pelo chão. */
  death(at: { x: number; y: number; z: number }, colors: THREE.ColorRepresentation[], big = false): void {
    this.burst(at, { count: big ? 46 : 22, colors, speed: [1.2, big ? 5 : 3.6], up: [2.5, big ? 7 : 5.5], size: [0.1, big ? 0.3 : 0.2], life: [0.9, 1.5], spread: big ? 1.4 : 0.6, bounce: 0.4 });
    this.burst(at, { count: big ? 14 : 6, colors: ["#e8e0cf", "#cfc6b4"], speed: [0.6, 1.6], up: [0.6, 1.4], size: [0.18, 0.32], life: [0.6, 1.0], gravity: -0.6, drag: 2, bounce: 0 });
  }

  /** Poeira no chão (rolamento, investida, aterrissagem). */
  dust(at: { x: number; y: number; z: number }, color: THREE.ColorRepresentation = "#bfae8a"): void {
    this.burst(at, { count: 6, colors: [color], speed: [0.5, 1.6], up: [0.4, 1.2], size: [0.12, 0.22], life: [0.35, 0.6], gravity: 1.5, drag: 3, bounce: 0 });
  }

  /** Brilho subindo (cura, nível). */
  sparkle(at: { x: number; y: number; z: number }, colors: THREE.ColorRepresentation[], count = 18): void {
    this.burst(at, { count, colors, glow: 1.8, speed: [0.4, 1.6], up: [2, 4], size: [0.05, 0.1], life: [0.6, 1.1], gravity: -0.5, drag: 1.5, bounce: 0, spread: 1.2 });
  }
}

/** Cores das lascas por criatura (corpo, detalhe). */
export const HIT_COLORS: Record<string, string[]> = {
  hero: ["#d94a4a", "#f0b48a"],
  slime: ["#6fcf5a", "#a6ec8a", "#3f9a3a"],
  goblin: ["#6a9c3c", "#8a6a3a"],
  orc: ["#5f7d3a", "#6b6b6b"],
  bandit: ["#b08b5a", "#6b2f2f"],
  bogZombie: ["#5d6b45", "#3e4a2f", "#7a8a4a"],
  spider: ["#4a2b5e", "#2a1a35", "#7a3d8f"],
  scorpion: ["#b8752f", "#7a4a1f"],
  goblinKing: ["#6a9c3c", "#ffd54a", "#7a1f2b"],
  spiderQueen: ["#4a2b5e", "#b8322f", "#2a1a35"],
  goblinArcher: ["#7bb04a", "#3d6b2a"],
  banditArcher: ["#2f4f7a", "#d9a070"],
  scorpionEmperor: ["#5a2a1e", "#d4a92a", "#2e1a14"],
  skeleton: ["#e4dcc4", "#c8bfa4", "#4a2f5a"],
  skeletonArcher: ["#e4dcc4", "#c8bfa4", "#3a4a2a"],
  skeletonLord: ["#e8e0c8", "#2e2a34", "#4a2a6a", "#9a4ad8"],
};
