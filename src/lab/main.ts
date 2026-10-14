import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { World } from "../domain/world";
import type { Entity } from "../domain/components";
import { CHARGE, ROLL } from "../domain/skills";
import { EntityViews } from "../game/entityViews";
import { VoxelBuilder, voxelMaterial } from "../game/voxel";
import { createModel as createLegacyModel } from "./legacyModels";
import { buildCatalog, type Exhibit, type LodLevel } from "./catalog";
import { builderToVox, parseVox, voxToBuilder } from "../game/vox";
import { loadVoxOverrides, SCENERY_VOXEL } from "../game/props/catalog";

/* ---------- Renderer e cena ---------- */

const canvas = document.getElementById("lab") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false; // soma os passes do composer; zeramos por quadro

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(4, 3, 6);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotateSpeed = 1.2;

const hemi = new THREE.HemisphereLight("#cfe8ff", "#5a7a3a", 0.9);
const sun = new THREE.DirectionalLight("#fff4d6", 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
for (const k of ["left", "right", "top", "bottom"] as const) sun.shadow.camera[k] = (k === "left" || k === "bottom" ? -1 : 1) * 12;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
const fill = new THREE.PointLight("#ffffff", 0, 30);
scene.add(hemi, sun, sun.target, fill);

// Pedestal de pedra em voxels e uma grade discreta.
const pedestal = new THREE.Mesh(
  new VoxelBuilder().disc(0, -2, 0, 14, "#8d8a82").disc(0, -1, 0, 13, "#9d9a92").build(1 / 4, { jitter: 0, ao: false }),
  voxelMaterial(),
);
pedestal.receiveShadow = true;
const grid = new THREE.GridHelper(40, 40, 0x334, 0x223);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.01;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#6f8f4a", roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(pedestal, grid, ground);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.35, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize(): void {
  const w = canvas.clientWidth || window.innerWidth - 270;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

/* ---------- Presets de luz ---------- */

interface LightPreset {
  label: string;
  sky: string;
  fog: [string, number, number];
  hemi: [string, string, number];
  sun: [string, number, [number, number, number]];
  ground: string;
  fill?: [string, number];
}

const PRESETS: Record<string, LightPreset> = {
  meadow: { label: "Campina (dia)", sky: "#8fc5ee", fog: ["#8fc5ee", 30, 90], hemi: ["#cfe8ff", "#5a7a3a", 0.9], sun: ["#fff4d6", 2.2, [8, 14, 6]], ground: "#6f8f4a" },
  swamp: { label: "Pântano", sky: "#4a5e4a", fog: ["#4a5e4a", 10, 40], hemi: ["#8fa88f", "#2a3a22", 0.7], sun: ["#cfe0b0", 1.2, [-6, 10, 4]], ground: "#3f5a36", fill: ["#8fff9a", 6] },
  desert: { label: "Deserto", sky: "#f2d9a0", fog: ["#f2d9a0", 30, 100], hemi: ["#fff0c0", "#b08a4a", 1.0], sun: ["#fff7e0", 3.0, [6, 16, -4]], ground: "#d9b86a" },
  night: { label: "Noite", sky: "#0d1326", fog: ["#0d1326", 12, 50], hemi: ["#3a4a7a", "#101520", 0.5], sun: ["#9fb4ff", 0.6, [-8, 12, 6]], ground: "#2a3a2a", fill: ["#ffb060", 14] },
  studio: { label: "Estúdio (neutro)", sky: "#2a2d36", fog: ["#2a2d36", 40, 120], hemi: ["#ffffff", "#444444", 0.8], sun: ["#ffffff", 2.0, [6, 12, 8]], ground: "#55585f", fill: ["#ffffff", 4] },
};

function applyPreset(key: string): void {
  const p = PRESETS[key] ?? PRESETS.meadow!;
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog[0], p.fog[1], p.fog[2]);
  hemi.color.set(p.hemi[0]);
  hemi.groundColor.set(p.hemi[1]);
  hemi.intensity = p.hemi[2];
  sun.color.set(p.sun[0]);
  sun.intensity = p.sun[1];
  sun.position.set(...p.sun[2]);
  (ground.material as THREE.MeshStandardMaterial).color.set(p.ground);
  fill.intensity = p.fill ? p.fill[1] : 0;
  if (p.fill) fill.color.set(p.fill[0]);
  fill.position.set(2, 2.5, 2);
}

/* ---------- Animações ---------- */

type Anim = "idle" | "walk" | "attack" | "windup" | "roll" | "charge" | "spin" | "shield" | "death";
const ANIMS: Record<Anim, string> = {
  idle: "Parado",
  walk: "Andando",
  attack: "Atacando",
  windup: "Aviso de golpe",
  roll: "Esquiva (rolamento)",
  charge: "Investida",
  spin: "Golpe Giratório",
  shield: "Escudo Arcano",
  death: "Morte",
};

/* ---------- Estado ---------- */

// Os .vox de assets/vox também valem no lab, para ver o desenho antes de entrar no jogo.
await loadVoxOverrides();
const catalog = buildCatalog();
const state = {
  current: null as Exhibit | null,
  anim: "idle" as Anim,
  compare: false,
  time: 0,
  lastCycle: -1,
  world: null as World | null,
  entity: null as Entity | null,
  views: null as EntityViews | null,
  object: null as THREE.Object3D | null,
  objectUpdate: null as ((t: number) => void) | null,
  legacy: null as THREE.Object3D | null,
  lod: "hi" as LodLevel,
};

const presetSelect = document.getElementById("preset") as HTMLSelectElement;
const animSelect = document.getElementById("anim") as HTMLSelectElement;
const turntable = document.getElementById("turntable") as HTMLInputElement;
const compareBox = document.getElementById("compare") as HTMLInputElement;
const gridBox = document.getElementById("grid") as HTMLInputElement;
const lodSelect = document.getElementById("lod") as HTMLSelectElement;
const exportButton = document.getElementById("export") as HTMLButtonElement;
const stats = document.getElementById("stats")!;
const nav = document.getElementById("catalog")!;

for (const [key, p] of Object.entries(PRESETS)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = p.label;
  presetSelect.appendChild(o);
}
for (const [key, label] of Object.entries(ANIMS)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = label;
  animSelect.appendChild(o);
}

function clearExhibit(): void {
  if (state.views) {
    for (const e of state.world!.entities.values()) state.views.get(e.id)?.dispose(scene);
  }
  if (state.object) scene.remove(state.object);
  if (state.legacy) scene.remove(state.legacy);
  state.world = state.views = state.entity = state.object = state.objectUpdate = state.legacy = null;
}

function show(id: string): void {
  const ex = catalog.find((e) => e.id === id) ?? catalog[0]!;
  clearExhibit();
  state.current = ex;
  state.lastCycle = -1;
  const comparable = ex.kind === "character" || !!ex.legacy;
  const offset = state.compare && comparable ? ex.size * 0.55 : 0;
  if (ex.kind === "character") {
    const world = new World();
    const entity = world.spawn((eid) => ex.spawn(eid));
    entity.transform.position.x = offset;
    entity.transform.yaw = 0;
    const views = new EntityViews(scene);
    views.sync(world);
    state.world = world;
    state.entity = entity;
    state.views = views;
    if (state.compare) {
      const legacy = createLegacyModel(entity.archetype, entity.equipment, entity.classId);
      legacy.root.position.x = -offset;
      scene.add(legacy.root);
      state.legacy = legacy.root;
    }
  } else {
    const built = ex.build({ lod: ex.lods ? state.lod : "hi" });
    built.object.position.x = offset;
    scene.add(built.object);
    state.object = built.object;
    state.objectUpdate = built.update ?? null;
    if (state.compare && ex.legacy) {
      const legacy = ex.legacy();
      legacy.position.x = -offset;
      scene.add(legacy);
      state.legacy = legacy;
    }
  }
  // Enquadra: alvo na metade da altura, distância proporcional ao tamanho.
  const focusY = ex.size * 0.42;
  controls.target.set(0, focusY, 0);
  const dist = ex.size * 2.3 + (state.compare ? ex.size * 0.8 : 0);
  camera.position.set(dist * 0.55, focusY + dist * 0.35, -dist * 0.8); // o modelo olha para -Z
  controls.update();

  document.getElementById("info-title")!.textContent = ex.label;
  document.getElementById("info-desc")!.textContent = ex.description;
  for (const b of nav.querySelectorAll("button")) b.classList.toggle("active", b.dataset.id === ex.id);
  const animOpts = ex.kind === "character";
  animSelect.disabled = !animOpts;
  compareBox.disabled = !comparable;
  lodSelect.disabled = !(ex.kind === "object" && ex.lods);
  exportButton.disabled = !(ex.kind === "object" && ex.voxels);
  const url = new URL(window.location.href);
  url.searchParams.set("e", ex.id);
  history.replaceState(null, "", url);
}

/** Aplica o estado de animação na entidade, como o jogo faria tick a tick. */
function animate(dt: number): void {
  const e = state.entity;
  const view = e ? state.views?.get(e.id) : undefined;
  if (!e || !view) return;
  const t = state.time;
  const anim = state.anim;
  const cycle = Math.floor(t / 1.6);
  const newCycle = cycle !== state.lastCycle;
  state.lastCycle = cycle;
  const phase = t % 1.6;

  e.movement.intent = anim === "walk" ? { x: 0, z: -1 } : { x: 0, z: 0 };
  e.health.current = anim === "death" && phase < 1.3 ? 0 : e.health.max;
  e.combat.windupLeft = 0;
  if (e.abilities) {
    e.abilities.dash = null;
    e.abilities.shield = anim === "shield" ? { amount: 10, timeLeft: 5 } : null;
  }

  if (anim === "attack" && newCycle) view.triggerSwing();
  if (anim === "spin" && newCycle) view.triggerSpin();
  if (anim === "windup") {
    const total = e.combat.windupTime > 0 ? e.combat.windupTime : 0.8;
    const pattern = e.boss?.patterns[0];
    if (newCycle) {
      const shape = pattern?.kind === "charge"
        ? { kind: "line" as const, length: pattern.range, width: 2.4, direction: { x: 0, z: -1 } }
        : { kind: "circle" as const, radius: pattern?.range ?? Math.max(e.combat.range, 1.8) };
      view.triggerWindup(total, shape);
    }
    e.combat.windupLeft = Math.max(0, total - phase);
  }
  if ((anim === "roll" || anim === "charge") && e.abilities) {
    const spec = anim === "roll" ? ROLL : CHARGE;
    if (phase < spec.duration) {
      e.abilities.dash = {
        kind: anim,
        timeLeft: spec.duration - phase,
        duration: spec.duration,
        direction: { x: 0, z: -1 },
        speed: 0,
        invulnerable: anim === "roll",
        damageMultiplier: 1,
        hitEntityIds: [],
      };
    }
  }
  state.views!.update(dt, camera, undefined, t);
  if (state.legacy) state.legacy.rotation.y = 0;
}

let last = performance.now();
let frames = 0;
let fpsAt = last;
let fps = 0;

function step(dt: number): void {
  state.time += dt;
  animate(dt);
  state.objectUpdate?.(state.time);
  controls.autoRotate = turntable.checked;
  controls.update();
  renderer.info.reset();
  composer.render();
}

function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  frames++;
  if (now - fpsAt > 500) {
    fps = Math.round((frames * 1000) / (now - fpsAt));
    frames = 0;
    fpsAt = now;
    stats.textContent = `${renderer.info.render.triangles.toLocaleString("pt-BR")} triângulos · ${fps} fps`;
  }
  requestAnimationFrame(loop);
}

/* ---------- UI ---------- */

function renderNav(): void {
  nav.replaceChildren();
  const groups = [...new Set(catalog.map((e) => e.group))];
  for (const g of groups) {
    const h = document.createElement("h3");
    h.textContent = g;
    nav.appendChild(h);
    for (const ex of catalog.filter((e) => e.group === g)) {
      const b = document.createElement("button");
      b.textContent = ex.label;
      b.dataset.id = ex.id;
      b.classList.toggle("active", ex.id === state.current?.id);
      b.addEventListener("click", () => show(ex.id));
      nav.appendChild(b);
    }
  }
}
renderNav();
presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));
animSelect.addEventListener("change", () => {
  state.anim = animSelect.value as Anim;
  state.lastCycle = -1;
});
compareBox.addEventListener("change", () => {
  state.compare = compareBox.checked;
  if (state.current) show(state.current.id);
});
lodSelect.addEventListener("change", () => {
  state.lod = lodSelect.value as LodLevel;
  if (state.current) show(state.current.id);
});
exportButton.addEventListener("click", () => {
  const ex = state.current;
  if (ex?.kind !== "object" || !ex.voxels) return;
  const bytes = builderToVox(ex.voxels());
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  a.download = `${ex.id.replace(/^prop\./, "")}.vox`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/** Mostra um .vox solto na vitrine, na escala do cenário (1 voxel = 1/12 m). */
function showVoxFile(buffer: ArrayBuffer, name: string): string {
  const voxels = voxToBuilder(parseVox(buffer));
  const geometry = voxels.build(SCENERY_VOXEL, { jitter: 0, aoStrength: 0.55 });
  const id = `vox.${name}`;
  const existing = catalog.findIndex((e) => e.id === id);
  if (existing >= 0) catalog.splice(existing, 1);
  catalog.push({
    kind: "object",
    id,
    group: "Arquivos .vox",
    label: name,
    description: `Arquivo solto no lab: ${voxels.size.toLocaleString("pt-BR")} voxels, em 1/12 m por voxel. Para usar no jogo, salve com o id de um modelo em assets/vox/.`,
    size: geometry.boundingSphere!.radius * 1.05,
    voxels: () => voxels,
    voxel: SCENERY_VOXEL,
    build: () => {
      const m = new THREE.Mesh(geometry, voxelMaterial());
      m.castShadow = m.receiveShadow = true;
      return { object: m };
    },
  });
  renderNav();
  show(id);
  return id;
}
canvas.addEventListener("dragover", (e) => e.preventDefault());
canvas.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  try {
    showVoxFile(await file.arrayBuffer(), file.name.replace(/\.vox$/i, ""));
  } catch (err) {
    document.getElementById("info-desc")!.textContent = `Não consegui ler ${file.name}: ${(err as Error).message}`;
  }
});

gridBox.addEventListener("change", () => {
  grid.visible = pedestal.visible = gridBox.checked;
});

const params = new URLSearchParams(window.location.search);
presetSelect.value = params.get("preset") ?? "meadow";
applyPreset(presetSelect.value);
if (params.get("anim")) {
  animSelect.value = params.get("anim")!;
  state.anim = animSelect.value as Anim;
}
if (params.get("compare") === "1") compareBox.checked = state.compare = true;
if (params.get("turn") === "0") turntable.checked = false;
if (params.get("lod")) lodSelect.value = state.lod = params.get("lod") as LodLevel;
resize();
show(params.get("e") ?? catalog[0]!.id);
requestAnimationFrame(loop);

/** Gancho para verificação headless. */
(window as unknown as { __lab: unknown }).__lab = {
  ids: catalog.map((e) => e.id),
  show,
  setAnim: (a: Anim) => {
    state.anim = a;
    animSelect.value = a;
    state.lastCycle = -1;
  },
  setPreset: applyPreset,
  setCompare: (on: boolean) => {
    compareBox.checked = state.compare = on;
    if (state.current) show(state.current.id);
  },
  setLod: (lod: LodLevel) => {
    lodSelect.value = state.lod = lod;
    if (state.current) show(state.current.id);
  },
  /** Exporta o modelo atual como .vox e devolve os bytes (sem baixar). */
  exportVox: () => {
    const ex = state.current;
    return ex?.kind === "object" && ex.voxels ? Array.from(builderToVox(ex.voxels())) : null;
  },
  loadVox: (bytes: number[], name: string) => showVoxFile(new Uint8Array(bytes).buffer, name),
  setTurntable: (on: boolean) => {
    turntable.checked = on;
  },
  /** Avança o relógio da vitrine sem depender do requestAnimationFrame. */
  step: (dt: number, n = 1) => {
    for (let i = 0; i < n; i++) step(dt);
  },
  orbit: (azimuth: number, polar: number, distanceScale = 1) => {
    const ex = state.current;
    if (!ex) return;
    const dist = (ex.size * 2.3 + (state.compare ? ex.size * 0.8 : 0)) * distanceScale;
    const y = ex.size * 0.42;
    camera.position.set(Math.sin(azimuth) * Math.sin(polar) * dist, y + Math.cos(polar) * dist, -Math.cos(azimuth) * Math.sin(polar) * dist);
    controls.target.set(0, y, 0);
    controls.update();
  },
  renderer,
  scene,
};
