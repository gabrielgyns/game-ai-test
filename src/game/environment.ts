import * as THREE from "three";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "../domain/terrain";
import { BOSS_HOME, seededRandom } from "../domain/worldgen";
import { biomeAt, DESERT_BOSS_HOME, SWAMP_BOSS_HOME } from "../domain/biomes";
import { FOREST_BOSS_HOME, FOREST_CAMP, FOREST_RUINS, FOREST_SANCTUM, forestRiverZ, isIce, isWater, PEAKS_BOSS_HOME, PEAKS_CAVE, PEAKS_LAKE, PEAKS_LAKE_RADIUS, PEAKS_VILLAGE, isLava, VOLCANO_CALDERA, VOLCANO_FORGE, VOLCANO_FORT, VOLCANO_LAVA_LAKE } from "../domain/terrain";
import { ZONE_PASSAGES, ZONES, type ZoneDefinition } from "../domain/zones";
import { DUNGEON_ENTRANCE } from "../domain/dungeon";
import { VILLAGES } from "../domain/villages";
import { VoxelBuilder, voxelMaterial } from "./voxel";
import { PropField, type PropPlacement } from "./props/field";
import type { PropKind } from "./props/catalog";

type Biome = "meadow" | "swamp" | "desert";

/** Quantos de cada modelo espalhar, em que bioma, com que escala e altura do terreno. */
interface Scatter {
  kind: PropKind;
  count: number;
  biome?: Biome;
  scale: [number, number];
  /** Faixa de altura do terreno onde o modelo cresce (pinheiros nas encostas, neve no alto). */
  height?: [number, number];
  /** Raio livre em volta do santuário. */
  clear?: number;
}

const SCATTER: Scatter[] = [
  // Campina: carvalhos e bétulas no plano, pinheiros nas encostas e na muralha, neve no alto.
  { kind: "oak1", count: 45, biome: "meadow", scale: [0.9, 1.15], height: [-2, 5] },
  { kind: "oak2", count: 45, biome: "meadow", scale: [0.9, 1.15], height: [-2, 5] },
  { kind: "oakAutumn", count: 18, biome: "meadow", scale: [0.9, 1.1], height: [-2, 5] },
  { kind: "birch", count: 35, biome: "meadow", scale: [0.9, 1.1], height: [-2, 5] },
  { kind: "pine", count: 60, biome: "meadow", scale: [0.9, 1.2], height: [3.5, 9] },
  { kind: "pineSnow", count: 40, scale: [0.9, 1.2], height: [8.5, 30] },
  { kind: "bush", count: 70, biome: "meadow", scale: [0.8, 1.2] },
  { kind: "berryBush", count: 30, biome: "meadow", scale: [0.8, 1.1] },
  { kind: "bush", count: 30, biome: "swamp", scale: [0.8, 1.1] },
  { kind: "boulder1", count: 35, scale: [0.8, 1.4], clear: 10 },
  { kind: "boulder2", count: 35, scale: [0.8, 1.4], clear: 10 },
  { kind: "rocks", count: 22, biome: "meadow", scale: [0.9, 1.2] },
  { kind: "slab", count: 20, biome: "meadow", scale: [0.9, 1.2] },
  { kind: "slab", count: 12, biome: "swamp", scale: [0.9, 1.2] },
  // Pântano.
  { kind: "deadTree1", count: 40, biome: "swamp", scale: [0.9, 1.25] },
  { kind: "deadTree2", count: 40, biome: "swamp", scale: [0.9, 1.25] },
  { kind: "mushrooms", count: 40, biome: "swamp", scale: [0.7, 1.2] },
  // Deserto.
  { kind: "cactus1", count: 35, biome: "desert", scale: [0.85, 1.2] },
  { kind: "cactus2", count: 35, biome: "desert", scale: [0.85, 1.2] },
  { kind: "bones", count: 20, biome: "desert", scale: [0.9, 1.3] },
  { kind: "sandstone1", count: 30, biome: "desert", scale: [0.8, 1.5] },
  { kind: "sandstone2", count: 25, biome: "desert", scale: [0.8, 1.4] },
];

/** Pedras e raízes entram um pouco no chão, para não flutuar na quina de um degrau do terreno. */
const SINK = 0.1;

/** Decide onde fica cada adereço do mapa. Determinístico pela seed. */
export function placeProps(seed = 4242): PropPlacement[] {
  const rand = seededRandom(seed);
  const out: PropPlacement[] = [];
  const place = (kind: PropKind, x: number, z: number, yaw: number, scale: number, sink = SINK) =>
    out.push({ kind, x, y: terrainHeight(x, z) - sink, z, yaw, scale });

  for (const s of SCATTER) {
    for (let i = 0; i < s.count; i++) {
      const point = randomPoint(rand, s.clear ?? SPAWN_FLAT_RADIUS + 2, s.biome, s.height);
      if (!point) break;
      place(s.kind, point.x, point.z, rand() * Math.PI * 2, s.scale[0] + rand() * (s.scale[1] - s.scale[0]));
    }
  }

  // Santuário: pilares de pedra clara em círculo, com os braseiros no topo.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push({ kind: "pillar", x: Math.round(Math.cos(a) * 8) + 0.5, y: terrainHeight(0, 0), z: Math.round(Math.sin(a) * 8) + 0.5, yaw: -a, scale: 1 });
  }
  // Baú compartilhado e Pedra de Teleporte, na praça, virados para o centro.
  const { stash, stone } = VILLAGES.santuario;
  out.push({ kind: "stash", x: stash.x, y: terrainHeight(stash.x, stash.z), z: stash.z, yaw: Math.atan2(stash.x, stash.z), scale: 1 });
  out.push({ kind: "waystone", x: stone.x, y: terrainHeight(stone.x, stone.z), z: stone.z, yaw: Math.atan2(stone.x, stone.z), scale: 1 });
  // Arena do Rei Goblin: anel de totens com crânios, virados para o centro.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    place("totem", BOSS_HOME.x + Math.cos(a) * 12, BOSS_HOME.z + Math.sin(a) * 12, Math.PI / 2 - a, 1, 0);
  }
  // Arena da Rainha Aranha: casulos de teia em estacas.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    place("cocoon", SWAMP_BOSS_HOME.x + Math.cos(a) * 12, SWAMP_BOSS_HOME.z + Math.sin(a) * 12, Math.PI / 2 - a, 1, 0);
  }
  // Arena do Imperador Escorpião: obeliscos inteiros e quebrados.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    place("obelisk", DESERT_BOSS_HOME.x + Math.cos(a) * 13, DESERT_BOSS_HOME.z + Math.sin(a) * 13, Math.PI / 2 - a, 1, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * Math.PI * 2 + 0.2;
    place("obeliskBroken", DESERT_BOSS_HOME.x + Math.cos(a) * 15, DESERT_BOSS_HOME.z + Math.sin(a) * 15, Math.PI / 2 - a, 1, 0);
  }
  return out;
}

/** Adereços da Floresta Ancestral (coordenadas locais da zona, convertidas para o mundo). */
interface ForestScatter {
  kind: PropKind;
  count: number;
  scale: [number, number];
  /** Onde pode nascer, em coordenadas locais da zona. */
  where?: (lx: number, lz: number, h: number) => boolean;
}

const notRuins = (lx: number) => lx < 42;
const FOREST_SCATTER: ForestScatter[] = [
  { kind: "giantTree1", count: 30, scale: [0.9, 1.15], where: notRuins },
  { kind: "giantTree2", count: 30, scale: [0.9, 1.15], where: notRuins },
  { kind: "darkOak", count: 100, scale: [0.9, 1.2], where: notRuins },
  { kind: "birch", count: 25, scale: [0.9, 1.1], where: notRuins },
  { kind: "pine", count: 30, scale: [0.9, 1.25], where: (_x, _z, h) => h > 3 },
  { kind: "fallenLog", count: 24, scale: [0.8, 1.2] },
  { kind: "boulder1", count: 25, scale: [0.8, 1.4] },
  { kind: "boulder2", count: 25, scale: [0.8, 1.4] },
  { kind: "rocks", count: 10, scale: [0.9, 1.2] },
  { kind: "bush", count: 45, scale: [0.8, 1.2] },
  { kind: "berryBush", count: 15, scale: [0.8, 1.1] },
  { kind: "glowMushrooms", count: 30, scale: [0.6, 1.1] },
  { kind: "elvenArch", count: 7, scale: [0.95, 1.1], where: (lx, lz) => Math.hypot(lx - FOREST_RUINS.x, lz - FOREST_RUINS.z) < 34 },
  { kind: "elvenStatue", count: 7, scale: [0.95, 1.1], where: (lx, lz) => Math.hypot(lx - FOREST_RUINS.x, lz - FOREST_RUINS.z) < 34 },
  { kind: "brokenColumn", count: 14, scale: [0.9, 1.2], where: (lx) => lx > 38 },
];

export function placeForestProps(seed = 5151): PropPlacement[] {
  const zone = ZONES.floresta;
  const rand = seededRandom(seed);
  const out: PropPlacement[] = [];
  const world = (lx: number, lz: number) => ({ x: zone.center.x + lx, z: zone.center.z + lz });
  const push = (kind: PropKind, lx: number, lz: number, yaw: number, scale: number, sink = SINK) => {
    const p = world(lx, lz);
    out.push({ kind, x: p.x, y: terrainHeight(p.x, p.z) - sink, z: p.z, yaw, scale });
  };
  const free = (lx: number, lz: number) => {
    const p = world(lx, lz);
    if (isWater(p.x, p.z) || Math.abs(lz - forestRiverZ(lx)) < 6) return false;
    if (Math.hypot(lx - FOREST_CAMP.x, lz - FOREST_CAMP.z) < 15) return false;
    if (Math.hypot(lx - FOREST_BOSS_HOME.x, lz - FOREST_BOSS_HOME.z) < 20) return false;
    if (Math.hypot(lx - FOREST_SANCTUM.x, lz - FOREST_SANCTUM.z) < 6) return false; // portal do Santuário
    if (onTrail(p.x, p.z)) return false;
    return Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 6;
  };
  for (const s of FOREST_SCATTER) {
    let placed = 0;
    for (let tries = 0; placed < s.count && tries < s.count * 60; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 6), lz = (rand() * 2 - 1) * (zone.half - 6);
      const p = world(lx, lz);
      if (!free(lx, lz) || (s.where && !s.where(lx, lz, terrainHeight(p.x, p.z)))) continue;
      push(s.kind, lx, lz, rand() * Math.PI * 2, s.scale[0] + rand() * (s.scale[1] - s.scale[0]));
      placed++;
    }
  }
  // Vila do acampamento: barracas em roda, a fogueira no meio, o baú e a Pedra de Teleporte.
  push("tent", FOREST_CAMP.x - 9, FOREST_CAMP.z - 3, 0.9, 1, 0);
  push("tent", FOREST_CAMP.x + 10, FOREST_CAMP.z + 3, -2.2, 1, 0);
  push("tent", FOREST_CAMP.x + 11, FOREST_CAMP.z - 9, -1.0, 0.9, 0);
  push("tent", FOREST_CAMP.x - 11, FOREST_CAMP.z + 9, 2.4, 0.9, 0);
  push("campfire", FOREST_CAMP.x, FOREST_CAMP.z, 0, 1, 0);
  const camp = VILLAGES.acampamento;
  const local = (p: { x: number; z: number }) => ({ lx: p.x - zone.center.x, lz: p.z - zone.center.z });
  const st = local(camp.stash), sn = local(camp.stone);
  push("stash", st.lx, st.lz, Math.atan2(st.lx - FOREST_CAMP.x, st.lz - FOREST_CAMP.z), 1, 0);
  push("waystone", sn.lx, sn.lz, Math.atan2(sn.lx - FOREST_CAMP.x, sn.lz - FOREST_CAMP.z), 1, 0);
  // Clareira do Ente Ancião: anel de cogumelos azuis e árvores ancestrais em volta.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    push("glowMushrooms", FOREST_BOSS_HOME.x + Math.cos(a) * 15, FOREST_BOSS_HOME.z + Math.sin(a) * 15, a, 0.8 + (i % 3) * 0.15);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    push(i % 2 ? "giantTree1" : "giantTree2", FOREST_BOSS_HOME.x + Math.cos(a) * 24, FOREST_BOSS_HOME.z + Math.sin(a) * 24, a, 1.1);
  }
  return out;
}

/** Adereços dos Picos Gelados, em coordenadas locais da zona. */
const PEAKS_SCATTER: ForestScatter[] = [
  { kind: "pineSnow", count: 150, scale: [0.85, 1.3] },
  { kind: "frozenTree", count: 25, scale: [0.85, 1.2] },
  { kind: "snowRock1", count: 45, scale: [0.8, 1.6] },
  { kind: "snowRock2", count: 45, scale: [0.8, 1.6] },
  { kind: "iceCrystal", count: 18, scale: [0.7, 1.2], where: (lx, lz) => Math.hypot(lx - PEAKS_LAKE.x, lz - PEAKS_LAKE.z) < PEAKS_LAKE_RADIUS + 12 },
  { kind: "iceCrystal", count: 14, scale: [0.7, 1.3], where: (lx) => lx > 30 },
];

export function placePeaksProps(seed = 7171): PropPlacement[] {
  const zone = ZONES.picos;
  const rand = seededRandom(seed);
  const out: PropPlacement[] = [];
  const world = (lx: number, lz: number) => ({ x: zone.center.x + lx, z: zone.center.z + lz });
  const push = (kind: PropKind, lx: number, lz: number, yaw: number, scale: number, sink = SINK) => {
    const p = world(lx, lz);
    out.push({ kind, x: p.x, y: terrainHeight(p.x, p.z) - sink, z: p.z, yaw, scale });
  };
  /** Gira para o -Z local do modelo apontar para (tx, tz). */
  const facing = (lx: number, lz: number, tx: number, tz: number) => Math.atan2(lx - tx, lz - tz);
  const free = (lx: number, lz: number) => {
    const p = world(lx, lz);
    if (isIce(p.x, p.z) || onTrail(p.x, p.z)) return false;
    if (Math.hypot(lx - PEAKS_VILLAGE.x, lz - PEAKS_VILLAGE.z) < 22) return false;
    if (Math.hypot(lx - PEAKS_BOSS_HOME.x, lz - PEAKS_BOSS_HOME.z) < 20) return false;
    if (Math.hypot(lx - PEAKS_CAVE.x, lz - PEAKS_CAVE.z) < 12) return false;
    return Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 5;
  };
  for (const s of PEAKS_SCATTER) {
    let placed = 0;
    for (let tries = 0; placed < s.count && tries < s.count * 60; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 5), lz = (rand() * 2 - 1) * (zone.half - 5);
      const p = world(lx, lz);
      if (!free(lx, lz) || (s.where && !s.where(lx, lz, terrainHeight(p.x, p.z)))) continue;
      push(s.kind, lx, lz, rand() * Math.PI * 2, s.scale[0] + rand() * (s.scale[1] - s.scale[0]));
      placed++;
    }
  }
  // Vila de Pedra-Fria: cabanas em roda, viradas para a fogueira, o baú e a Pedra de Teleporte.
  const v = PEAKS_VILLAGE;
  for (const [dx, dz, s] of [[-16, -2, 1], [16, 0, 1], [-13, -15, 0.9], [13, -15, 0.95], [-17, 12, 0.85]] as const) {
    push("cabin", v.x + dx, v.z + dz, facing(v.x + dx, v.z + dz, v.x, v.z), s, 0);
  }
  push("campfire", v.x, v.z + 1, 0, 1, 0);
  const village = VILLAGES.pedraFria;
  const local = (p: { x: number; z: number }) => ({ lx: p.x - zone.center.x, lz: p.z - zone.center.z });
  const st = local(village.stash), sn = local(village.stone);
  push("stash", st.lx, st.lz, facing(st.lx, st.lz, v.x, v.z), 1, 0);
  push("waystone", sn.lx, sn.lz, facing(sn.lx, sn.lz, v.x, v.z), 1, 0);
  // Boca da Caverna de Gelo, atrás do portal, virada para o meio dos Picos.
  const away = Math.atan2(PEAKS_CAVE.x, PEAKS_CAVE.z);
  push("caveMouth", PEAKS_CAVE.x + Math.sin(away) * 3.2, PEAKS_CAVE.z + Math.cos(away) * 3.2, away, 1, 0.3);
  // Arena do Gigante: anel de pináculos de gelo e cristais entre eles.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    push("iceSpire", PEAKS_BOSS_HOME.x + Math.cos(a) * 17, PEAKS_BOSS_HOME.z + Math.sin(a) * 17, a * 3, 0.9 + (i % 3) * 0.15);
    const b = a + Math.PI / 8;
    push("iceCrystal", PEAKS_BOSS_HOME.x + Math.cos(b) * 19, PEAKS_BOSS_HOME.z + Math.sin(b) * 19, b, 0.8);
  }
  return out;
}

/** Adereços das Terras Vulcânicas, em coordenadas locais da zona. */
const VOLCANO_SCATTER: ForestScatter[] = [
  { kind: "basaltColumns", count: 30, scale: [0.8, 1.3] },
  { kind: "obsidian1", count: 40, scale: [0.8, 1.6] },
  { kind: "obsidian2", count: 40, scale: [0.8, 1.6] },
  { kind: "charredTree", count: 45, scale: [0.85, 1.25] },
  { kind: "lavaVent", count: 14, scale: [0.8, 1.2] },
  { kind: "boulder1", count: 15, scale: [0.8, 1.3] },
];

export function placeVolcanoProps(seed = 9393): PropPlacement[] {
  const zone = ZONES.vulcao;
  const rand = seededRandom(seed);
  const out: PropPlacement[] = [];
  const world = (lx: number, lz: number) => ({ x: zone.center.x + lx, z: zone.center.z + lz });
  const push = (kind: PropKind, lx: number, lz: number, yaw: number, scale: number, sink = SINK) => {
    const p = world(lx, lz);
    out.push({ kind, x: p.x, y: terrainHeight(p.x, p.z) - sink, z: p.z, yaw, scale });
  };
  const facing = (lx: number, lz: number, tx: number, tz: number) => Math.atan2(lx - tx, lz - tz);
  const free = (lx: number, lz: number) => {
    const p = world(lx, lz);
    if (onTrail(p.x, p.z)) return false;
    for (const [dx, dz] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]] as const) if (isLava(p.x + dx, p.z + dz)) return false;
    if (Math.hypot(lx - VOLCANO_FORT.x, lz - VOLCANO_FORT.z) < 22) return false;
    if (Math.hypot(lx - VOLCANO_CALDERA.x, lz - VOLCANO_CALDERA.z) < 22) return false;
    if (Math.hypot(lx - VOLCANO_FORGE.x, lz - VOLCANO_FORGE.z) < 12) return false;
    return Math.max(Math.abs(lx), Math.abs(lz)) < zone.half - 5;
  };
  for (const s of VOLCANO_SCATTER) {
    let placed = 0;
    for (let tries = 0; placed < s.count && tries < s.count * 60; tries++) {
      const lx = (rand() * 2 - 1) * (zone.half - 5), lz = (rand() * 2 - 1) * (zone.half - 5);
      if (!free(lx, lz)) continue;
      push(s.kind, lx, lz, rand() * Math.PI * 2, s.scale[0] + rand() * (s.scale[1] - s.scale[0]));
      placed++;
    }
  }
  // Bastião de Brasa: casas de pedra em roda, fogueira, baú e Pedra de Teleporte.
  const v = VOLCANO_FORT;
  for (const [dx, dz, s] of [[-16, -2, 1], [16, 0, 1], [-13, -15, 0.9], [13, -15, 0.95], [-17, 12, 0.85], [17, 13, 0.85]] as const) {
    push("stoneHut", v.x + dx, v.z + dz, facing(v.x + dx, v.z + dz, v.x, v.z), s, 0);
  }
  push("campfire", v.x, v.z + 1, 0, 1, 0);
  const village = VILLAGES.bastiao;
  const local = (p: { x: number; z: number }) => ({ lx: p.x - zone.center.x, lz: p.z - zone.center.z });
  const st = local(village.stash), sn = local(village.stone);
  push("stash", st.lx, st.lz, facing(st.lx, st.lz, v.x, v.z), 1, 0);
  push("waystone", sn.lx, sn.lz, facing(sn.lx, sn.lz, v.x, v.z), 1, 0);
  // Boca da Forja, atrás do portal, virada para o meio da zona.
  const away = Math.atan2(VOLCANO_FORGE.x, VOLCANO_FORGE.z);
  push("forgeMouth", VOLCANO_FORGE.x + Math.sin(away) * 3.2, VOLCANO_FORGE.z + Math.cos(away) * 3.2, away, 1, 0.3);
  // Caldeira: colunas de basalto na borda e respiros em volta do lago de lava.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    if (Math.sin(a) > 0.85) continue; // entrada sul livre
    push("basaltColumns", VOLCANO_CALDERA.x + Math.cos(a) * 24, VOLCANO_CALDERA.z + Math.sin(a) * 24, a, 0.9 + (i % 3) * 0.12);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    push("lavaVent", VOLCANO_LAVA_LAKE.x + Math.cos(a) * 19, VOLCANO_LAVA_LAKE.z + Math.sin(a) * 19, a, 0.9);
  }
  return out;
}

export interface Environment {
  group: THREE.Group;
  props: PropField;
  /** Atualiza o nível de detalhe pela câmera e monta um modelo completo pendente por quadro. */
  update(camera: THREE.Camera): void;
}

/** Árvores, pedras e marcos de uma zona, com a barraca de quem vende na vila. */
export function createEnvironment(seed = 4242, zone: ZoneDefinition = ZONES.vale): Environment {
  const group = new THREE.Group();
  const props = new PropField(zone.id === "floresta" ? placeForestProps() : zone.id === "picos" ? placePeaksProps() : zone.id === "vulcao" ? placeVolcanoProps() : placeProps(seed));
  group.add(props.group);
  // Barraca de quem vende, atrás do vendedor, com o balcão virado para o centro da vila.
  const villageCenter = { vale: { x: 0, z: 0 }, floresta: FOREST_CAMP, picos: PEAKS_VILLAGE, vulcao: VOLCANO_FORT }[zone.id];
  const center = { x: zone.center.x + villageCenter.x, z: zone.center.z + villageCenter.z };
  const seller = zone.id === "vale" ? { x: 6, z: 3.5 } : { x: center.x - 7, z: center.z + 4 };
  const outward = Math.atan2(seller.x - center.x, seller.z - center.z);
  const stall = new THREE.Mesh(stallGeometry(), voxelMaterial());
  stall.castShadow = stall.receiveShadow = true;
  stall.position.set(seller.x + Math.sin(outward) * 1.6, terrainHeight(seller.x, seller.z), seller.z + Math.cos(outward) * 1.6);
  stall.rotation.y = outward; // o -Z local (frente do balcão) aponta para o centro
  group.add(stall);

  return {
    group,
    props,
    update: (camera) => {
      props.buildPending();
      props.update(camera);
    },
  };
}

/**
 * Barraca da Mercadora, em voxels de 1/8 m: balcão de madeira com potes e moedas, toldo listrado
 * em turquesa e creme, caixotes ao lado. A frente (balcão) fica para -Z.
 */
export function stallGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const wood = "#7a5230", woodDark = "#5a3a20", woodLight = "#9a6a40";
  // Balcão.
  b.box(-12, 0, -4, 12, 8, 2, wood).box(-12, 8, -5, 12, 9, 3, woodLight);
  for (const x of [-12, -4, 4, 11]) b.box(x, 0, -5, x + 1, 8, -4, woodDark);
  // Postes e toldo listrado inclinado.
  for (const x of [-12, 11]) {
    b.box(x, 0, -6, x + 1, 22, -5, woodDark);
    b.box(x, 0, 6, x + 1, 25, 7, woodDark);
  }
  for (let z = -8; z <= 8; z++) {
    const y = 23 + Math.round((z + 8) / 6);
    for (let x = -13; x <= 13; x++) b.set(x, y, z, Math.floor((x + 13) / 3) % 2 ? "#2f8a7a" : "#ece2c8");
  }
  for (let x = -13; x <= 13; x++) if (x % 2 === 0) b.set(x, 22, -8, Math.floor((x + 13) / 3) % 2 ? "#2f8a7a" : "#ece2c8"); // franja
  // Mercadorias no balcão: potes vermelhos e verdes, pilha de moedas, um tecido dobrado.
  b.box(-10, 9, -3, -7, 13, 0, "#b8322f").box(-10, 13, -3, -7, 14, 0, "#d84a3f").box(-9, 14, -2, -8, 15, -1, woodDark);
  b.box(-5, 9, -3, -3, 12, -1, "#4f9a3a").box(-5, 12, -3, -3, 13, -1, "#6fc04a");
  b.box(0, 9, -3, 3, 10, 0, "#d4a92a").box(1, 10, -2, 3, 11, 0, "#f0d070").set(2, 11, -1, "#f0d070");
  b.box(5, 9, -3, 10, 11, 1, "#7d5cc0").box(5, 11, -3, 10, 12, 1, "#9a7ad8");
  // Caixotes ao lado.
  b.box(13, 0, -2, 19, 6, 4, wood).box(13, 5, -2, 19, 6, 4, woodLight).box(15, 6, -1, 19, 10, 3, woodDark);
  for (const z of [-2, 3]) b.box(13, 0, z, 19, 6, z + 1, woodDark);
  return b.build(1 / 8, { grain: 0.05, grainScale: 2 });
}

/** Perto da trilha de uma passagem (da boca até uns 14 m para dentro): fica livre de cenário. */
export function onTrail(x: number, z: number, margin = 6): boolean {
  return ZONE_PASSAGES.some((g) => {
    const dx = x - g.at.x, dz = z - g.at.z;
    const inward = -(dx * g.out.x + dz * g.out.z);
    const side = Math.abs(dx * g.out.z - dz * g.out.x);
    return inward > -8 && inward < 16 && side < g.width + margin;
  });
}

function randomPoint(rand: () => number, minRadius: number, biome?: Biome, height?: [number, number]): { x: number; z: number } | null {
  for (let tries = 0; tries < 4000; tries++) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 6);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 6);
    if (Math.hypot(x, z) < minRadius) continue;
    if (Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < 15) continue; // arenas dos chefes livres
    if (Math.hypot(x - SWAMP_BOSS_HOME.x, z - SWAMP_BOSS_HOME.z) < 15) continue;
    if (Math.hypot(x - DESERT_BOSS_HOME.x, z - DESERT_BOSS_HOME.z) < 16) continue;
    if (biome && biomeAt(x, z) !== biome) continue;
    if (isWater(x, z)) continue;
    if (Math.hypot(x - DUNGEON_ENTRANCE.x, z - DUNGEON_ENTRANCE.z) < 5) continue; // portal da cripta
    if (onTrail(x, z)) continue; // trilhas das passagens entre zonas
    if (height) {
      const h = terrainHeight(x, z);
      if (h < height[0] || h > height[1]) continue;
    }
    return { x, z };
  }
  return null;
}

/**
 * Braseiros sobre os pilares do santuário: uma cuba de ferro e uma chama que tremula. De dia a
 * chama é discreta; à noite ela brilha (bloom) e uma luz quente ilumina a praça.
 */
export function createBraziers(): { group: THREE.Group; update: (time: number, night: number) => void } {
  const group = new THREE.Group();
  const bowl = new VoxelBuilder()
    .box(-2, 0, -2, 2, 1, 2, "#3a3632")
    .box(-3, 1, -3, 3, 2, 3, "#4a4540")
    .carve(-2, 1, -2, 2, 2, 2)
    .box(-2, 1, -2, 2, 2, 2, "#2a1a12")
    .build(1 / 8, { jitter: 0.04 });
  const flame = new VoxelBuilder()
    .box(-2, 0, -2, 2, 2, 2, "#ff7a1a")
    .box(-1, 2, -1, 2, 4, 1, "#ffb43a")
    .box(-1, 4, 0, 1, 5, 1, "#ffe08a")
    .set(1, 3, 1, "#ffb43a")
    .build(1 / 8, { jitter: 0, ao: false });
  const flameMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const count = 8;
  const bowls = new THREE.InstancedMesh(bowl, voxelMaterial(), count);
  const flames = new THREE.InstancedMesh(flame, flameMaterial, count);
  bowls.castShadow = true;
  const dummy = new THREE.Object3D();
  const top = terrainHeight(0, 0) + 1.5; // altura do pilar (6 voxels de 1/4 m)
  const spots: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const p = new THREE.Vector3(Math.round(Math.cos(a) * 8) + 0.5, top, Math.round(Math.sin(a) * 8) + 0.5);
    spots.push(p);
    dummy.position.copy(p);
    dummy.updateMatrix();
    bowls.setMatrixAt(i, dummy.matrix);
  }
  const light = new THREE.PointLight("#ff9a4a", 0, 26, 1.4);
  light.position.set(0, top + 1.5, 0);
  group.add(bowls, flames, light);

  const update = (time: number, night: number): void => {
    for (let i = 0; i < count; i++) {
      const p = spots[i]!;
      const flick = 1 + Math.sin(time * 9 + i * 1.7) * 0.12 + Math.sin(time * 15.3 + i) * 0.06;
      dummy.position.set(p.x, p.y + 0.25, p.z);
      dummy.rotation.set(0, time * 0.8 + i, 0);
      dummy.scale.set(1, flick * (0.85 + night * 0.35), 1);
      dummy.updateMatrix();
      flames.setMatrixAt(i, dummy.matrix);
    }
    flames.instanceMatrix.needsUpdate = true;
    // De dia, cor normal; à noite, acima de 1 para acender no bloom.
    flameMaterial.color.setScalar(1 + night * 1.4);
    light.intensity = night * (14 + Math.sin(time * 11) * 1.5);
  };
  update(0, 0);
  return { group, update };
}
