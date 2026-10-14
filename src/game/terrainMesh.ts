import * as THREE from "three";
import { CELL_SIZE, STEP_HEIGHT, terrainHeight, WORLD_HALF } from "../domain/terrain";
import { clamp } from "../domain/math";
import { voxelMaterial } from "./voxel";
import { biomeWeights } from "../domain/biomes";
import { forestRiverZ, isIce, isLava, isWater, PEAKS_VILLAGE, VOLCANO_CALDERA, VOLCANO_FORT, WATER_LEVEL } from "../domain/terrain";
import { ZONES, type ZoneDefinition } from "../domain/zones";

const GRASS = new THREE.Color("#79b857");
const GRASS_DRY = new THREE.Color("#a3b85a");
const DIRT = new THREE.Color("#8a5f3b");
const STONE = new THREE.Color("#7d7a70");
const SAND = new THREE.Color("#d8c88f");
const SNOW = new THREE.Color("#e9eef2");
const SWAMP_GRASS = new THREE.Color("#4f6b3a");
const SWAMP_MUD = new THREE.Color("#4a3d2c");
const WATER = new THREE.Color("#2f5f7a");
const DESERT_SAND = new THREE.Color("#e0c47f");
const DESERT_DARK = new THREE.Color("#c9a85f");
const MOSS = new THREE.Color("#3f6a32");
const MOSS_DARK = new THREE.Color("#2a4a26");
const FOREST_DIRT = new THREE.Color("#5a4430");
const FOREST_WATER_COLOR = new THREE.Color("#2a5a5a");
const RUIN_STONE = new THREE.Color("#8a8a7e");
const PEAK_SNOW = new THREE.Color("#eef3f8");
const PEAK_SNOW_SHADE = new THREE.Color("#cfdbe8");
const PEAK_ROCK = new THREE.Color("#6a7280");
const PEAK_ROCK_DARK = new THREE.Color("#4e5562");
const ICE = new THREE.Color("#9fd4ec");
const ICE_DEEP = new THREE.Color("#5fa8d0");
const PACKED_SNOW = new THREE.Color("#b8b0a4");
const BASALT = new THREE.Color("#3a3536");
const BASALT_DARK = new THREE.Color("#2a2628");
const ASH = new THREE.Color("#5e5856");
const SCORCH = new THREE.Color("#4a2e24");
const LAVA_CRUST = new THREE.Color("#3a1a10");
const FORT_DIRT = new THREE.Color("#6a4e3e");

/**
 * Terreno em blocos: uma coluna por célula. Gera a face de cima de cada coluna e as
 * laterais expostas onde a vizinha é mais baixa (como um mundo de cubos, sem os cubos
 * escondidos). Usa exatamente a mesma terrainHeight do domínio.
 */
export function createTerrainMesh(zone: ZoneDefinition = ZONES.vale): THREE.Mesh {
  const cells = Math.ceil((WORLD_HALF * 2) / CELL_SIZE);
  const origin = -WORLD_HALF;
  const ox = zone.center.x, oz = zone.center.z;
  const forest = zone.id === "floresta";
  const peaks = zone.id === "picos";
  const volcano = zone.id === "vulcao";
  const heights = new Float32Array((cells + 2) * (cells + 2));
  const idx = (i: number, j: number) => (i + 1) * (cells + 2) + (j + 1);
  for (let i = -1; i <= cells; i++)
    for (let j = -1; j <= cells; j++)
      heights[idx(i, j)] = terrainHeight(ox + origin + (i + 0.5) * CELL_SIZE, oz + origin + (j + 0.5) * CELL_SIZE);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();

  const quad = (pts: [number, number, number][], n: [number, number, number], color: THREE.Color) => {
    const base = positions.length / 3;
    for (const p of pts) {
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0], n[1], n[2]);
      colors.push(color.r, color.g, color.b);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const h = heights[idx(i, j)]!;
      const x0 = ox + origin + i * CELL_SIZE, x1 = x0 + CELL_SIZE;
      const z0 = oz + origin + j * CELL_SIZE, z1 = z0 + CELL_SIZE;
      const cx = x0 + CELL_SIZE / 2, cz = z0 + CELL_SIZE / 2;

      // Topo: cor por bioma (altura e distância do centro) com variação sutil por célula.
      const dist = Math.hypot(cx, cz);
      const w = biomeWeights(cx);
      const isWaterCell = forest ? isWater(cx, cz) : w.swamp > 0.5 && h <= WATER_LEVEL;
      if (volcano) {
        // Vulcão: basalto escuro, cinza nas partes planas, chão chamuscado perto da lava e terra no forte.
        const lx = cx - ox, lz = cz - oz;
        const nearLava = isLava(cx + 1.5, cz) || isLava(cx - 1.5, cz) || isLava(cx, cz + 1.5) || isLava(cx, cz - 1.5);
        const fort = Math.hypot(lx - VOLCANO_FORT.x, lz - VOLCANO_FORT.z) < 9 || (lz > VOLCANO_FORT.z && Math.abs(lx) < 1.6);
        const caldera = Math.hypot(lx - VOLCANO_CALDERA.x, lz - VOLCANO_CALDERA.z) < 17;
        if (isLava(cx, cz)) c.copy(LAVA_CRUST);
        else if (nearLava) c.copy(SCORCH).lerp(BASALT_DARK, hash(i, j) * 0.5);
        else if (fort) c.copy(FORT_DIRT).lerp(ASH, hash(i * 3, j) * 0.4);
        else if (caldera) c.copy(BASALT_DARK).lerp(SCORCH, hash(i, j * 5) * 0.6);
        else c.copy(BASALT).lerp(ASH, clamp(valueAsh(lx, lz) + hash(i, j * 7) * 0.2, 0, 1));
      } else if (peaks) {
        // Picos: neve (sombreada nos vales), pedra nas encostas íngremes, gelo no lago e neve pisada na vila.
        const lx = cx - ox, lz = cz - oz;
        const steep = Math.max(
          Math.abs(h - heights[idx(i + 1, j)]!), Math.abs(h - heights[idx(i - 1, j)]!),
          Math.abs(h - heights[idx(i, j + 1)]!), Math.abs(h - heights[idx(i, j - 1)]!),
        );
        const plaza = Math.hypot(lx - PEAKS_VILLAGE.x, lz - PEAKS_VILLAGE.z) < 9 || (lz > PEAKS_VILLAGE.z && Math.abs(lx) < 1.6);
        if (isIce(cx, cz)) {
          const streak = Math.abs(Math.sin(lx * 0.35 + lz * 0.6) + Math.sin(lx * 0.13 - lz * 0.2)) < 0.12;
          c.copy(ICE).lerp(ICE_DEEP, clamp(hash(i, j * 3) * 0.35 + (streak ? 0.5 : 0), 0, 1));
        } else if (steep >= 1.5) c.copy(PEAK_ROCK).lerp(PEAK_ROCK_DARK, hash(i * 5, j));
        else if (plaza) c.copy(PACKED_SNOW).lerp(PEAK_SNOW_SHADE, hash(i, j * 5) * 0.6);
        else c.copy(PEAK_SNOW).lerp(PEAK_SNOW_SHADE, clamp((4 - h) / 10 + hash(i, j * 7) * 0.25, 0, 1));
      } else if (forest) {
        // Floresta: musgo escuro, terra de trilha perto do rio, pedra nas ruínas e nos penhascos.
        const lx = cx - ox, lz = cz - oz;
        // Pátio de lajes no centro das ruínas (com juntas), o resto é mata com musgo.
        const ruins = Math.hypot(lx - 70, lz - 6) < 14 && (Math.floor(lx / 2) + Math.floor(lz / 2)) % 5 !== 0;
        const bank = Math.abs(lz - forestRiverZ(lx)) < 10;
        if (isWaterCell) c.copy(FOREST_WATER_COLOR);
        else if (h > 7) c.copy(STONE);
        else if (ruins) c.copy(RUIN_STONE).lerp(MOSS, hash(i * 3, j) * 0.5);
        else if (bank) c.copy(FOREST_DIRT).lerp(MOSS, 0.35);
        else c.copy(MOSS).lerp(MOSS_DARK, clamp(hash(i, j * 7) * 0.6 + (2 - h) / 8, 0, 1));
      } else if (dist < 9) c.copy(SAND);
      else if (h > 11) c.copy(SNOW);
      else if (h > 7) c.copy(STONE);
      else {
        const meadow = GRASS.clone().lerp(GRASS_DRY, clamp((h + 2) / 9, 0, 1));
        const swamp = isWaterCell ? WATER.clone() : SWAMP_GRASS.clone().lerp(SWAMP_MUD, clamp((WATER_LEVEL + 1.5 - h) / 2, 0, 1));
        const desert = DESERT_SAND.clone().lerp(DESERT_DARK, clamp((h + 1) / 6, 0, 1));
        c.copy(meadow).multiplyScalar(w.meadow).add(swamp.multiplyScalar(w.swamp)).add(desert.multiplyScalar(w.desert));
      }
      c.multiplyScalar(isWaterCell ? 0.98 + hash(i, j) * 0.04 : 0.94 + hash(i, j) * 0.12);
      quad([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], [0, 1, 0], c);

      // Laterais expostas: terra (ou pedra quando alto); areia no deserto, lama no pântano.
      const sideBase = volcano ? BASALT_DARK : peaks ? PEAK_ROCK : h > 7 ? STONE : forest ? FOREST_DIRT : w.desert > 0.5 ? DESERT_DARK : w.swamp > 0.5 ? SWAMP_MUD : DIRT;
      const grassTop = volcano ? BASALT : peaks ? PEAK_SNOW : forest ? MOSS : w.desert > 0.5 ? DESERT_SAND : w.swamp > 0.5 ? SWAMP_GRASS : GRASS;
      const sides: { nh: number; n: [number, number, number]; pts: (y0: number, y1: number) => [number, number, number][] }[] = [
        { nh: heights[idx(i + 1, j)]!, n: [1, 0, 0], pts: (a, b) => [[x1, a, z0], [x1, b, z0], [x1, b, z1], [x1, a, z1]] },
        { nh: heights[idx(i - 1, j)]!, n: [-1, 0, 0], pts: (a, b) => [[x0, a, z1], [x0, b, z1], [x0, b, z0], [x0, a, z0]] },
        { nh: heights[idx(i, j + 1)]!, n: [0, 0, 1], pts: (a, b) => [[x1, a, z1], [x1, b, z1], [x0, b, z1], [x0, a, z1]] },
        { nh: heights[idx(i, j - 1)]!, n: [0, 0, -1], pts: (a, b) => [[x0, a, z0], [x0, b, z0], [x1, b, z0], [x1, a, z0]] },
      ];
      for (const s of sides) {
        if (s.nh >= h) continue;
        // Uma faixa por degrau, com a faixa logo abaixo do topo em tom de grama (como Minecraft).
        for (let y = s.nh; y < h - 1e-6; y += STEP_HEIGHT) {
          const top = y + STEP_HEIGHT >= h - 1e-6;
          c.copy(top && (h <= 7 || peaks) ? grassTop : sideBase).multiplyScalar((0.8 + hash(i + y, j) * 0.1) * (s.n[0] !== 0 ? 0.9 : 0.8));
          quad(s.pts(y, y + STEP_HEIGHT), s.n, c);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, voxelMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

/** Manchas de cinza no basalto. */
function valueAsh(x: number, z: number): number {
  return Math.max(0, Math.sin(x * 0.09 + 1.7) * Math.cos(z * 0.08 - 0.4) + Math.sin((x - z) * 0.04) * 0.5) * 0.7;
}

function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
