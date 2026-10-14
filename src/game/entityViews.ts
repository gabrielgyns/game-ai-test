import * as THREE from "three";
import { isAlive, type Entity, type EntityId } from "../domain/components";
import type { World } from "../domain/world";
import { createModel, equipmentSignature, type CharacterModel } from "./models";
import type { TelegraphShape } from "../domain/boss";
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
  private windupTotal = 0;
  private windupShape: TelegraphShape | null = null;
  private readonly telegraph: THREE.Group;
  private readonly telegraphFill: THREE.Mesh;
  private readonly telegraphRing: THREE.Mesh;
  private readonly telegraphLine: THREE.Mesh;
  private readonly telegraphLineFill: THREE.Mesh;
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

    // Telegraph: área vermelha que preenche o alcance do golpe durante o aviso.
    this.telegraph = new THREE.Group();
    this.telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 32),
      new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.telegraphFill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    );
    // Versão em linha (investidas): retângulo partindo do atacante na direção do avanço.
    const lineMat = () => new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.telegraphLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lineMat());
    (this.telegraphLine.material as THREE.MeshBasicMaterial).opacity = 0.2;
    this.telegraphLineFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lineMat());
    this.telegraph.add(this.telegraphRing, this.telegraphFill, this.telegraphLine, this.telegraphLineFill);
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.visible = false;
    this.telegraph.renderOrder = 5;
    scene.add(this.telegraph);
  }

  triggerWindup(duration: number, shape: TelegraphShape): void {
    this.windupTotal = duration;
    this.windupShape = shape;
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
      this.telegraph.visible = false; // morreu no meio do aviso: a marca some junto
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

    // Aviso de golpe: anel no alcance e preenchimento crescendo até o impacto; o corpo recua.
    const windingUp = e.combat.windupLeft > 0 && this.windupTotal > 0 && this.windupShape !== null;
    this.telegraph.visible = windingUp;
    if (windingUp) {
      const progress = 1 - e.combat.windupLeft / this.windupTotal;
      const shape = this.windupShape!;
      this.telegraph.position.set(p.x, p.y + 0.06, p.z);
      const circle = shape.kind === "circle";
      this.telegraphRing.visible = this.telegraphFill.visible = circle;
      this.telegraphLine.visible = this.telegraphLineFill.visible = !circle;
      if (circle) {
        const r = shape.radius;
        this.telegraphRing.scale.setScalar(r);
        this.telegraphFill.scale.setScalar(Math.max(0.05, r * progress));
        (this.telegraphFill.material as THREE.MeshBasicMaterial).opacity = 0.18 + progress * 0.3;
      } else {
        // Plano no XZ (grupo já rotacionado): eixo Y local aponta para -Z do mundo.
        const angle = Math.atan2(shape.direction.x, -shape.direction.z);
        for (const [mesh, len] of [[this.telegraphLine, shape.length], [this.telegraphLineFill, shape.length * progress]] as const) {
          mesh.scale.set(shape.width, Math.max(0.05, len), 1);
          mesh.rotation.z = -angle;
          mesh.position.set(Math.sin(angle) * (len / 2), Math.cos(angle) * (len / 2), 0);
        }
        (this.telegraphLineFill.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.3;
      }
      root.rotation.x += 0.25 * Math.sin(progress * Math.PI / 2); // recua antes de bater
      if (this.model.weaponArm) this.model.weaponArm.rotation.x = -1.2 * progress; // arma erguida
      if (!this.model.weaponArm) root.scale.y = 1 - progress * 0.25; // gosma se comprime
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.model.root, this.healthBar, this.targetRing, this.telegraph);
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
