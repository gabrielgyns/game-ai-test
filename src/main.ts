import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { isAlive, type Entity } from "./domain/components";
import { distanceXZ, normalizeXZ } from "./domain/math";
import { stepWorld } from "./domain/simulation";
import { DEFAULT_SEED, generateWorld } from "./domain/worldgen";
import { restoreGame, serializeGame, type SaveData } from "./domain/save";
import { formatPlayTime, summarize } from "./domain/saveSlots";
import { exportSave, importSave, readNewGameIntent, saveSlots, writeNewGameIntent } from "./game/storage";
import { SlotsUI } from "./game/slotsUI";
import { GameAudio } from "./game/audio";
import { ThirdPersonCamera } from "./game/camera";
import { EntityViews } from "./game/entityViews";
import { createEnvironment } from "./game/environment";
import { FloatingTexts } from "./game/effects";
import { Hud } from "./game/hud";
import { Input } from "./game/input";
import { PauseMenu } from "./game/menu";
import { InventoryUI } from "./game/inventoryUI";
import { DropViews } from "./game/dropViews";
import { SkillBar } from "./game/skillBar";
import { DialogueUI } from "./game/dialogueUI";
import { QuestTracker } from "./game/questTracker";
import { TALK_RANGE } from "./domain/npc";
import { questById } from "./domain/quests";
import { SKILLS, type SkillId } from "./domain/skills";
import { CLASSES } from "./domain/classes";
import { ProjectileViews } from "./game/projectileViews";
import { directionFromYaw } from "./domain/math";
import { useFirstPotion } from "./domain/inventory";
import { createTerrainMesh } from "./game/terrainMesh";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fc5ee");
scene.fog = new THREE.Fog("#8fc5ee", 70, 180);

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
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

scene.add(createTerrainMesh());
scene.add(createEnvironment());

// Saves em slots. Três jeitos de abrir a página:
// - pedido de novo jogo na sessão (escolhido na tela de saves): gera o mundo com a classe e o nome;
// - slot ativo com save: carrega e espera um clique para continuar;
// - nada: mostra a tela de saves sobre um mundo de fundo, e nada começa até escolher.
// Trocar de slot recarrega a página, porque o mundo é criado uma vez só no boot.
const SEED = DEFAULT_SEED;
saveSlots.migrateLegacy();
const newGame = readNewGameIntent();
let activeSlot: number | null = newGame ? newGame.slot : saveSlots.activeSlot;
const existingSave: SaveData | null = !newGame && activeSlot !== null ? saveSlots.read(activeSlot) : null;
if (!newGame && !existingSave) activeSlot = null;
const world = existingSave ? restoreGame(existingSave) : generateWorld({ seed: SEED, classId: newGame?.classId ?? "warrior" });
const player = world.player!;
if (newGame) player.name = newGame.heroName;

/** "Lia, Arqueira nível 3 · 120 ouro · 2 quests · 14min de jogo". */
function describeSlotSave(save: SaveData): string {
  const s = summarize(0, save);
  if (s.empty) return "";
  return `${s.heroName}, ${s.className} nível ${s.level} · ${s.gold} ouro · ${s.questsDone} quest${s.questsDone === 1 ? "" : "s"} · ${formatPlayTime(s.playTime)} de jogo`;
}
const views = new EntityViews(scene);
views.sync(world);

const input = new Input(canvas);
const cam = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
const hud = new Hud();
const floats = new FloatingTexts(scene);
const menu = new PauseMenu();
const audio = new GameAudio();
menu.setVolumes(audio.volumes.music, audio.volumes.sfx);
const slotsUI = new SlotsUI(saveSlots);
slotsUI.currentSlot = activeSlot;
const overlaySave = document.getElementById("overlay-save")!;
const overlayHint = document.getElementById("overlay-hint")!;
const overlaySlots = document.getElementById("overlay-slots")!;
if (newGame) {
  overlaySave.textContent = `Slot ${newGame.slot} · ${newGame.heroName}, ${CLASSES[newGame.classId].name}`;
  overlayHint.textContent = "Clique para começar a aventura";
} else if (existingSave && activeSlot !== null) {
  overlaySave.textContent = `Slot ${activeSlot} · ${describeSlotSave(existingSave)}`;
  overlayHint.textContent = "Clique para continuar";
}
if (newGame || existingSave) {
  overlaySave.classList.remove("hidden");
  overlayHint.classList.remove("hidden");
  overlaySlots.classList.remove("hidden");
} else {
  // Primeira visita (ou slot apagado): a tela de saves é a tela inicial.
  slotsUI.open(false);
  const first = saveSlots.firstEmpty();
  if (saveSlots.list().every((x) => x.empty) && first !== null) slotsUI.startCreating(first);
}
overlaySlots.addEventListener("click", (e) => {
  e.stopPropagation();
  slotsUI.open(true);
});
menu.onVolume = (music, sfx) => audio.setVolumes({ music, sfx });

/** Pan e distância de um ponto do mundo em relação ao herói e à câmera. */
function spatial(pos: { x: number; z: number }): { pan: number; distance: number } {
  const dx = pos.x - player.transform.position.x;
  const dz = pos.z - player.transform.position.z;
  const distance = Math.hypot(dx, dz);
  // Eixo "direita" da câmera no plano XZ.
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const pan = distance < 0.5 ? 0 : (dx * rx + dz * rz) / distance;
  return { pan, distance };
}
const inventoryUI = new InventoryUI(world, player);
const dropViews = new DropViews(scene);
const skillBar = new SkillBar(player.abilities!.skills.map((s) => s.id));
const projectileViews = new ProjectileViews(scene);
const SKILL_SFX: Record<SkillId, "whirlwind" | "charge" | "warcry" | "secondWind" | "roll" | "dodge" | "shoot" | "explode"> = {
  whirlwind: "whirlwind", charge: "charge", warcry: "warcry", secondWind: "secondWind",
  piercingShot: "shoot", arrowRain: "explode", disengage: "roll", focus: "warcry",
  fireball: "shoot", frostNova: "explode", blink: "dodge", arcaneShield: "secondWind",
};
const dialogue = new DialogueUI(world, player);
const questTracker = new QuestTracker();
const interactEl = document.getElementById("interact")!;
const interactText = document.getElementById("interact-text")!;

function nearestNpc(): Entity | undefined {
  let best: Entity | undefined;
  let bestDist = TALK_RANGE;
  for (const n of world.npcs()) {
    const d = distanceXZ(player.transform.position, n.transform.position);
    if (d < bestDist) {
      best = n;
      bestDist = d;
    }
  }
  return best;
}

function openDialogue(npc: Entity): void {
  dialogue.open(npc);
  paused = true;
  document.exitPointerLock();
}
function closeDialogue(): void {
  dialogue.close();
  paused = false;
  input.requestLock();
}
dialogue.onClose = closeDialogue;
dialogue.onAction = () => handleEvents(world.drainEvents());
let started = false;
let paused = false;

// Largar um item pela mochila o devolve ao chão, na frente do herói.
inventoryUI.onDiscard = (item) => {
  const p = player.transform.position;
  const yaw = player.transform.yaw;
  const drop = world.addDrop(item, { x: p.x - Math.sin(yaw) * 2.2, y: p.y, z: p.z - Math.cos(yaw) * 2.2 });
  drop.requireLeave = true; // não volta para a mochila ao fechar o painel
  hud.pushLog(`Você largou ${item.name}.`, "dmg-out");
};

function openInventory(): void {
  inventoryUI.open();
  paused = true;
  document.exitPointerLock();
}
function closeInventory(): void {
  inventoryUI.close();
  paused = false;
  input.requestLock();
}

input.onFirstInteraction = () => {
  hud.hideIntro();
  started = true;
  audio.unlock();
  if (newGame) {
    // O primeiro save ocupa o slot; daqui em diante este é o jogo "continuar".
    saveSlots.activeSlot = newGame.slot;
    writeNewGameIntent(null);
    saveGame("silent");
  }
};
canvas.addEventListener("mousedown", () => audio.unlock());
// ESC solta o pointer lock: pausa e abre o menu. Voltar ao jogo recaptura o mouse.
input.onPointerLockChange = (locked) => {
  if (!started) return;
  if (inventoryUI.isOpen) {
    // A mochila soltou o mouse de propósito; não é pausa.
    if (locked) closeInventory();
    return;
  }
  if (dialogue.isOpen) {
    if (locked) closeDialogue();
    return;
  }
  paused = !locked;
  if (locked) menu.close();
  else menu.open();
};
function resume(): void {
  menu.close();
  paused = false;
  // Chrome recusa recapturar o mouse por ~1s depois de um ESC; se falhar, o próximo clique captura.
  input.requestLock();
}
menu.onResume = resume;

const toastEl = document.getElementById("toast")!;
let toastTimer = 0;
function toast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  toastEl.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 1800);
}

let lastSaveAt = 0;
/** Ligado antes de recarregar para trocar de slot: o autosave de saída não pode escrever por cima. */
let suppressAutosave = false;
function saveGame(reason: string): void {
  if (suppressAutosave || !started || !isAlive(player) || activeSlot === null) return;
  const save = serializeGame(world, SEED);
  if (saveSlots.write(activeSlot, save)) {
    lastSaveAt = performance.now();
    menu.setSaveInfo(`Slot ${activeSlot} · salvo às ${new Date(save.savedAt).toLocaleTimeString("pt-BR", { timeStyle: "short" })}`);
    if (reason !== "silent") toast(reason === "auto" ? "Jogo salvo automaticamente" : "Jogo salvo");
  } else {
    toast("Não foi possível salvar (armazenamento cheio ou bloqueado)");
  }
}
menu.onSave = () => saveGame("manual");

/** Recarrega a página para abrir outro jogo; o atual é salvo antes, se estiver rodando. */
function reloadInto(prepare: () => void): void {
  saveGame("silent");
  suppressAutosave = true;
  prepare();
  window.location.reload();
}
function openSlots(): void {
  saveGame("silent"); // a lista mostra o progresso de agora
  slotsUI.currentSlot = activeSlot;
  menu.close();
  slotsUI.open(true);
}
menu.onSlots = openSlots;
slotsUI.onBack = () => {
  slotsUI.close();
  if (started) menu.open();
};
slotsUI.onPlay = (slot) => {
  if (slot === activeSlot && (started || existingSave)) {
    // Já é o jogo carregado: só volta para ele.
    slotsUI.close();
    if (started) resume();
    return;
  }
  reloadInto(() => {
    writeNewGameIntent(null);
    saveSlots.activeSlot = slot;
  });
};
slotsUI.onNew = (slot, classId, heroName) => {
  reloadInto(() => writeNewGameIntent({ slot, classId, heroName }));
};
slotsUI.onDelete = (slot) => {
  if (slot === activeSlot) {
    // Apagar o jogo em andamento: volta para a tela de saves sem ele.
    suppressAutosave = true;
    saveSlots.remove(slot);
    writeNewGameIntent(null);
    window.location.reload();
    return;
  }
  saveSlots.remove(slot);
  slotsUI.render();
};
slotsUI.onExport = (slot) => {
  if (slot === activeSlot) saveGame("silent");
  const save = saveSlots.read(slot);
  if (save) exportSave(save);
};
slotsUI.onImport = (slot) => {
  void importSave().then((save) => {
    if (!save) return toast("Arquivo de save inválido");
    if (!saveSlots.write(slot, save)) return toast("Não foi possível guardar o save importado");
    toast(`Save importado no slot ${slot}`);
    slotsUI.render();
  });
};
if (existingSave && activeSlot !== null) menu.setSaveInfo(`Slot ${activeSlot} · ${describeSlotSave(existingSave)}`);

// Autosave: a cada 45 s, ao esconder a aba e em marcos (quest concluída, nível).
const AUTOSAVE_MS = 45_000;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame("auto");
});
window.addEventListener("beforeunload", () => saveGame("auto"));
input.onEscape = () => {
  if (slotsUI.isOpen) {
    if (started || existingSave || newGame) slotsUI.onBack();
    return;
  }
  if (!started) return;
  if (inventoryUI.isOpen) closeInventory();
  else if (dialogue.isOpen) closeDialogue();
  else if (menu.isOpen) resume();
};

// Pós-processamento: bloom só no que passa de 1.0 de brilho (os itens de raridade têm emissivo
// acima disso); o resto da cena fica intocado. Força baixa para um neon leve.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.35, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
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
      case "attack": {
        views.get(ev.source)?.triggerSwing();
        const src = world.get(ev.source);
        if (src) {
          const ranged = src.classId && CLASSES[src.classId].attackStyle !== "melee";
          audio.play(ranged ? "shoot" : "swing", { ...spatial(src.transform.position), pitch: src.boss ? 0.6 : src.kind === "player" ? 1.1 : 0.85 });
        }
        break;
      }
      case "windup": {
        views.get(ev.source)?.triggerWindup(ev.duration, ev.shape);
        const src = world.get(ev.source);
        if (src) audio.play("windup", { ...spatial(src.transform.position), pitch: src.boss ? 0.6 : 1 });
        if (ev.patternName && src) floats.spawn(src.transform.position, ev.patternName, "#ff6b6b", 1.1);
        break;
      }
      case "bossEngage": {
        const boss = world.get(ev.entity);
        if (boss) hud.pushLog(`${boss.name} entrou em combate!`, "level");
        audio.play("bossRoar");
        audio.setBossMode(true);
        break;
      }
      case "bossPhase": {
        const boss = world.get(ev.entity);
        if (boss) {
          audio.play(ev.phase === 3 ? "bossRoar" : "bossPhase");
          floats.spawn(boss.transform.position, ev.phase === 3 ? "FÚRIA!" : `FASE ${ev.phase}`, "#ff9f43", 1.5);
          hud.pushLog(ev.phase === 3 ? `${boss.name} está furioso: mais dano e lacaios!` : `${boss.name} entrou na fase ${ev.phase}: golpes mais rápidos.`, "dmg-in");
        }
        break;
      }
      case "bossSummon":
        views.sync(world);
        hud.pushLog("Goblins foram convocados!", "dmg-in");
        break;
      case "questAccepted":
        audio.play("questAccept");
        hud.pushLog(`Quest aceita: ${questById(ev.questId)?.title ?? ev.questId}`, "level");
        break;
      case "questProgress": {
        const q = questById(ev.questId);
        if (q) hud.pushLog(`${q.objective.label}: ${ev.progress} / ${ev.count}`, "gain");
        break;
      }
      case "questReady": {
        const q = questById(ev.questId);
        if (q) {
          floats.spawn(player.transform.position, "OBJETIVO CONCLUÍDO", "#9ce39c", 1.1);
          hud.pushLog(`${q.title}: objetivo concluído! Volte ao santuário.`, "level");
        }
        break;
      }
      case "questCompleted": {
        const q = questById(ev.questId);
        hud.pushLog(`Quest concluída: ${q?.title ?? ev.questId} (+${ev.xp} XP, +${ev.gold} ouro${ev.itemNames.length ? ", " + ev.itemNames.join(", ") : ""})`, "level");
        floats.spawn(player.transform.position, "QUEST CONCLUÍDA!", "#ffe57a", 1.3);
        audio.play("questComplete");
        saveGame("auto");
        break;
      }
      case "damage": {
        const target = world.get(ev.target);
        const source = world.get(ev.source);
        if (!target || !source) break;
        const toPlayer = ev.target === player.id;
        audio.play(toPlayer ? "hurt" : "hit", { ...spatial(target.transform.position), pitch: target.boss ? 0.7 : 1 });
        floats.spawn(target.transform.position, `${ev.amount}`, toPlayer ? "#ff7b7b" : "#ffd37a", toPlayer ? 1 : 0.9);
        hud.pushLog(toPlayer ? `${source.name} te acertou por ${ev.amount}` : `Você acertou ${target.name} por ${ev.amount}`, toPlayer ? "dmg-in" : "dmg-out");
        break;
      }
      case "death": {
        const victim = world.get(ev.entity);
        if (!victim) break;
        if (ev.entity === player.id) {
          hud.pushLog("Você caiu em combate…", "dmg-in");
          audio.play("playerDeath");
        } else {
          hud.pushLog(`${victim.name} derrotado!`, "gain");
          const pitchByType: Record<string, number> = { slime: 1.3, goblin: 1, orc: 0.7, spider: 1.5, bogZombie: 0.6, scorpion: 1.2, bandit: 0.95 };
          audio.play("enemyDeath", { ...spatial(victim.transform.position), pitch: victim.boss ? 0.5 : (pitchByType[victim.archetype] ?? 1) });
          if (victim.boss) audio.setBossMode(false);
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
        audio.play("levelUp");
        floats.spawn(player.transform.position, `NÍVEL ${ev.level}!`, "#ffe57a", 1.4);
        hud.pushLog(`Você alcançou o nível ${ev.level}!`, "level");
        saveGame("auto");
        break;
      case "respawn":
        if (ev.entity === player.id) hud.pushLog("Você renasceu no santuário.", "level");
        break;
      case "pickup": {
        const item = player.inventory?.items.find((i) => i?.id === ev.itemId);
        if (item) {
          audio.play(item.rarity === "common" ? "pickupCommon" : "pickupRare", { pitch: item.rarity === "epic" ? 1.25 : item.rarity === "rare" ? 1.1 : 1 });
          hud.pushLog(`Você pegou ${item.name}`, `loot-${item.rarity}`);
          floats.spawn(player.transform.position, item.name, RARITY_FLOAT[item.rarity], item.rarity === "common" ? 0.7 : 0.9);
        }
        break;
      }
      case "inventoryFull":
        hud.pushLog("Mochila cheia!", "dmg-in");
        break;
      case "heal":
        audio.play("potion");
        floats.spawn(player.transform.position, `+${ev.amount}`, "#9ce39c", 0.9);
        hud.pushLog(`Você recuperou ${ev.amount} de vida.`, "gain");
        break;
      case "equip": {
        const item = player.equipment?.[ev.slot];
        if (item) hud.pushLog(`Equipado: ${item.name}`, `loot-${item.rarity}`);
        break;
      }
      case "skill": {
        const def = SKILLS[ev.skill];
        audio.play(SKILL_SFX[ev.skill]);
        if (ev.skill === "whirlwind") {
          views.get(ev.entity)?.triggerSpin();
          hud.pushLog(ev.hits > 0 ? `${def.name} acertou ${ev.hits} inimigo${ev.hits > 1 ? "s" : ""}!` : `${def.name} não acertou ninguém.`, ev.hits > 0 ? "dmg-out" : "gain");
        } else if (ev.skill === "warcry") {
          floats.spawn(player.transform.position, "GRITO DE GUERRA!", "#ff9f43", 1.1);
          hud.pushLog("+50% de dano por 8 s!", "level");
        } else if (ev.skill === "charge" || ev.skill === "piercingShot" || ev.skill === "fireball" || ev.skill === "arrowRain") {
          views.get(ev.entity)?.triggerSwing();
        } else if (ev.skill === "focus") {
          floats.spawn(player.transform.position, "FOCO!", "#9ce39c", 1.0);
          hud.pushLog("+40% de dano por 8 s!", "level");
        } else if (ev.skill === "frostNova") {
          projectileViews.burst(player.transform.position, 4, "#8fd3ff");
          hud.pushLog(ev.hits > 0 ? `${def.name} acertou ${ev.hits} inimigo${ev.hits > 1 ? "s" : ""}!` : `${def.name} não acertou ninguém.`, ev.hits > 0 ? "dmg-out" : "gain");
        } else if (ev.skill === "arcaneShield") {
          hud.pushLog("Escudo Arcano ativo.", "level");
        }
        break;
      }
      case "projectileHit":
        if (ev.explodeRadius > 0) {
          projectileViews.burst(ev.position, ev.explodeRadius, ev.projectileId === -1 ? "#9ce39c" : "#ff9a3c");
          audio.play("explode", spatial(ev.position));
        } else {
          projectileViews.burst(ev.position, 0.4, "#ffd37a");
        }
        break;
      case "shieldAbsorb":
        if (ev.entity === player.id) floats.spawn(player.transform.position, `(${ev.amount})`, "#8fb3ff", 0.8);
        break;
      case "shieldEnd":
        if (ev.entity === player.id) hud.pushLog("Escudo Arcano acabou.", "dmg-out");
        break;
      case "dodge":
        if (ev.entity === player.id) {
          audio.play("dodge");
          floats.spawn(player.transform.position, "Esquivou!", "#d0f0ff", 0.8);
        }
        break;
      case "roll":
        if (ev.entity === player.id) audio.play("roll");
        break;
      case "drop": {
        const d = world.drops.get(ev.dropId);
        if (d) audio.play("drop", spatial(d.position));
        break;
      }
      case "buffEnd":
        hud.pushLog("Grito de Guerra acabou.", "dmg-out");
        break;
    }
  }
}

const RARITY_FLOAT = { common: "#e8e8e8", uncommon: "#7fe58a", rare: "#8fb3ff", epic: "#d29bff" } as const;

const timer = new THREE.Timer();
const FIXED_DT = 1 / 60;
let accumulator = 0;

function frame(): void {
  requestAnimationFrame(frame);
  timer.update();
  const frameDt = Math.min(timer.getDelta(), 0.1);

  // Input → intenções no domínio.
  const { lookX, lookY, zoom, attack, inventory, potion, roll, skill, interact } = input.flush();
  if (inventory && started && !menu.isOpen && !dialogue.isOpen) {
    if (inventoryUI.isOpen) closeInventory();
    else openInventory();
  }
  if (interact && started && !menu.isOpen && !inventoryUI.isOpen) {
    if (dialogue.isOpen) closeDialogue();
    else {
      const npc = nearestNpc();
      if (npc && isAlive(player)) openDialogue(npc);
    }
  }
  if (paused) {
    // Sem avançar animações (dt 0), mas refletindo o estado: equipar na mochila já muda o modelo.
    views.update(0, cam.camera, currentTarget()?.id, world.time, player);
    hud.update(player, currentTarget());
    hud.updateBoss(world);
    composer.render();
    return;
  }
  if (potion && isAlive(player)) {
    if (!useFirstPotion(world, player)) hud.pushLog("Nenhuma poção para beber (ou vida cheia).", "dmg-out");
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
    const ab = player.abilities!;
    // Esquiva vai na direção do movimento (ou para a frente se parado); investida segue a câmera.
    const moving = player.movement.intent.x !== 0 || player.movement.intent.z !== 0;
    ab.aimDirection = moving && roll ? { ...player.movement.intent } : directionFromYaw(cam.facingYaw);
    if (roll) ab.wantsRoll = true;
    if (skill !== null) {
      const id = ab.skills[skill]?.id;
      if (id) {
        const state = ab.skills.find((s) => s.id === id);
        if (state && state.cooldownLeft > 0) hud.pushLog(`${SKILLS[id].name} em recarga (${Math.ceil(state.cooldownLeft)}s)`, "dmg-out");
        else ab.queuedSkill = id;
      }
    }
  } else {
    player.movement.intent = { x: 0, z: 0 };
  }

  if (performance.now() - lastSaveAt > AUTOSAVE_MS) saveGame("auto");

  // Simulação em passo fixo para o combate ser previsível.
  accumulator += frameDt;
  while (accumulator >= FIXED_DT) {
    handleEvents(stepWorld(world, FIXED_DT));
    accumulator -= FIXED_DT;
  }

  // Passos enquanto anda no chão (sem dash).
  if (isAlive(player) && !player.abilities?.dash && (player.movement.intent.x !== 0 || player.movement.intent.z !== 0)) {
    audio.footstep(world.time, input.running);
  }
  // Música de chefe segue o estado de engajamento (ele pode desistir e voltar para casa).
  let bossEngaged = false;
  for (const e of world.enemies()) if (e.boss?.engaged && isAlive(e)) bossEngaged = true;
  audio.setBossMode(bossEngaged);

  // Apresentação.
  const target = currentTarget();
  const p = player.transform.position;
  cam.update(new THREE.Vector3(p.x, p.y, p.z), frameDt);
  sun.position.set(p.x + 40, p.y + 70, p.z + 30);
  sun.target.position.set(p.x, p.y, p.z);
  views.update(frameDt, cam.camera, target?.id, world.time, player);
  const npcNear = nearestNpc();
  interactEl.classList.toggle("hidden", !npcNear || dialogue.isOpen);
  if (npcNear) interactText.textContent = `Falar com ${npcNear.name}`;
  questTracker.update(player);
  dropViews.update(world, world.time);
  projectileViews.update(world, frameDt, world.time);
  floats.update(frameDt);
  hud.update(player, target);
  hud.updateBoss(world);
  skillBar.update(player);
  composer.render();
}

// Gancho de depuração só em desenvolvimento (testes automatizados e console).
if (import.meta.env.DEV) {
  (window as unknown as { __game: unknown }).__game = {
    world,
    player,
    cam,
    renderer,
    openMenu: () => {
      started = true;
      paused = true;
      menu.open();
    },
    save: () => saveGame("manual"),
    slots: saveSlots,
    activeSlot: () => activeSlot,
    audioState: () => (audio.ready ? "running" : "locked"),
    audioLevel: () => audio.measureLevel(),
    setPaused: (v: boolean) => {
      paused = v;
    },
  };
}

frame();
