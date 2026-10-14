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
import { exportSave, importSave, loadStash, readNewGameIntent, saveSlots, saveStash, writeNewGameIntent } from "./game/storage";
import { SlotsUI } from "./game/slotsUI";
import { GameAudio } from "./game/audio";
import { ThirdPersonCamera } from "./game/camera";
import { EntityViews } from "./game/entityViews";
import { createEnvironment } from "./game/environment";
import { loadVoxOverrides } from "./game/props/catalog";
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
import { SKILL_TREE } from "./domain/skillTree";
import { CLASSES } from "./domain/classes";
import { ProjectileViews } from "./game/projectileViews";
import { directionFromYaw } from "./domain/math";
import { useFirstPotion } from "./domain/inventory";
import { createTerrainMesh } from "./game/terrainMesh";
import { HazardViews } from "./game/hazardViews";
import { DungeonView } from "./game/dungeonView";
import { createPortal } from "./game/portal";
import { terrainHeight } from "./domain/terrain";
import {
  descend, DUNGEON_ENTRANCE, DUNGEON_LIVES, DUNGEON_NAME, DUNGEON_ORIGIN, dungeonInteraction, enterDungeon, exitDungeon, inDungeonSpace, openChest,
  openSideChest, useShrine,
} from "./domain/dungeon";
import { roomAt } from "./domain/dungeonLayout";
import { ShopUI } from "./game/shopUI";
import { SkillTreeUI } from "./game/skillTreeUI";
import { Minimap } from "./game/minimap";
import { passageAt, travel, ZONE_PASSAGES, ZONES, zoneAt, type ZoneId } from "./domain/zones";
import { FOREST_CAMP } from "./domain/terrain";
import type { Environment } from "./game/environment";
import { StashUI } from "./game/stashUI";
import { WaystoneUI } from "./game/waystoneUI";
import { knownVillages, teleport, teleportFee, VILLAGES, VILLAGE_LIST, villageInteraction, type VillageId } from "./domain/villages";
import { npcById } from "./domain/npc";
import { createPassageMarker, type PassageMarker } from "./game/passage";
import { createWaystoneGlow, type WaystoneGlow } from "./game/waystone";
import { LoadingScreen } from "./game/loading";
import { displayRarity } from "./game/itemTooltip";
import { equippedSetCounts, SETS } from "./domain/sets";
import type { Item } from "./domain/items";
import { DayNightSky } from "./game/sky";
import { Foliage } from "./game/foliage";
import { HIT_COLORS, Particles } from "./game/particles";
import { attenuate, CameraShake, traumaFromDamage } from "./game/shake";
import { createBraziers } from "./game/environment";
import { clockAt, DAY_LENGTH, formatClock, START_HOUR } from "./domain/dayCycle";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
// Céu, sol, lua e neblina seguem o relógio do mundo (dayCycle no domínio).
const sky = new DayNightSky(scene);
const foliage = new Foliage(9173, ZONES.vale);
const minimap = new Minimap();
scene.add(foliage.group);
const particles = new Particles(scene);
const shake = new CameraShake();
/** Congela a simulação por alguns centésimos num golpe forte ("hit-stop"), para o impacto pesar. */
let hitStop = 0;

const terrainMesh = createTerrainMesh(ZONES.vale);
scene.add(terrainMesh);
// Modelos desenhados no MagicaVoxel (assets/vox/*.vox) substituem os esculpidos por código.
await loadVoxOverrides();
const environment = createEnvironment();
scene.add(environment.group);
// Cripta: desenhada a partir da planta do domínio ao entrar; o portal de entrada fica no mapa.
const dungeonView = new DungeonView(scene);
const entrancePortal = createPortal();
entrancePortal.group.position.set(DUNGEON_ENTRANCE.x, terrainHeight(DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z), DUNGEON_ENTRANCE.z);
scene.add(entrancePortal.group);
// Braseiros nos pilares do santuário: chamas que brilham mais à noite e uma luz quente no centro.
const braziers = createBraziers();
scene.add(braziers.group);

/**
 * O que se desenha de cada zona: terreno, vegetação, cenário, as passagens e o cristal da pedra de
 * teleporte. O vale já existe no boot (os objetos acima); as outras zonas são montadas na primeira
 * visita, atrás da tela de carregamento.
 */
interface ZoneVisuals {
  group: THREE.Group;
  environment: Environment;
  foliage: Foliage;
  passages: PassageMarker[];
  stones: { village: VillageId; glow: WaystoneGlow }[];
}
const zoneVisuals = new Map<ZoneId, ZoneVisuals>();
const FOREST_FOG = new THREE.Color("#3a5a48");
const campfireLight = new THREE.PointLight("#ff9a4a", 0, 18, 1.4);

/** Passagens e pedras de teleporte de uma zona. */
function zoneMarkers(zone: ZoneId, group: THREE.Group): Pick<ZoneVisuals, "passages" | "stones"> {
  const passages = ZONE_PASSAGES.filter((g) => g.from === zone).map((g) => {
    const marker = createPassageMarker(g, zone === "vale" ? "#d8f0c8" : "#c8e8d0");
    group.add(marker.group);
    return marker;
  });
  const stones = VILLAGE_LIST.filter((v) => v.zone === zone).map((v) => {
    const glow = createWaystoneGlow(v);
    group.add(glow.group);
    return { village: v.id, glow };
  });
  return { passages, stones };
}

function ensureZoneVisuals(id: ZoneId): ZoneVisuals {
  let zv = zoneVisuals.get(id);
  if (zv) return zv;
  const group = new THREE.Group();
  if (id === "vale") {
    group.add(terrainMesh, foliage.group, environment.group, braziers.group, entrancePortal.group);
    zv = { group, environment, foliage, ...zoneMarkers(id, group) };
  } else {
    const zone = ZONES[id];
    const env = createEnvironment(5151, zone);
    const fol = new Foliage(9173 + 31, zone);
    group.add(createTerrainMesh(zone), fol.group, env.group);
    const camp = { x: zone.center.x + FOREST_CAMP.x, z: zone.center.z + FOREST_CAMP.z };
    campfireLight.position.set(camp.x, terrainHeight(camp.x, camp.z) + 1.2, camp.z);
    group.add(campfireLight);
    zv = { group, environment: env, foliage: fol, ...zoneMarkers(id, group) };
  }
  scene.add(group);
  zoneVisuals.set(id, zv);
  return zv;
}
ensureZoneVisuals("vale");

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
const hazardViews = new HazardViews(scene);
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

/** O que o F faz agora: portais e baú da cripta têm prioridade sobre conversar. */
function currentInteraction(): { label: string; act: () => void } | null {
  const d = dungeonInteraction(world, player);
  const level = player.progression?.level ?? 1;
  if (d === "enter") return { label: `Entrar na ${DUNGEON_NAME} (nível ${level})`, act: () => afterDungeonChange(() => enterDungeon(world, player)) };
  if (d === "chest") return { label: "Abrir o baú", act: () => { openChest(world, player); handleEvents(world.drainEvents()); } };
  if (d === "sideChest") return { label: "Abrir o baú do tesouro", act: () => { openSideChest(world, player); handleEvents(world.drainEvents()); } };
  if (d === "shrine") return { label: "Tocar o santuário (cura e bênção)", act: () => { useShrine(world, player); handleEvents(world.drainEvents()); } };
  if (d === "stairs") return { label: "Descer a escada (andar 2: o Lorde)", act: () => afterDungeonChange(() => descend(world, player)) };
  if (d === "stairsLocked") return { label: "A escada está selada: vença o Cavaleiro Sepulcral", act: () => toast("Vença o Cavaleiro Sepulcral para abrir a escada.") };
  if (d === "exit") return { label: "Voltar ao vale (vitória)", act: () => afterDungeonChange(() => exitDungeon(world, player, "complete")) };
  if (d === "leave") {
    return {
      label: "Sair da cripta (desistir)",
      act: () => {
        if (confirm("Sair agora fecha a cripta. Na próxima entrada ela será outra. Sair?")) afterDungeonChange(() => exitDungeon(world, player, "leave"));
      },
    };
  }
  const spot = villageInteraction(player);
  if (spot?.spot === "stash") return { label: "Abrir o baú", act: () => openPanel(stashUI) };
  if (spot?.spot === "stone") return { label: `Pedra de Teleporte (viagem: ${teleportFee(player)} ouro)`, act: () => openPanel(waystoneUI) };
  const npc = nearestNpc();
  return npc ? { label: `Falar com ${npc.name}`, act: () => openDialogue(npc) } : null;
}

/** Entrar ou sair muda o mundo inteiro de lugar: novas entidades, câmera sem viagem, eventos na hora. */
function afterDungeonChange(change: () => void): void {
  change();
  views.sync(world);
  views.prune(world);
  cam.snap();
  handleEvents(world.drainEvents());
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
// Loja: aberta pelo "Negociar" da conversa; o mundo continua pausado e sem pointer lock.
const shopUI = new ShopUI(world, player);
shopUI.onAction = () => handleEvents(world.drainEvents());
shopUI.onMessage = (text) => toast(text);
function openShop(npc: Entity): void {
  dialogue.close();
  shopUI.open(npc.name, npcById(npc.npc?.id ?? "")?.shop);
  paused = true;
}
function closeShop(): void {
  shopUI.close();
  paused = false;
  input.requestLock();
}
shopUI.onClose = closeShop;
dialogue.onShop = openShop;
// Baú das vilas (o mesmo em todas, compartilhado entre os slots) e Pedra de Teleporte.
const stash = loadStash();
const stashUI = new StashUI(stash, player);
stashUI.onChange = () => saveStash(stash);
stashUI.onMessage = (text) => toast(text);
const waystoneUI = new WaystoneUI(world, player);
waystoneUI.onMessage = (text) => toast(text);
waystoneUI.onTravel = (to) => {
  closeWaystone();
  const village = VILLAGES[to];
  const zone = ZONES[village.zone];
  void loadArea(
    { title: village.name, subtitle: zone.subtitle, detail: `${zone.name} · inimigos nível ${zone.levels[0]} a ${zone.levels[1]}` },
    village.zone,
    () => teleport(world, player, to),
  );
};
function openPanel(panel: { open(): void }): void {
  panel.open();
  paused = true;
  document.exitPointerLock();
}
function closeStash(): void {
  stashUI.close();
  saveStash(stash);
  paused = false;
  input.requestLock();
}
function closeWaystone(): void {
  waystoneUI.close();
  paused = false;
  input.requestLock();
}
stashUI.onClose = closeStash;
waystoneUI.onClose = closeWaystone;
/** Painéis da vila abertos (bloqueiam as outras teclas de painel). */
const sanctuaryPanelOpen = () => stashUI.isOpen || waystoneUI.isOpen;

/**
 * Troca de área (passagem na borda ou Pedra de Teleporte): escurece, move o herói no domínio, monta a
 * zona de destino (na primeira visita) e os modelos completos do cenário, e clareia.
 */
const loading = new LoadingScreen();
async function loadArea(card: { title: string; subtitle: string; detail?: string }, to: ZoneId, change: () => void): Promise<void> {
  if (loading.busy) return;
  paused = true;
  player.movement.intent = { x: 0, z: 0 };
  await loading.run(card, async (progress) => {
    afterDungeonChange(change);
    progress(0.15);
    await new Promise((r) => requestAnimationFrame(r));
    const zv = ensureZoneVisuals(to);
    progress(0.4);
    // Monta os modelos completos já, atrás da tela, em vez de um por quadro com o jogo rodando.
    const until = performance.now() + 2500;
    while (performance.now() < until && zv.environment.props.buildPending()) {
      progress(0.4 + 0.5 * Math.min(1, (performance.now() + 2500 - until) / 2500));
      await new Promise((r) => requestAnimationFrame(r));
    }
    for (const [id, other] of zoneVisuals) other.group.visible = id === to;
  }, () => (paused = false));
}
// Árvore de habilidades (K): painel modal como a mochila.
const treeUI = new SkillTreeUI(world, player);
treeUI.onAction = () => handleEvents(world.drainEvents());
treeUI.onMessage = (text) => toast(text);
function openTree(): void {
  treeUI.open();
  paused = true;
  document.exitPointerLock();
}
function closeTree(): void {
  treeUI.close();
  paused = false;
  input.requestLock();
}
treeUI.onClose = closeTree;
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
  if (shopUI.isOpen) {
    if (locked) closeShop();
    return;
  }
  if (stashUI.isOpen) {
    if (locked) closeStash();
    return;
  }
  if (waystoneUI.isOpen) {
    if (locked) closeWaystone();
    return;
  }
  if (treeUI.isOpen) {
    if (locked) closeTree();
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
/** Última vez que a dica da carapaça apareceu no log (para não repetir a cada golpe). */
let lastImmuneHint = -Infinity;
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
  else if (treeUI.isOpen) closeTree();
  else if (shopUI.isOpen) closeShop();
  else if (stashUI.isOpen) closeStash();
  else if (waystoneUI.isOpen) closeWaystone();
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
        if (src?.boss) {
          // Golpe de chefe estremece o chão mesmo quando erra.
          shake.add(attenuate(0.3, distanceXZ(src.transform.position, player.transform.position), 20));
          const sp = src.transform.position;
          particles.dust({ x: sp.x, y: sp.y + 0.1, z: sp.z }, "#a89878");
        }
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
          shake.add(attenuate(ev.phase === 3 ? 0.5 : 0.3, distanceXZ(boss.transform.position, player.transform.position), 30));
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
        const tview = views.get(ev.target);
        tview?.flash();
        const tp = target.transform.position;
        const heavy = ev.amount >= target.health.max * 0.2 || !!ev.crit;
        particles.hit({ x: tp.x, y: tp.y + (tview?.model.height ?? 1.6) * 0.55, z: tp.z }, HIT_COLORS[target.archetype] ?? ["#cccccc"], heavy);
        if (toPlayer) shake.add(traumaFromDamage(ev.amount, player.health.max));
        else if (ev.source === player.id) {
          const melee = !player.classId || CLASSES[player.classId].attackStyle === "melee";
          shake.add(heavy ? 0.16 : 0.07);
          if (melee) hitStop = Math.max(hitStop, heavy ? 0.075 : 0.045);
        }
        audio.play(toPlayer ? "hurt" : "hit", { ...spatial(target.transform.position), pitch: target.boss ? 0.7 : 1 });
        if (ev.crit) floats.spawn(target.transform.position, `${ev.amount}!`, "#ffb02e", 1.35);
        else floats.spawn(target.transform.position, `${ev.amount}`, toPlayer ? "#ff7b7b" : "#ffd37a", toPlayer ? 1 : 0.9);
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
          const vp = victim.transform.position;
          particles.death({ x: vp.x, y: vp.y + 0.6, z: vp.z }, HIT_COLORS[victim.archetype] ?? ["#cccccc"], !!victim.boss);
          if (victim.boss) shake.add(0.7);
          else if (ev.killer === player.id) {
            shake.add(0.12);
            hitStop = Math.max(hitStop, 0.08);
          }
          const pitchByType: Record<string, number> = { slime: 1.3, goblin: 1, goblinArcher: 1.08, orc: 0.7, spider: 1.5, bogZombie: 0.6, scorpion: 1.2, bandit: 0.95, banditArcher: 1 };
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
        hud.pushLog("+1 ponto de habilidade: aperte K para abrir a árvore.", "level");
        particles.sparkle({ x: player.transform.position.x, y: player.transform.position.y + 1.2, z: player.transform.position.z }, ["#ffe57a", "#fff3c4", "#ffb84a"], 36);
        floats.spawn(player.transform.position, `NÍVEL ${ev.level}!`, "#ffe57a", 1.4);
        hud.pushLog(`Você alcançou o nível ${ev.level}!`, "level");
        saveGame("auto");
        break;
      case "respawn":
        if (ev.entity === player.id) {
          hud.pushLog(inDungeonSpace(player.transform.position.x) ? "Você voltou à sala inicial da cripta." : "Você renasceu no santuário.", "level");
          cam.snap();
        }
        break;
      case "pickup": {
        const item = player.inventory?.items.find((i) => i?.id === ev.itemId);
        if (item) {
          audio.play(item.rarity === "common" ? "pickupCommon" : "pickupRare", { pitch: item.rarity === "epic" ? 1.25 : item.rarity === "rare" ? 1.1 : 1 });
          hud.pushLog(`Você pegou ${item.name}`, `loot-${displayRarity(item)}`);
          floats.spawn(player.transform.position, item.name, RARITY_FLOAT[displayRarity(item)], item.rarity === "common" ? 0.7 : 0.9);
        }
        break;
      }
      case "inventoryFull":
        hud.pushLog("Mochila cheia!", "dmg-in");
        break;
      case "heal":
        audio.play("potion");
        particles.sparkle({ x: player.transform.position.x, y: player.transform.position.y + 1, z: player.transform.position.z }, ["#9ce39c", "#d8ffd0"]);
        floats.spawn(player.transform.position, `+${ev.amount}`, "#9ce39c", 0.9);
        hud.pushLog(`Você recuperou ${ev.amount} de vida.`, "gain");
        break;
      case "equip": {
        const item = player.equipment?.[ev.slot];
        if (item) {
          hud.pushLog(`Equipado: ${item.name}`, `loot-${displayRarity(item)}`);
          announceSet(item);
        }
        break;
      }
      case "skill": {
        const def = SKILLS[ev.skill];
        audio.play(SKILL_SFX[ev.skill]);
        if (ev.skill === "whirlwind") {
          views.get(ev.entity)?.triggerSpin();
          if (ev.hits > 0) shake.add(0.18);
          hud.pushLog(ev.hits > 0 ? `${def.name} acertou ${ev.hits} inimigo${ev.hits > 1 ? "s" : ""}!` : `${def.name} não acertou ninguém.`, ev.hits > 0 ? "dmg-out" : "gain");
        } else if (ev.skill === "warcry") {
          floats.spawn(player.transform.position, "GRITO DE GUERRA!", "#ff9f43", 1.1);
          hud.pushLog("+50% de dano por 8 s!", "level");
        } else if (ev.skill === "charge" || ev.skill === "piercingShot" || ev.skill === "fireball" || ev.skill === "arrowRain") {
          views.get(ev.entity)?.triggerSwing();
          if (ev.skill === "charge") particles.dust({ x: player.transform.position.x, y: player.transform.position.y + 0.1, z: player.transform.position.z });
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
          shake.add(attenuate(0.32, distanceXZ(ev.position, player.transform.position), 22));
          particles.burst(ev.position, { count: 14, colors: ev.projectileId === -1 ? ["#9ce39c", "#6fcf5a"] : ["#ff9a3c", "#ffd37a", "#5a4a3a"], speed: [2, 5], up: [2, 5], size: [0.08, 0.16], life: [0.5, 0.9] });
          projectileViews.burst(ev.position, ev.explodeRadius, ev.projectileId === -1 ? "#9ce39c" : ev.projectileId === -2 ? "#b88aff" : "#ff9a3c");
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
        if (ev.entity === player.id) {
          audio.play("roll");
          particles.dust({ x: player.transform.position.x, y: player.transform.position.y + 0.1, z: player.transform.position.z });
        }
        break;
      case "drop": {
        const d = world.drops.get(ev.dropId);
        if (d) audio.play("drop", spatial(d.position));
        break;
      }
      case "immune": {
        // Golpe básico na carapaça: só um "tink" e o aviso de que precisa de habilidade.
        const t = world.get(ev.entity);
        if (t && ev.source === player.id) {
          floats.spawn(t.transform.position, "IMUNE", "#f0d38a", 0.85);
          audio.play("hit", { ...spatial(t.transform.position), pitch: 1.8 });
          const now = world.time;
          if (now - lastImmuneHint > 6) {
            lastImmuneHint = now;
            hud.pushLog("A Carapaça de Areia ignora ataques básicos. Use habilidades (1-4)!", "dmg-in");
          }
        }
        break;
      }
      case "carapaceHit": {
        const t = world.get(ev.entity);
        if (t) {
          const tp = t.transform.position;
          particles.burst({ x: tp.x, y: tp.y + 1.6, z: tp.z }, { count: 14, colors: ["#f0d38a", "#d9b25a", "#c4963c"], speed: [2, 5], up: [2, 5], size: [0.1, 0.2], life: [0.6, 1.0] });
          if (ev.layersLeft > 0) floats.spawn(tp, `CARAPAÇA ${ev.layersLeft}/${t.boss?.carapace?.maxLayers ?? 3}`, "#f0d38a", 1);
          shake.add(0.12);
        }
        break;
      }
      case "carapaceBreak": {
        const t = world.get(ev.entity);
        if (t) {
          const tp = t.transform.position;
          particles.death({ x: tp.x, y: tp.y + 1.2, z: tp.z }, ["#f0d38a", "#d9b25a", "#c4963c", "#8a6a3a"], true);
          floats.spawn(tp, "CARAPAÇA PARTIDA!", "#ffe57a", 1.5);
          hud.pushLog(`${t.name} está atordoado por ${ev.stun.toFixed(1)} s: bata com tudo!`, "level");
          audio.play("bossPhase");
          shake.add(0.45);
          hitStop = Math.max(hitStop, 0.12);
        }
        break;
      }
      case "carapaceUp": {
        const t = world.get(ev.entity);
        if (t) {
          floats.spawn(t.transform.position, "CARAPAÇA DE AREIA", "#f0d38a", 1.2);
          hud.pushLog(`${t.name} se cobriu de areia: só habilidades quebram a carapaça.`, "dmg-in");
        }
        break;
      }
      case "groundWarning":
        hazardViews.warn(ev.at, ev.radius, ev.duration);
        break;
      case "hazardSpawn": {
        const h = world.hazards.get(ev.hazardId);
        if (h && h.kind !== "arrows") {
          audio.play("explode", { ...spatial(h.position), pitch: h.kind === "acid" ? 1.5 : 1.1 });
          const colors = h.kind === "fire" ? ["#ffb84a", "#ff6a1a", "#8a2a10"] : ["#9ce85a", "#6cc63a", "#3f8a24"];
          particles.burst({ x: h.position.x, y: h.position.y + 0.3, z: h.position.z }, { count: 16, colors, speed: [1.5, 4], up: [2, 4.5], size: [0.08, 0.16], life: [0.5, 0.9] });
        }
        break;
      }
      case "talentLearned": {
        const r = SKILL_TREE[ev.skill][ev.rank - 1];
        audio.play(r?.mods.talent ? "pickupRare" : "ui");
        hud.pushLog(`${SKILLS[ev.skill].name} rank ${ev.rank}: ${r?.name ?? ""}`, "level");
        break;
      }
      case "talentReset":
        audio.play("coin");
        hud.pushLog(`Árvore reiniciada (-${ev.gold} ouro). Pontos devolvidos.`, "gain");
        break;
      case "status": {
        const t = world.get(ev.entity);
        // As estrelas já mostram o atordoamento; o texto só para chefes, que resistem e importam mais.
        if (t?.boss && ev.effect === "stun") floats.spawn(t.transform.position, "ATORDOADO", "#ffe57a", 1);
        break;
      }
      case "dungeonEnter":
        audio.play("bossPhase");
        hud.pushLog(`Você entrou na ${DUNGEON_NAME} (nível ${ev.level}): ${ev.rooms} salas e um chefe. Três vidas.`, "level");
        floats.spawn(player.transform.position, DUNGEON_NAME.toUpperCase(), "#c08aff", 1.4);
        break;
      case "zoneTravel": {
        const to = ZONES[ev.to as ZoneId];
        audio.play("bossPhase");
        hud.pushLog(`Você chegou a ${to.name} (inimigos nível ${to.levels[0]} a ${to.levels[1]}).`, "level");
        saveGame("auto");
        break;
      }
      case "dungeonFloor":
        audio.play("bossPhase");
        floats.spawn(player.transform.position, `ANDAR ${ev.floor}`, "#c08aff", 1.4);
        hud.pushLog(ev.floor >= ev.floors ? "Você desceu ao último andar. O Lorde Esqueleto espera no fim." : `Andar ${ev.floor} de ${ev.floors}.`, "level");
        break;
      case "ambush":
        audio.play("bossPhase");
        shake.add(0.35);
        floats.spawn(player.transform.position, "EMBOSCADA!", "#ff6b5a", 1.3);
        break;
      case "wave":
        audio.play("bossPhase");
        floats.spawn(player.transform.position, "MAIS ESQUELETOS!", "#ff9a5a", 1.1);
        hud.pushLog("Outra onda saiu das sombras.", "dmg-in");
        break;
      case "stairsOpen":
        audio.play("questComplete");
        floats.spawn(player.transform.position, "ESCADA ABERTA", "#c08aff", 1.2);
        hud.pushLog("O Cavaleiro caiu. A escada para o andar de baixo está aberta.", "level");
        break;
      case "shrineBlessing":
        audio.play("levelUp");
        floats.spawn(player.transform.position, "BÊNÇÃO: +25% DANO", "#7ac8ff", 1.2);
        hud.pushLog(`O santuário cura e abençoa: +25% de dano por ${ev.seconds} s.`, "gain");
        break;
      case "trapSpring":
        if (world.dungeon && player.transform.position.x >= 500) {
          const L = world.dungeon.layout;
          const pi = Math.floor(player.transform.position.x - DUNGEON_ORIGIN.x), pj = Math.floor(player.transform.position.z - DUNGEON_ORIGIN.z);
          const room = roomAt(L, pi, pj);
          if (room?.event === "traps") audio.play("hit", { pitch: 0.6, distance: 6 });
        }
        break;
      case "roomCleared":
        audio.play("questAccept");
        hud.pushLog(`Sala limpa (${ev.cleared}/${ev.total}).`, "gain");
        break;
      case "villageAttuned": {
        const village = VILLAGES[ev.village as VillageId];
        audio.play("questAccept");
        floats.spawn(player.transform.position, "PEDRA DE TELEPORTE ATIVADA", "#7ad8ff", 1.3);
        hud.pushLog(`${village.name}: a Pedra de Teleporte foi ativada. Dá para voltar aqui de qualquer vila.`, "level");
        saveGame("auto");
        break;
      }
      case "teleport":
        audio.play("coin", { pitch: 0.7 });
        hud.pushLog(`A pedra levou você a ${VILLAGES[ev.village as VillageId].name} (-${ev.gold} ouro).`, "gain");
        break;
      case "dungeonComplete":
        audio.play("questComplete");
        floats.spawn(player.transform.position, "CRIPTA VENCIDA!", "#ffe57a", 1.5);
        hud.pushLog("O Lorde caiu! Abra o baú e use o portal verde para voltar.", "level");
        break;
      case "chestOpened":
        audio.play("pickupRare");
        hud.pushLog(`Baú aberto: +${ev.gold} ouro, ${ev.items.join(", ")}.`, "level");
        break;
      case "dungeonLifeLost":
        hud.pushLog(ev.livesLeft > 0 ? `Você perdeu uma vida na cripta. Restam ${ev.livesLeft}.` : "Sem vidas: a cripta te expulsa.", "dmg-in");
        break;
      case "dungeonExit":
        audio.setBossMode(false);
        hud.pushLog(ev.reason === "complete" ? "De volta ao vale, vitorioso." : ev.reason === "failed" ? "A cripta se fechou. Ela será outra na próxima vez." : "Você saiu da cripta.", ev.reason === "failed" ? "dmg-in" : "gain");
        views.prune(world);
        cam.snap();
        saveGame("auto");
        break;
      case "sell":
        audio.play("coin");
        hud.pushLog(`Vendido: ${ev.itemName} (+${ev.gold} ouro)`, "gain");
        break;
      case "buy":
        audio.play("coin", { pitch: 0.85 });
        hud.pushLog(`Comprado: ${ev.itemName} (-${ev.gold} ouro)`, "level");
        break;
      case "buffEnd":
        hud.pushLog("Grito de Guerra acabou.", "dmg-out");
        break;
    }
  }
}

const RARITY_FLOAT = { common: "#e8e8e8", uncommon: "#7fe58a", rare: "#8fb3ff", epic: "#d29bff", set: "#5ff0c0" } as const;

/** Ao vestir a 2ª ou a 3ª peça de um conjunto, avisa o bônus que acabou de ligar. */
function announceSet(item: Item): void {
  if (!item.set || !player.equipment) return;
  const set = SETS[item.set];
  const worn = equippedSetCounts(player.equipment).get(set.id) ?? 0;
  if (worn === 2) hud.pushLog(`${set.name} (2): ${set.two.text}`, "loot-set");
  if (worn === 3) {
    hud.pushLog(`${set.name} completo! ${set.three.text}`, "loot-set");
    floats.spawn(player.transform.position, "Conjunto completo!", RARITY_FLOAT.set, 1.1);
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
  const { lookX, lookY, zoom, attack, inventory, potion, roll, skill, interact, tree, map } = input.flush();
  if (map && started && !menu.isOpen) minimap.toggleFull();
  if (tree && started && !menu.isOpen && !dialogue.isOpen && !shopUI.isOpen && !inventoryUI.isOpen && !sanctuaryPanelOpen()) {
    if (treeUI.isOpen) closeTree();
    else openTree();
  }
  if (inventory && started && !menu.isOpen && !dialogue.isOpen && !shopUI.isOpen && !treeUI.isOpen && !sanctuaryPanelOpen()) {
    if (inventoryUI.isOpen) closeInventory();
    else openInventory();
  }
  if (interact && started && !menu.isOpen && !inventoryUI.isOpen && !treeUI.isOpen) {
    if (shopUI.isOpen) closeShop();
    else if (stashUI.isOpen) closeStash();
    else if (waystoneUI.isOpen) closeWaystone();
    else if (dialogue.isOpen) closeDialogue();
    else if (isAlive(player)) {
      const action = currentInteraction();
      action?.act();
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
  // Hit-stop: a simulação e as animações param por um instante; câmera e partículas seguem.
  const simDt = hitStop > 0 ? 0 : frameDt;
  hitStop = Math.max(0, hitStop - frameDt);
  accumulator += simDt;
  while (accumulator >= FIXED_DT) {
    handleEvents(stepWorld(world, FIXED_DT));
    accumulator -= FIXED_DT;
  }
  // Passou da boca de uma passagem na borda: carrega a área vizinha.
  const crossed = !world.dungeon && isAlive(player) ? passageAt(player.transform.position) : undefined;
  if (crossed) {
    const zone = ZONES[crossed.to];
    void loadArea({ title: zone.name, subtitle: zone.subtitle, detail: `Inimigos nível ${zone.levels[0]} a ${zone.levels[1]}` }, crossed.to, () => travel(world, player, crossed));
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
  const focus = new THREE.Vector3(p.x, p.y, p.z);
  cam.update(focus, frameDt);
  shake.intensity = menu.shakeIntensity;
  cam.applyShake(shake.update(frameDt));
  // Na cripta: as zonas somem (economiza e não vaza luz), a câmera fica mais de cima e o céu escurece.
  // Fora dela, só a zona onde o herói está aparece (a floresta é montada na primeira visita).
  const indoor = inDungeonSpace(p.x);
  const zoneId = zoneAt(p.x, p.z).id;
  const current = indoor ? null : ensureZoneVisuals(zoneId);
  for (const [id, zv] of zoneVisuals) zv.group.visible = !indoor && id === zoneId;
  cam.minPitch = indoor ? 0.8 : -0.15;
  cam.maxDistance = indoor ? 13 : 18;
  sky.update(world.time, cam.camera, focus, frameDt, indoor);
  if (current) {
    current.environment.update(cam.camera);
    current.foliage.update(world.time, p);
    for (const marker of current.passages) marker.update(world.time);
    const known = knownVillages(player);
    for (const s of current.stones) s.glow.update(world.time, known.includes(s.village));
    if (zoneId === "vale") {
      braziers.update(world.time, sky.night);
      entrancePortal.update(world.time);
    } else {
      // Floresta: neblina mais fechada e esverdeada, sob a copa.
      const fog = scene.fog as THREE.Fog;
      fog.color.lerp(FOREST_FOG, 0.55);
      fog.near *= 0.45;
      fog.far *= 0.62;
      (scene.background as THREE.Color).lerp(FOREST_FOG, 0.35);
      campfireLight.intensity = 6 + Math.sin(world.time * 11) * 0.8 + sky.night * 10;
    }
  }
  dungeonView.update(world.dungeon, focus, world.time, cam.camera);
  views.prune(world);
  hud.updateDungeon(world.dungeon ? { name: DUNGEON_NAME, level: world.dungeon.level, floor: world.dungeon.floor, floors: world.dungeon.floors, cleared: world.dungeon.clearedRooms.length, total: world.dungeon.layout.rooms.filter((r) => r.kind === "combat" || r.kind === "stairs").length, lives: world.dungeon.livesLeft, maxLives: DUNGEON_LIVES, boss: world.dungeon.bossDefeated } : null);
  particles.update(frameDt);
  hud.setClock(formatClock(clockAt(world.time)), sky.night > 0.5);
  views.update(simDt, cam.camera, target?.id, world.time, player);
  const action = isAlive(player) ? currentInteraction() : null;
  interactEl.classList.toggle("hidden", !action || dialogue.isOpen || shopUI.isOpen || sanctuaryPanelOpen());
  if (action && interactText.textContent !== action.label) interactText.textContent = action.label;
  questTracker.update(player);
  dropViews.update(world, world.time);
  projectileViews.update(world, frameDt, world.time);
  hazardViews.update(world, frameDt, world.time);
  floats.update(frameDt);
  hud.update(player, target);
  hud.updateBoss(world);
  minimap.update(world, player, cam.yaw);
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
    /** Pula o relógio para uma hora do dia (só para testes e screenshots). */
    setHour: (hour: number) => {
      const day = Math.floor(world.time / DAY_LENGTH);
      world.time = day * DAY_LENGTH + ((((hour - START_HOUR) % 24) + 24) % 24) / 24 * DAY_LENGTH;
    },
    particles,
    shake,
    foliage,
    environment,
    minimap,
    openInventory,
    dungeonView,
    interact: () => currentInteraction()?.act(),
    interactLabel: () => currentInteraction()?.label ?? null,
    enterDungeon: (seed?: number) => afterDungeonChange(() => enterDungeon(world, player, seed)),
    exitDungeon: () => afterDungeonChange(() => exitDungeon(world, player, "leave")),
    activeSlot: () => activeSlot,
    audioState: () => (audio.ready ? "running" : "locked"),
    audioLevel: () => audio.measureLevel(),
    setPaused: (v: boolean) => {
      paused = v;
    },
  };
}

frame();
