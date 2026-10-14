import * as THREE from "three";
import { clockAt, daylight, sunElevation, twilight } from "../domain/dayCycle";
import { biomeAt } from "../domain/biomes";
import { isWater, terrainHeight } from "../domain/terrain";
import { clamp } from "../domain/math";

/**
 * Céu e luz que seguem o relógio do domínio. Uma única luz direcional faz o papel do sol de dia e
 * da lua à noite (troca de lado quando o sol cruza o horizonte, momento em que a intensidade é zero,
 * então a troca não aparece). Estrelas, disco do sol e da lua acompanham a câmera, como se
 * estivessem infinitamente longe.
 */
const SKY_DAY = new THREE.Color("#8fc5ee");
const SKY_NIGHT = new THREE.Color("#0f1a33");
const SKY_TWILIGHT = new THREE.Color("#f09a6c");
const HEMI_SKY_DAY = new THREE.Color("#cfe8ff");
const HEMI_SKY_NIGHT = new THREE.Color("#5a6fa8");
const HEMI_GROUND_DAY = new THREE.Color("#5a7a3a");
const HEMI_GROUND_NIGHT = new THREE.Color("#1d2638");
const SUN_NOON = new THREE.Color("#fff4d6");
const SUN_LOW = new THREE.Color("#ffad6b");
const MOON = new THREE.Color("#a9bcff");

/**
 * Direção do sol: um círculo que nasce a leste (+X) às 6h, passa pelo alto ao meio-dia (inclinado
 * para o sul, +Z) e se põe a oeste às 18h. A lua é o ponto oposto do círculo.
 */
function sunDirection(hour: number, out: THREE.Vector3): THREE.Vector3 {
  const theta = ((hour - 6) / 24) * Math.PI * 2;
  return out.set(Math.cos(theta), Math.sin(theta), 0.45).normalize();
}

export class DayNightSky {
  readonly hemi = new THREE.HemisphereLight("#cfe8ff", "#5a7a3a", 0.9);
  readonly sun = new THREE.DirectionalLight("#fff4d6", 2.2);
  private readonly stars: THREE.Points;
  private readonly sunDisc: THREE.Mesh;
  private readonly moonDisc: THREE.Mesh;
  private readonly fireflies: Fireflies;
  private readonly lightDir = new THREE.Vector3();
  private readonly sunDir = new THREE.Vector3();
  private readonly moonDir = new THREE.Vector3();
  private readonly sky = new THREE.Color();
  /** 0 de dia, 1 à noite; outros sistemas (vaga-lumes, braseiros) usam. */
  night = 0;

  constructor(private readonly scene: THREE.Scene) {
    scene.background = new THREE.Color("#8fc5ee");
    scene.fog = new THREE.Fog("#8fc5ee", 70, 180);
    scene.add(this.hemi);
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    const size = 45;
    sun.shadow.camera.left = -size;
    sun.shadow.camera.right = size;
    sun.shadow.camera.top = size;
    sun.shadow.camera.bottom = -size;
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    // Estrelas: pontos numa casca esférica, só no hemisfério de cima.
    const rand = mulberry(77);
    const pts: number[] = [];
    const cols: number[] = [];
    for (let i = 0; i < 900; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(theta) * r * 300, y * 300, Math.sin(theta) * r * 300);
      const b = 0.6 + rand() * 0.9;
      const warm = rand();
      cols.push(b * (warm > 0.8 ? 1.1 : 0.9), b * 0.95, b * (warm < 0.2 ? 1.2 : 1));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    starGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.renderOrder = -10;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Sol e lua: discos quadrados (voxel!) virados para a câmera; o sol passa do limiar do bloom.
    const disc = (color: THREE.Color, size: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, depthWrite: false }));
      m.renderOrder = -9;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.sunDisc = disc(new THREE.Color("#fff1c4").multiplyScalar(2.2), 22);
    this.moonDisc = disc(new THREE.Color("#e8eeff").multiplyScalar(1.15), 14);
    this.fireflies = new Fireflies(scene);
  }

  /** Dentro da cripta: escuro, neblina curta, só uma luz fria de cima; as tochas fazem o resto. */
  private updateIndoor(focus: THREE.Vector3): void {
    this.night = 1;
    this.sky.set("#08070c");
    (this.scene.background as THREE.Color).copy(this.sky);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.sky);
    fog.near = 14;
    fog.far = 46;
    this.hemi.color.set("#6a6a9a");
    this.hemi.groundColor.set("#1a1620");
    this.hemi.intensity = 0.55;
    this.sun.color.set("#8a90c8");
    this.sun.intensity = 0.45;
    this.lightDir.set(0.25, 1, 0.35).normalize();
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 80);
    this.sun.target.position.copy(focus);
    this.sunDisc.visible = this.moonDisc.visible = false;
    (this.stars.material as THREE.PointsMaterial).opacity = 0;
    this.fireflies.hide();
  }

  /** `time`: tempo do mundo (relógio); `camera`: para manter o céu centrado; `focus`: o herói. */
  update(time: number, camera: THREE.Camera, focus: THREE.Vector3, dt: number, indoor = false): void {
    if (indoor) return this.updateIndoor(focus);
    const { hour } = clockAt(time);
    const elev = sunElevation(hour);
    const day = daylight(hour);
    const dusk = twilight(hour);
    this.night = 1 - day;

    // Céu: noite → dia, com um tom alaranjado no horizonte do crepúsculo.
    this.sky.copy(SKY_NIGHT).lerp(SKY_DAY, day).lerp(SKY_TWILIGHT, dusk * 0.55);
    (this.scene.background as THREE.Color).copy(this.sky);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.sky);
    fog.near = 60 + day * 10;
    fog.far = 150 + day * 30;

    this.hemi.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, day).lerp(SKY_TWILIGHT, dusk * 0.3);
    this.hemi.groundColor.copy(HEMI_GROUND_NIGHT).lerp(HEMI_GROUND_DAY, day);
    this.hemi.intensity = 0.55 + 0.35 * day;

    // Sol de dia, lua à noite: intensidade zero no horizonte para a troca de lado não aparecer.
    const sunDir = sunDirection(hour, this.sunDir);
    const moonDir = this.moonDir.set(-sunDir.x, -sunDir.y, sunDir.z);
    const sunUp = elev > 0;
    const strength = clamp(Math.abs(elev) / 0.25, 0, 1);
    this.lightDir.copy(sunUp ? sunDir : moonDir);
    this.lightDir.y = Math.max(this.lightDir.y, 0.12); // sombras nunca infinitas
    this.lightDir.normalize();
    if (sunUp) {
      this.sun.color.copy(SUN_LOW).lerp(SUN_NOON, clamp(elev / 0.5, 0, 1));
      this.sun.intensity = 2.2 * strength;
    } else {
      this.sun.color.copy(MOON);
      this.sun.intensity = 0.65 * strength;
    }
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 80);
    this.sun.target.position.copy(focus);

    // Astros no céu, presos à câmera.
    this.sunDisc.position.copy(camera.position).addScaledVector(sunDir, 250);
    this.sunDisc.lookAt(camera.position);
    this.sunDisc.visible = elev > -0.08;
    this.moonDisc.position.copy(camera.position).addScaledVector(moonDir, 250);
    this.moonDisc.lookAt(camera.position);
    this.moonDisc.visible = elev < 0.08;
    this.stars.position.copy(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = clamp((this.night - 0.35) / 0.5, 0, 1);

    this.fireflies.update(dt, time, focus, this.night);
  }
}

/** Vaga-lumes: pontinhos amarelo-esverdeados que piscam em volta do herói à noite, fora do deserto. */
class Fireflies {
  private readonly points: THREE.Points;
  private readonly count = 90;
  private readonly base: Float32Array;
  private readonly phase: Float32Array;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly rand = mulberry(31);

  constructor(scene: THREE.Scene) {
    this.base = new Float32Array(this.count * 3);
    this.phase = new Float32Array(this.count);
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      this.base[i * 3 + 1] = -999; // ainda sem lugar
      this.phase[i] = this.rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  hide(): void {
    this.points.visible = false;
  }

  update(dt: number, time: number, focus: THREE.Vector3, night: number): void {
    const visible = night > 0.35;
    this.points.visible = visible;
    if (!visible) return;
    const strength = clamp((night - 0.35) / 0.4, 0, 1);
    for (let i = 0; i < this.count; i++) {
      const bx = this.base[i * 3]!, by = this.base[i * 3 + 1]!, bz = this.base[i * 3 + 2]!;
      // Longe do herói (ou sem lugar ainda): renasce num ponto aleatório perto dele.
      if (by < -100 || Math.hypot(bx - focus.x, bz - focus.z) > 26) {
        const a = this.rand() * Math.PI * 2;
        const r = 4 + this.rand() * 20;
        const x = focus.x + Math.cos(a) * r, z = focus.z + Math.sin(a) * r;
        const ok = biomeAt(x, z) !== "desert" && !isWater(x, z);
        this.base[i * 3] = x;
        this.base[i * 3 + 1] = ok ? terrainHeight(x, z) + 0.5 + this.rand() * 1.8 : -999;
        this.base[i * 3 + 2] = z;
        continue;
      }
      const p = this.phase[i]!;
      const t = time * 0.6 + p;
      this.positions[i * 3] = bx + Math.sin(t * 0.9) * 0.8;
      this.positions[i * 3 + 1] = by + Math.sin(t * 1.3 + p) * 0.35;
      this.positions[i * 3 + 2] = bz + Math.cos(t * 0.7) * 0.8;
      const blink = Math.max(0, Math.sin(time * 2.2 + p * 3.1)) ** 3 * strength * 2.4;
      this.colors[i * 3] = 0.85 * blink;
      this.colors[i * 3 + 1] = 1.0 * blink;
      this.colors[i * 3 + 2] = 0.35 * blink;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
    void dt;
  }
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
