import * as THREE from "three";
import type { ProjectileKind } from "../domain/projectiles";
import type { World } from "../domain/world";

function makeMesh(kind: ProjectileKind): THREE.Object3D {
  switch (kind) {
    case "arrow":
    case "piercingArrow": {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: "#8a5a2b" }));
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.18), new THREE.MeshStandardMaterial({ color: "#d8dde6" }));
      tip.position.z = -0.5;
      const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: kind === "piercingArrow" ? "#5fd36b" : "#e5484d" }));
      fletch.position.z = 0.4;
      g.add(shaft, tip, fletch);
      if (kind === "piercingArrow") {
        const glow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color("#5fd36b").multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.add(glow);
      }
      return g;
    }
    case "bolt": {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#8fb3ff").multiplyScalar(1.8) }));
      return m;
    }
    case "fireball": {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff9a3c").multiplyScalar(1.8) }));
      const halo = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5a1f").multiplyScalar(1.3), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.add(core, halo);
      return g;
    }
  }
}

interface Burst {
  ring: THREE.Mesh;
  flash: THREE.Mesh;
  age: number;
  radius: number;
}

/** Projéteis em voo e explosões curtas. */
export class ProjectileViews {
  private views = new Map<number, THREE.Object3D>();
  private bursts: Burst[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(world: World, dt: number, time: number): void {
    for (const p of world.projectiles.values()) {
      let view = this.views.get(p.id);
      if (!view) {
        view = makeMesh(p.kind);
        this.scene.add(view);
        this.views.set(p.id, view);
      }
      view.position.set(p.position.x, p.position.y, p.position.z);
      view.rotation.y = Math.atan2(-p.direction.x, -p.direction.z);
      if (p.kind === "fireball" || p.kind === "bolt") view.rotation.z = time * 6;
    }
    for (const [id, view] of this.views) {
      if (!world.projectiles.has(id)) {
        this.scene.remove(view);
        this.views.delete(id);
      }
    }
    this.bursts = this.bursts.filter((b) => {
      b.age += dt;
      const t = b.age / 0.45;
      b.ring.scale.setScalar(Math.max(0.05, b.radius * Math.min(1, t * 1.4)));
      (b.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - t));
      b.flash.scale.setScalar(0.4 + t * 1.2);
      (b.flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - t * 1.5));
      if (t >= 1) {
        this.scene.remove(b.ring, b.flash);
        return false;
      }
      return true;
    });
  }

  /** Explosão (bola de fogo, chuva de flechas) ou impacto pequeno. */
  burst(position: { x: number; y: number; z: number }, radius: number, color: string): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, position.y + 0.08, position.z);
    const flash = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flash.position.set(position.x, position.y + 0.6, position.z);
    this.scene.add(ring, flash);
    this.bursts.push({ ring, flash, age: 0, radius: Math.max(0.6, radius) });
  }
}
