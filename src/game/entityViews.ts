import * as THREE from "three";
import { isAlive, type Entity, type EntityId } from "../domain/components";
import type { World } from "../domain/world";
import { createModel, equipmentSignature, type CharacterModel } from "./models";
import { VoxelBuilder } from "./voxel";
import type { TelegraphShape } from "../domain/boss";
import { questsForNpc } from "../domain/quests";
import { clamp } from "../domain/math";

const FLASH_TIME = 0.14;
const WHITE = new THREE.Color("#ffffff");

/** Liga uma entidade do domínio a um modelo na cena, com animação procedural. */
class EntityView {
  model: CharacterModel;
  private modelSignature: string;
  readonly healthBar: THREE.Group;
  private readonly healthFill: THREE.Mesh;
  private readonly targetRing: THREE.Mesh;
  private swingTime = Infinity;
  private walkPhase = 0;
  /** Fase do passo (-1..1) suavizada, para pernas e braços. */
  private stride = 0;
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
  /** Leque (cone): reconstruído quando a abertura muda. */
  private telegraphCone: THREE.Mesh | null = null;
  private telegraphConeFill: THREE.Mesh | null = null;
  private coneAngle = 0;
  /** Carapaça de Areia (casca de voxels dourados) e estrelinhas de atordoamento. */
  private carapaceMesh: THREE.Mesh | null = null;
  private stunStars: THREE.Group | null = null;
  private marker: THREE.Sprite | null = null;
  private shieldMesh!: THREE.Mesh;
  private markerKind: "" | "!" | "?" = "";
  private readonly scene: THREE.Scene;
  /** Clarão branco ao levar um golpe: segundos restantes e materiais com o emissivo original. */
  private flashLeft = 0;
  private flashMaterials: { material: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }[] = [];

  constructor(readonly entity: Entity, scene: THREE.Scene) {
    this.scene = scene;
    this.modelSignature = equipmentSignature(entity.equipment);
    this.model = createModel(entity.archetype, entity.equipment, entity.classId);
    this.model.root.rotation.order = "YXZ"; // yaw primeiro, depois a cambalhota em torno do próprio eixo
    scene.add(this.model.root);
    this.collectMaterials();
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#8fb3ff").multiplyScalar(1.4), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }),
    );
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);

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

  /** "!" quando o NPC tem quest para oferecer, "?" quando há quest para entregar. */
  private updateMarker(player: Entity | undefined, camera: THREE.Camera): void {
    const e = this.entity;
    if (!e.npc || !player?.quests) return;
    const { offer, turnIn } = questsForNpc(player.quests, e.npc.id);
    const kind: "" | "!" | "?" = turnIn.length ? "?" : offer.length ? "!" : "";
    if (kind !== this.markerKind) {
      this.markerKind = kind;
      if (this.marker) {
        this.scene.remove(this.marker);
        this.marker = null;
      }
      if (kind) this.marker = makeMarker(kind, kind === "?" ? "#9ce39c" : "#ffd54a");
      if (this.marker) this.scene.add(this.marker);
    }
    if (this.marker) {
      const p = e.transform.position;
      this.marker.position.set(p.x, p.y + this.model.height + 0.5 + Math.sin(performance.now() / 400) * 0.08, p.z);
      this.marker.quaternion.copy(camera.quaternion);
    }
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
    this.model = createModel(this.entity.archetype, this.entity.equipment, this.entity.classId);
    this.model.root.rotation.order = "YXZ";
    this.scene.add(this.model.root);
    this.collectMaterials();
  }

  private collectMaterials(): void {
    const seen = new Set<THREE.Material>();
    this.flashMaterials = [];
    this.model.root.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!(m instanceof THREE.MeshStandardMaterial) || seen.has(m)) return;
      seen.add(m);
      this.flashMaterials.push({ material: m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity });
    });
  }

  /** Clarão rápido de "acertou". */
  flash(): void {
    this.flashLeft = FLASH_TIME;
  }

  /** Setor de círculo de raio 1 com a abertura pedida, centrado no +X local. */
  private ensureCone(angle: number): void {
    if (this.telegraphCone && Math.abs(angle - this.coneAngle) < 1e-3) return;
    if (this.telegraphCone) {
      this.telegraph.remove(this.telegraphCone, this.telegraphConeFill!);
      this.telegraphCone.geometry.dispose();
      this.telegraphConeFill!.geometry.dispose();
    }
    this.coneAngle = angle;
    const mat = (opacity: number) => new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    this.telegraphCone = new THREE.Mesh(new THREE.CircleGeometry(1, 28, -angle / 2, angle), mat(0.16));
    this.telegraphConeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 28, -angle / 2, angle), mat(0.3));
    this.telegraph.add(this.telegraphCone, this.telegraphConeFill);
  }

  /** Casca da Carapaça de Areia e estrelas do atordoamento, criadas só para quem tem carapaça. */
  private updateCarapace(time: number): void {
    const shell = this.entity.boss?.carapace;
    if (!shell) return;
    const p = this.entity.transform.position;
    if (!this.carapaceMesh) {
      const b = new VoxelBuilder();
      const r = 9;
      for (let x = -r; x <= r; x++)
        for (let y = 0; y <= r; y++)
          for (let z = -r; z <= r; z++) {
            const d = Math.hypot(x, y * 1.15, z);
            if (d > r || d < r - 1.2) continue;
            // Placas hexagonais sugeridas por faixas alternadas de tom.
            const band = (Math.floor((x + 20) / 3) + Math.floor((z + 20) / 3) + Math.floor(y / 3)) % 3;
            b.set(x, y, z, band === 0 ? "#f0d38a" : band === 1 ? "#d9b25a" : "#c4963c");
          }
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false, emissive: new THREE.Color("#a07820"), emissiveIntensity: 0.25 });
      this.carapaceMesh = new THREE.Mesh(b.build(1 / 3.6, { jitter: 0.05, ao: false }), mat);
      this.carapaceMesh.renderOrder = 4;
      this.scene.add(this.carapaceMesh);
      this.stunStars = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const star = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe57a").multiplyScalar(1.7) }));
        this.stunStars.add(star);
      }
      this.scene.add(this.stunStars);
    }
    const alive = isAlive(this.entity);
    this.carapaceMesh.visible = alive && shell.active;
    if (this.carapaceMesh.visible) {
      this.carapaceMesh.position.set(p.x, p.y, p.z);
      this.carapaceMesh.rotation.y = time * 0.25;
      // Cada camada perdida deixa a casca mais rala.
      const k = shell.layers / shell.maxLayers;
      (this.carapaceMesh.material as THREE.MeshStandardMaterial).opacity = 0.14 + 0.26 * k;
      this.carapaceMesh.scale.setScalar(1 + Math.sin(time * 3) * 0.015);
    }
    this.stunStars!.visible = alive && shell.stunLeft > 0;
    if (this.stunStars!.visible) {
      const top = this.model.height + 0.3;
      this.stunStars!.children.forEach((s, i) => {
        const a = time * 3 + (i / 4) * Math.PI * 2;
        s.position.set(p.x + Math.cos(a) * 1.1, p.y + top + Math.sin(time * 6 + i) * 0.1, p.z + Math.sin(a) * 1.1);
        s.rotation.set(time * 4, time * 3, 0);
      });
    }
  }

  private applyFlash(dt: number): void {
    if (this.flashLeft <= 0) return;
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    const k = this.flashLeft / FLASH_TIME;
    const glow = new Set(this.model.glowMaterials?.map((g) => g.material));
    for (const f of this.flashMaterials) {
      // Materiais com glow já tiveram a intensidade do pulso escrita neste quadro.
      const base = glow.has(f.material) ? f.material.emissiveIntensity : f.intensity;
      f.material.emissive.copy(f.emissive).lerp(WHITE, k);
      f.material.emissiveIntensity = base + (0.75 - base) * k;
    }
  }

  update(dt: number, camera: THREE.Camera, isTarget: boolean, time: number, player?: Entity): void {
    const e = this.entity;
    this.syncEquipment();
    this.updateMarker(player, camera);
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
      if (this.carapaceMesh) this.carapaceMesh.visible = false;
      if (this.stunStars) this.stunStars.visible = false;
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
    // Os dois braços abrem durante o giro e voltam ao lado do corpo quando ele acaba.
    if (this.model.weaponArm) this.model.weaponArm.rotation.z = spinning ? Math.PI / 2 : 0;
    if (this.model.offArm) this.model.offArm.rotation.z = spinning ? -Math.PI / 2 : 0;

    // Glow de equipamento pulsa de leve.
    if (this.model.glowMaterials) {
      const pulse = 1 + Math.sin(time * 2.4) * 0.12;
      for (const g of this.model.glowMaterials) g.material.emissiveIntensity = g.baseIntensity * pulse;
    }
    this.applyFlash(dt);
    this.updateCarapace(time);

    // Caminhada: pernas e braços alternam como um pêndulo; o corpo sobe no apoio de cada passo.
    const moving = e.movement.intent.x !== 0 || e.movement.intent.z !== 0;
    const { legs, offArm, weaponArm, head } = this.model;
    if (moving) {
      this.walkPhase += dt * e.movement.speed * 1.6;
      const s = Math.sin(this.walkPhase);
      root.position.y += Math.abs(s) * (legs ? 0.05 : 0.12);
      root.rotation.z = s * (legs ? 0.025 : 0.05);
      this.stride = s;
    } else {
      root.rotation.z = 0;
      // Respiração ociosa, e os membros voltam suavemente ao repouso.
      root.position.y += Math.sin(time * 2 + e.id) * 0.02;
      this.stride += (0 - this.stride) * clamp(dt * 10, 0, 1);
    }
    const stride = this.stride;
    if (legs) {
      legs[0]!.rotation.x = stride * 0.75;
      legs[1]!.rotation.x = -stride * 0.75;
    }
    if (offArm) offArm.rotation.x = -stride * 0.55;
    const rest = this.model.weaponArmRest ?? 0;
    if (weaponArm) weaponArm.rotation.x = rest + stride * 0.45;
    if (head) {
      head.rotation.x = Math.abs(stride) * 0.04;
      head.rotation.y = Math.sin(time * 0.7 + e.id) * 0.06; // olha em volta de leve
    }

    // Golpe: braço desce rapidamente e volta.
    if (weaponArm) {
      this.swingTime += dt;
      const d = 0.3;
      if (this.swingTime < d) {
        const k = Math.sin((this.swingTime / d) * Math.PI);
        weaponArm.rotation.x = k * 2.4;
        weaponArm.rotation.y = k * 0.3;
        root.rotation.x -= k * 0.12; // o tronco acompanha o golpe
      } else {
        weaponArm.rotation.y = 0;
      }
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

    // Escudo Arcano: esfera translúcida que gira.
    const shield = e.abilities?.shield;
    this.shieldMesh.visible = !!shield && shield.amount > 0;
    if (this.shieldMesh.visible) {
      this.shieldMesh.position.set(p.x, p.y + 1.1, p.z);
      this.shieldMesh.rotation.y = time * 0.8;
    }

    // Aviso de golpe: anel no alcance e preenchimento crescendo até o impacto; o corpo recua.
    const windingUp = e.combat.windupLeft > 0 && this.windupTotal > 0 && this.windupShape !== null;
    this.telegraph.visible = windingUp;
    if (windingUp) {
      const progress = 1 - e.combat.windupLeft / this.windupTotal;
      const shape = this.windupShape!;
      const at = shape.kind === "circle" && shape.at ? shape.at : p;
      this.telegraph.position.set(at.x, at.y + 0.06, at.z);
      const circle = shape.kind === "circle";
      this.telegraphRing.visible = this.telegraphFill.visible = circle;
      this.telegraphLine.visible = this.telegraphLineFill.visible = shape.kind === "line";
      if (this.telegraphCone) this.telegraphCone.visible = this.telegraphConeFill!.visible = shape.kind === "cone";
      if (shape.kind === "cone") {
        this.ensureCone(shape.angle);
        // Plano local XY: +X local = +X do mundo, +Y local = -Z do mundo.
        const local = Math.atan2(-shape.direction.z, shape.direction.x);
        this.telegraphCone!.rotation.z = local;
        this.telegraphConeFill!.rotation.z = local;
        this.telegraphCone!.scale.setScalar(shape.length);
        this.telegraphConeFill!.scale.setScalar(Math.max(0.05, shape.length * progress));
        (this.telegraphConeFill!.material as THREE.MeshBasicMaterial).opacity = 0.18 + progress * 0.3;
      } else if (circle) {
        const r = shape.radius;
        this.telegraphRing.scale.setScalar(r);
        this.telegraphFill.scale.setScalar(Math.max(0.05, r * progress));
        (this.telegraphFill.material as THREE.MeshBasicMaterial).opacity = 0.18 + progress * 0.3;
      } else if (shape.kind === "line") {
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
      if (this.model.weaponArm) this.model.weaponArm.rotation.x = rest - (1.2 + rest) * progress; // arma erguida para trás
      if (this.model.offArm) this.model.offArm.rotation.x = 0.6 * progress; // o outro braço vai à frente
      if (this.model.head) this.model.head.rotation.x = -0.25 * progress; // encara o alvo
      if (!this.model.weaponArm) root.scale.y = 1 - progress * 0.25; // gosma se comprime
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.model.root, this.healthBar, this.targetRing, this.telegraph, this.shieldMesh);
    if (this.carapaceMesh) scene.remove(this.carapaceMesh);
    if (this.stunStars) scene.remove(this.stunStars);
    if (this.marker) scene.remove(this.marker);
  }
}

const markerCache = new Map<string, THREE.Texture>();

function makeMarker(text: string, color: string): THREE.Sprite {
  let texture = markerCache.get(text + color);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(text, 32, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 32, 34);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    markerCache.set(text + color, texture);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(0.7, 0.7, 1);
  sprite.renderOrder = 15;
  return sprite;
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

  update(dt: number, camera: THREE.Camera, targetId: EntityId | undefined, time: number, player?: Entity): void {
    for (const v of this.views.values()) v.update(dt, camera, v.entity.id === targetId, time, player);
  }
}
