import * as THREE from "three";
import { isAlive, type Entity } from "./domain/components";
import { distanceXZ, normalizeXZ } from "./domain/math";
import { stepWorld } from "./domain/simulation";
import { generateWorld } from "./domain/worldgen";
import { ThirdPersonCamera } from "./game/camera";
import { EntityViews } from "./game/entityViews";
import { createEnvironment } from "./game/environment";
import { FloatingTexts } from "./game/effects";
import { Hud } from "./game/hud";
import { Input } from "./game/input";
import { PauseMenu } from "./game/menu";
import { createTerrainMesh } from "./game/terrainMesh";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9ec9e8");
scene.fog = new THREE.Fog("#9ec9e8", 60, 170);

const hemi = new THREE.HemisphereLight("#cfe8ff", "#5a7a3a", 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff4d6", 2.2);
sun.position.set(40, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 220;
const shadowSize = 45;
sun.shadow.camera.left = -shadowSize;
sun.shadow.camera.right = shadowSize;
sun.shadow.camera.top = shadowSize;
sun.shadow.camera.bottom = -shadowSize;
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

scene.add(createTerrainMesh());
scene.add(createEnvironment());

const world = generateWorld();
const player = world.player!;
const views = new EntityViews(scene);
views.sync(world);

const input = new Input(canvas);
const cam = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
const hud = new Hud();
const floats = new FloatingTexts(scene);
const menu = new PauseMenu();
let started = false;
let paused = false;

input.onFirstInteraction = () => {
  hud.hideIntro();
  started = true;
};
// ESC solta o pointer lock: pausa e abre o menu. Voltar ao jogo recaptura o mouse.
input.onPointerLockChange = (locked) => {
  if (!started) return;
  paused = !locked;
  if (locked) menu.close();
  else menu.open();
};
menu.onResume = () => input.requestLock();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cam.camera.aspect = window.innerWidth / window.innerHeight;
  cam.camera.updateProjectionMatrix();
});

/** Inimigo vivo mais próximo em alcance de ataque (mesma regra do domínio), ou mais próximo até 8m para o HUD. */
function currentTarget(): Entity | undefined {
  let best: Entity | undefined;
  let bestDist = 8;
  for (const e of world.alive()) {
    if (e.kind !== "enemy") continue;
    const d = distanceXZ(player.transform.position, e.transform.position);
    if (d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

function handleEvents(events: ReturnType<typeof stepWorld>): void {
  for (const ev of events) {
    switch (ev.type) {
      case "attack":
        views.get(ev.source)?.triggerSwing();
        break;
      case "damage": {
        const target = world.get(ev.target);
        const source = world.get(ev.source);
        if (!target || !source) break;
        const toPlayer = ev.target === player.id;
        floats.spawn(target.transform.position, `${ev.amount}`, toPlayer ? "#ff7b7b" : "#ffd37a", toPlayer ? 1 : 0.9);
        hud.pushLog(toPlayer ? `${source.name} te acertou por ${ev.amount}` : `Você acertou ${target.name} por ${ev.amount}`, toPlayer ? "dmg-in" : "dmg-out");
        break;
      }
      case "death": {
        const victim = world.get(ev.entity);
        if (!victim) break;
        if (ev.entity === player.id) {
          hud.pushLog("Você caiu em combate…", "dmg-in");
        } else {
          hud.addKill();
          hud.pushLog(`${victim.name} derrotado!`, "gain");
        }
        break;
      }
      case "xp":
        floats.spawn(player.transform.position, `+${ev.amount} XP`, "#8fc2ff", 0.8);
        break;
      case "loot":
        hud.pushLog(`+${ev.gold} ouro`, "gain");
        break;
      case "levelUp":
        floats.spawn(player.transform.position, `NÍVEL ${ev.level}!`, "#ffe57a", 1.4);
        hud.pushLog(`Você alcançou o nível ${ev.level}!`, "level");
        break;
      case "respawn":
        if (ev.entity === player.id) hud.pushLog("Você renasceu no santuário.", "level");
        break;
    }
  }
}

const timer = new THREE.Timer();
const FIXED_DT = 1 / 60;
let accumulator = 0;

function frame(): void {
  requestAnimationFrame(frame);
  timer.update();
  const frameDt = Math.min(timer.getDelta(), 0.1);

  // Input → intenções no domínio.
  const { lookX, lookY, zoom, attack } = input.flush();
  if (paused) {
    renderer.render(scene, cam.camera);
    return;
  }
  cam.applyLook(lookX * menu.sensitivity, lookY * menu.sensitivity, zoom);
  if (isAlive(player)) {
    const axes = input.moveAxes();
    player.movement.intent = normalizeXZ(cam.worldDirection(axes));
    // O corpo encara para onde a câmera olha: S anda de ré, A/D andam de lado.
    player.movement.faceYaw = cam.facingYaw;
    const backpedaling = axes.z > 0;
    player.movement.speed = (input.running ? 10.5 : 7) * (backpedaling ? 0.65 : 1);
    if (attack) player.combat.wantsAttack = true;
  } else {
    player.movement.intent = { x: 0, z: 0 };
  }

  // Simulação em passo fixo para o combate ser previsível.
  accumulator += frameDt;
  while (accumulator >= FIXED_DT) {
    handleEvents(stepWorld(world, FIXED_DT));
    accumulator -= FIXED_DT;
  }

  // Apresentação.
  const target = currentTarget();
  const p = player.transform.position;
  cam.update(new THREE.Vector3(p.x, p.y, p.z), frameDt);
  sun.position.set(p.x + 40, p.y + 70, p.z + 30);
  sun.target.position.set(p.x, p.y, p.z);
  views.update(frameDt, cam.camera, target?.id, world.time);
  floats.update(frameDt);
  hud.update(player, target);
  renderer.render(scene, cam.camera);
}

// Gancho de depuração só em desenvolvimento (testes automatizados e console).
if (import.meta.env.DEV) {
  (window as unknown as { __game: unknown }).__game = {
    world,
    player,
    cam,
    openMenu: () => {
      started = true;
      paused = true;
      menu.open();
    },
  };
}

frame();
