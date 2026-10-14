import * as THREE from "three";
import { isAlive, type Entity, type EntityId } from "../domain/components";
import type { World } from "../domain/world";
import { createModel, equipmentSignature, type CharacterModel } from "./models";
import { clamp } from "../domain/math";

/** Liga uma entidade do domínio a um modelo na cena, com animação procedural. */
class EntityView {
  model: CharacterModel;
  private modelSignature: string;
  readonly healthBar: THREE.Group;
  private readonly healthFill: THREE.Mesh;
  private readonly targetRing: THREE.Mesh;
  private swingTime = Infinity;
  private walkPhase = 0;
  private deathTime = 0;
  private visualY: number | null = null;
  private spinTime = Infinity;
  private readonly scene: THREE.Scene;

  constructor(readonly entity: Entity, scene: THREE.Scene) {
    this.scene = scene;
    this.modelSignature = equipmentSignature(entity.equipment);
    this.model = createModel(entity.archetype, entity.equipment);
    this.model.root.rotation.order = "YXZ"; // yaw primeiro, depois a cambalhota em torno do próprio eixo
    scene.add(this.model.root);

    this.healthBar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: "#1a1a1a", depthTest: false }));
    this.healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.14),
      new THREE.MeshBasicMaterial({ color: entity.kind === "player" ? "#4cd964" : "#e5484d", depthTest: false }),
    );
    this.healthFill.position.z = 0.001;
    this.healthBar.add(back, this.healthFill);
    this.healthBar.renderOrder = 10;
    this.healthBar.visible = entity.kind === "enemy";
    scene.add(this.healthBar);

    this.targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.1, 24),
      new THREE.MeshBasicMaterial({ color: "#ffd37a", side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.visible = false;
    scene.add(this.targetRing);
  }

  triggerSwing(): void {
    this.swingTime = 0;
  }

  /** Golpe Giratório: o modelo inteiro gira 360°. */
  triggerSpin(): void {
    this.spinTime = 0;
  }

  /** Troca o modelo quando o equipamento visível muda. */
  private syncEquipment(): void {
    const sig = equipmentSignature(this.entity.equipment);
    if (sig === this.modelSignature) return;
    this.modelSignature = sig;
    this.scene.remove(this.model.root);
    this.model = createModel(this.entity.archetype, this.entity.equipment);
    this.model.root.rotation.order = "YXZ";
    this.scene.add(this.model.root);
  }

  update(dt: number, camera: THREE.Camera, isTarget: boolean, time: number): void {
    const e = this.entity;
    this.syncEquipment();
    const root = this.model.root;
    const alive = isAlive(e);
    const p = e.transform.position;
    // O terreno é em degraus: a altura visual persegue a real para a subida parecer um passo, não um salto.
    this.visualY = this.visualY === null ? p.y : this.visualY + (p.y - this.visualY) * clamp(dt * 14, 0, 1);
    root.position.set(p.x, this.visualY, p.z);
    root.rotation.y = e.transform.yaw;

    // Morte: afunda e some; renascimento: volta ao normal.
    if (!alive) {
      this.deathTime += dt;
      const t = clamp(this.deathTime / 1.2, 0, 1);
      root.scale.setScalar(1 - t);
      root.position.y -= t * 0.5;
      root.visible = t < 1;
      this.healthBar.visible = false;
      this.targetRing.visible = false;
      return;
    }
    this.deathTime = 0;
    root.visible = true;
    root.scale.setScalar(1);

    // Esquiva: cambalhota para a frente. Investida: inclinação para a frente.
    const dash = e.abilities?.dash;
    root.rotation.x = 0;
    if (dash) {
      const progress = 1 - dash.timeLeft / dash.duration;
      if (dash.kind === "roll") {
        // Cambalhota em torno do centro do corpo (o pivô do modelo fica nos pés).
        const theta = -progress * Math.PI * 2;
        const c = this.model.height / 2;
        root.rotation.x = theta;
        // Compensa o pivô: o centro (0, c, 0) girado por theta vai para (0, c·cos, c·sin) no espaço local.
        const w = -c * Math.sin(theta);
        root.position.y += c - c * Math.cos(theta) + Math.sin(progress * Math.PI) * 0.35;
        root.position.x += w * Math.sin(root.rotation.y);
        root.position.z += w * Math.cos(root.rotation.y);
      } else {
        root.rotation.x = -0.35;
      }
    }
    // Golpe Giratório.
    this.spinTime += dt;
    const spinning = this.spinTime < 0.45;
    const spin = spinning ? (this.spinTime / 0.45) * Math.PI * 2 : 0;
    root.rotation.y += spin;
    if (this.model.weaponArm && spinning) this.model.weaponArm.rotation.z = -Math.PI / 2;
    else if (this.model.weaponArm) this.model.weaponArm.rotation.z = 0;

    // Caminhada: balanço vertical e leve inclinação enquanto se move.
    const moving = e.movement.intent.x !== 0 || e.movement.intent.z !== 0;
    if (moving) {
      this.walkPhase += dt * e.movement.speed * 1.6;
      root.position.y += Math.abs(Math.sin(this.walkPhase)) * 0.12;
      root.rotation.z = Math.sin(this.walkPhase) * 0.05;
    } else {
      root.rotation.z = 0;
      // Respiração ociosa.
      root.position.y += Math.sin(time * 2 + e.id) * 0.02;
    }

    // Golpe: braço desce rapidamente e volta.
    if (this.model.weaponArm) {
      this.swingTime += dt;
      const d = 0.3;
      const k = this.swingTime < d ? Math.sin((this.swingTime / d) * Math.PI) : 0;
      this.model.weaponArm.rotation.x = k * 2.4;
      this.model.weaponArm.rotation.y = k * 0.3;
    } else if (this.swingTime < 0.3) {
      // Gosma "pula" para atacar.
      this.swingTime += dt;
      root.position.y += Math.sin((this.swingTime / 0.3) * Math.PI) * 0.6;
    }

    // Barra de vida flutuante, sempre virada para a câmera.
    const showBar = e.kind === "enemy" && (e.health.current < e.health.max || isTarget || e.ai?.state !== "idle");
    this.healthBar.visible = showBar;
    if (showBar) {
      this.healthBar.position.set(p.x, p.y + this.model.height + 0.35, p.z);
      this.healthBar.quaternion.copy(camera.quaternion);
      const ratio = e.health.current / e.health.max;
      this.healthFill.scale.x = Math.max(ratio, 0.001);
      this.healthFill.position.x = -(1 - ratio) * 0.6;
    }

    this.targetRing.visible = isTarget;
    if (isTarget) this.targetRing.position.set(p.x, p.y + 0.05, p.z);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.model.root, this.healthBar, this.targetRing);
  }
}

export class EntityViews {
  private views = new Map<EntityId, EntityView>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(world: World): void {
    for (const e of world.entities.values()) {
      if (!this.views.has(e.id)) this.views.set(e.id, new EntityView(e, this.scene));
    }
  }

  get(id: EntityId): EntityView | undefined {
    return this.views.get(id);
  }

  update(dt: number, camera: THREE.Camera, targetId: EntityId | undefined, time: number): void {
    for (const v of this.views.values()) v.update(dt, camera, v.entity.id === targetId, time);
  }
}
