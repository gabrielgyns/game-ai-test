import * as THREE from "three";
import type { Rarity } from "../domain/items";
import type { World } from "../domain/world";
import { iconPixels } from "./itemIcons";
import { VoxelBuilder, voxelMaterial } from "./voxel";

const RARITY_COLOR: Record<Rarity, string> = {
  common: "#d0d0d0",
  uncommon: "#5fd36b",
  rare: "#5b8def",
  epic: "#b06cf0",
};

const geometryCache = new Map<string, THREE.BufferGeometry>();

/** O ícone 2D do item extrudado em voxels (2 de espessura), como uma "carta" em pé. */
function dropGeometry(icon: string): THREE.BufferGeometry {
  const cached = geometryCache.get(icon);
  if (cached) return cached;
  const b = new VoxelBuilder();
  for (const px of iconPixels(icon)) {
    b.set(px.x - 6, px.y, 0, px.color);
    b.set(px.x - 6, px.y, -1, px.color);
  }
  const geometry = b.build(1 / 16, 0.04);
  geometryCache.set(icon, geometry);
  return geometry;
}

class DropView {
  readonly group = new THREE.Group();
  private readonly card: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private readonly phase = Math.random() * Math.PI * 2;


  constructor(icon: string, rarity: Rarity) {
    const color = new THREE.Color(RARITY_COLOR[rarity]);
    const material = voxelMaterial();
    if (rarity !== "common") {
      // Neon leve: o emissivo passa do limiar do bloom (1.0) e o pós-processamento faz o glow.
      material.emissive = color.clone();
      material.emissiveIntensity = 1.15;
    }
    this.card = new THREE.Mesh(dropGeometry(icon), material);
    this.card.castShadow = true;
    this.card.position.y = 0.35;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    const beamHeight = rarity === "common" ? 0 : rarity === "uncommon" ? 1.6 : rarity === "rare" ? 2.6 : 3.6;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.2, Math.max(beamHeight, 0.01), 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.beam.position.y = beamHeight / 2;
    this.beam.visible = beamHeight > 0;
    this.group.add(this.card, this.ring, this.beam);
  }

  update(time: number): void {
    this.card.rotation.y = time * 1.5 + this.phase;
    this.card.position.y = 0.35 + Math.sin(time * 2.2 + this.phase) * 0.08;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 3 + this.phase) * 0.2;
  }
}

/** Mantém um modelo por drop existente no mundo. */
export class DropViews {
  private views = new Map<number, DropView>();

  constructor(private readonly scene: THREE.Scene) {}

  update(world: World, time: number): void {
    for (const drop of world.drops.values()) {
      let view = this.views.get(drop.id);
      if (!view) {
        view = new DropView(drop.item.icon, drop.item.rarity);
        view.group.position.set(drop.position.x, drop.position.y, drop.position.z);
        this.scene.add(view.group);
        this.views.set(drop.id, view);
      }
      view.update(time);
    }
    for (const [id, view] of this.views) {
      if (!world.drops.has(id)) {
        this.scene.remove(view.group);
        this.views.delete(id);
      }
    }
  }
}
