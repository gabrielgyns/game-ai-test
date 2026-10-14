import * as THREE from "three";
import type { World } from "../domain/world";
import { terrainHeight } from "../domain/terrain";
import { VoxelBuilder } from "./voxel";

/**
 * Poças no chão (ácido verde que borbulha) e avisos extras de onde algo vai cair.
 * A poça é um disco de voxels rente ao chão: aparece crescendo, pulsa e some no último segundo.
 */
interface PoolView {
  group: THREE.Group;
  disc: THREE.Mesh;
  bubbles: THREE.Mesh[];
  seed: number;
}

interface Warning {
  ring: THREE.Mesh;
  fill: THREE.Mesh;
  age: number;
  duration: number;
  radius: number;
}

const discCache = new Map<number, THREE.BufferGeometry>();

/** Disco de voxels de 1/6 m com borda escura e miolo claro. */
function acidDisc(radius: number): THREE.BufferGeometry {
  const key = Math.round(radius * 10);
  let g = discCache.get(key);
  if (g) return g;
  const b = new VoxelBuilder();
  const r = Math.round(radius * 6);
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) {
      const d = Math.hypot(x, z);
      if (d > r + 0.3) continue;
      // Borda irregular: alguns voxels de fora somem.
      const n = Math.sin(x * 12.9 + z * 78.2) * 43758.5;
      if (d > r - 1.2 && n - Math.floor(n) < 0.35) continue;
      const color = d > r - 1.6 ? "#3f8a24" : d > r * 0.55 ? "#6cc63a" : "#9ce85a";
      b.set(x, 0, z, color);
    }
  g = b.build(1 / 6, { jitter: 0.05, ao: false, skipGroundFaces: true });
  discCache.set(key, g);
  return g;
}

export class HazardViews {
  private pools = new Map<number, PoolView>();
  private warnings: Warning[] = [];
  private readonly bubbleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  constructor(private readonly scene: THREE.Scene) {}

  update(world: World, dt: number, time: number): void {
    for (const h of world.hazards.values()) {
      let view = this.pools.get(h.id);
      if (!view) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, transparent: true, opacity: 0.9, emissive: new THREE.Color("#3f9a20"), emissiveIntensity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const disc = new THREE.Mesh(acidDisc(h.radius), mat);
        disc.renderOrder = 3;
        group.add(disc);
        const bubbles: THREE.Mesh[] = [];
        for (let i = 0; i < 7; i++) {
          const bubble = new THREE.Mesh(this.bubbleGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color("#c8ff8a").multiplyScalar(1.3), transparent: true }));
          group.add(bubble);
          bubbles.push(bubble);
        }
        group.position.set(h.position.x, terrainHeight(h.position.x, h.position.z) + 0.03, h.position.z);
        this.scene.add(group);
        view = { group, disc, bubbles, seed: h.id * 7.3 };
        this.pools.set(h.id, view);
      }
      // Cresce no primeiro 0,3 s, encolhe e some no último segundo.
      const age = h.duration - h.timeLeft;
      const grow = Math.min(1, age / 0.3);
      const fade = Math.min(1, h.timeLeft / 1);
      view.disc.scale.set(grow * (0.96 + Math.sin(time * 4 + view.seed) * 0.04), 1, grow * (0.96 + Math.cos(time * 3.4 + view.seed) * 0.04));
      (view.disc.material as THREE.MeshStandardMaterial).opacity = 0.9 * fade;
      view.bubbles.forEach((b, i) => {
        // Cada bolha sobe e estoura num ciclo próprio, em pontos espalhados pela poça.
        const cycle = (time * 0.9 + i * 0.37 + view!.seed) % 1;
        const a = i * 2.4 + view!.seed;
        const r = h.radius * (0.25 + ((i * 0.31) % 0.6));
        b.position.set(Math.cos(a) * r, cycle * 0.45, Math.sin(a) * r);
        b.scale.setScalar((1 - cycle) * grow);
        (b.material as THREE.MeshBasicMaterial).opacity = fade;
      });
    }
    for (const [id, view] of this.pools) {
      if (!world.hazards.has(id)) {
        this.scene.remove(view.group);
        (view.disc.material as THREE.Material).dispose();
        this.pools.delete(id);
      }
    }

    this.warnings = this.warnings.filter((w) => {
      w.age += dt;
      const t = Math.min(1, w.age / w.duration);
      w.fill.scale.setScalar(Math.max(0.05, w.radius * t));
      (w.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + t * 0.3;
      if (w.age >= w.duration) {
        this.scene.remove(w.ring, w.fill);
        return false;
      }
      return true;
    });
  }

  /** Círculo vermelho que se preenche até o impacto, num ponto fixo do chão. */
  warn(at: { x: number; y: number; z: number }, radius: number, duration: number): void {
    const y = terrainHeight(at.x, at.z) + 0.07;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 32), new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [ring, fill]) {
      m.rotation.x = -Math.PI / 2;
      m.position.set(at.x, y, at.z);
      m.renderOrder = 5;
    }
    ring.scale.setScalar(radius);
    this.scene.add(ring, fill);
    this.warnings.push({ ring, fill, age: 0, duration, radius });
  }
}
