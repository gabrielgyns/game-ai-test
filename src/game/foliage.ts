import * as THREE from "three";
import { biomeWeights, DESERT_BOSS_HOME, SWAMP_BOSS_HOME } from "../domain/biomes";
import { isWater, terrainHeight, WATER_LEVEL, WORLD_HALF } from "../domain/terrain";
import { BOSS_HOME, seededRandom } from "../domain/worldgen";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/**
 * Vegetação rasteira: tufos de grama, flores, juncos e capim seco, em voxels de 6 cm.
 * São dezenas de milhares de instâncias, então:
 * - ficam em blocos de 32 m (um InstancedMesh por tipo e bloco), para o recorte de câmera e de
 *   distância descartar o que está longe;
 * - balançam ao vento e se abrem quando o herói passa, tudo no shader (nenhum custo na CPU).
 */
const FV = 1 / 16;
const CHUNK = 24;
/** Blocos de grama além disso somem; flores e juncos vão um pouco mais longe. */
const VIEW_DISTANCE = 58;
const VIEW_DISTANCE_TALL = 72;
/** A partir daqui o bloco desenha só uma fração das instâncias (estão embaralhadas). */
const FULL_DETAIL_DISTANCE = 30;
const FAR_FRACTION = 0.35;

type Kind = "grass" | "flowerRed" | "flowerYellow" | "flowerWhite" | "flowerBlue" | "reed";

function blade(b: VoxelBuilder, x: number, z: number, h: number, color: string): void {
  b.box(x, 0, z, x + 1, h, z + 1, color);
}

function grassGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  blade(b, 0, 0, 6, "#6aa846");
  blade(b, 2, 1, 4, "#7ab84e");
  blade(b, -2, 2, 5, "#64a044");
  blade(b, 1, -2, 7, "#74b24c");
  blade(b, -1, -1, 3, "#80bc54");
  return b.build(FV, { jitter: 0, ao: false, skipGroundFaces: true });
}

function flowerGeometry(petal: string, center: string): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  blade(b, 0, 0, 7, "#4f8f3a");
  b.set(1, 2, 0, "#5f9c40").set(-1, 3, 0, "#5f9c40"); // folhas
  b.box(-1, 7, -1, 2, 8, 2, petal).set(0, 8, -2, petal).set(0, 8, 2, petal).set(-2, 8, 0, petal).set(2, 8, 0, petal);
  b.set(0, 8, 0, center);
  return b.build(FV, { jitter: 0, ao: false, skipGroundFaces: true });
}

function reedGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  blade(b, 0, 0, 13, "#5d7a3a");
  b.box(0, 13, 0, 1, 17, 1, "#6b4a2b"); // espiga da taboa
  blade(b, 3, 1, 10, "#6e8a45");
  blade(b, -2, -2, 8, "#4f6b33");
  blade(b, 1, -3, 11, "#5d7a3a");
  return b.build(FV, { jitter: 0, ao: false, skipGroundFaces: true });
}

const GEOMETRIES: Record<Kind, () => THREE.BufferGeometry> = {
  grass: grassGeometry,
  flowerRed: () => flowerGeometry("#e5484d", "#ffd54a"),
  flowerYellow: () => flowerGeometry("#ffd54a", "#c9822a"),
  flowerWhite: () => flowerGeometry("#f4f1e8", "#ffd54a"),
  flowerBlue: () => flowerGeometry("#7d8cf0", "#f4f1e8"),
  reed: reedGeometry,
};

/** Peças de vegetação para a vitrine (/lab). */
export const FOLIAGE_BUILDERS: Record<string, () => THREE.BufferGeometry> = {
  "Tufo de grama": grassGeometry,
  "Flor vermelha": GEOMETRIES.flowerRed,
  "Flor amarela": GEOMETRIES.flowerYellow,
  "Flor branca": GEOMETRIES.flowerWhite,
  "Flor azul": GEOMETRIES.flowerBlue,
  "Junco do pântano": reedGeometry,
};

/** Ruído suave por valor, para a grama crescer em manchas e as flores em canteiros. */
function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const h = (i: number, j: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * sx;
  const c = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * sx;
  return a + (c - a) * sz;
}

interface Placement {
  kind: Kind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  tint: THREE.Color;
}

/** Decide o que cresce em cada metro quadrado do mapa. Determinístico pela seed. */
function placeFoliage(seed: number): Placement[] {
  const rand = seededRandom(seed);
  const out: Placement[] = [];
  const tint = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
  const flowerKinds: Kind[] = ["flowerRed", "flowerYellow", "flowerWhite", "flowerBlue"];

  for (let cx = -WORLD_HALF + 1; cx < WORLD_HALF - 1; cx++) {
    for (let cz = -WORLD_HALF + 1; cz < WORLD_HALF - 1; cz++) {
      const mx = cx + 0.5, mz = cz + 0.5;
      if (Math.hypot(mx, mz) < 10) continue; // praça de areia do santuário
      if (Math.hypot(mx - BOSS_HOME.x, mz - BOSS_HOME.z) < 9) continue;
      if (Math.hypot(mx - SWAMP_BOSS_HOME.x, mz - SWAMP_BOSS_HOME.z) < 9) continue;
      if (Math.hypot(mx - DESERT_BOSS_HOME.x, mz - DESERT_BOSS_HOME.z) < 14) continue;
      const h = terrainHeight(mx, mz);
      if (h > 7 || isWater(mx, mz)) continue; // pedra, neve e água
      const w = biomeWeights(mx);
      const patch = valueNoise(mx / 9, mz / 9, seed);
      const bed = valueNoise(mx / 5 + 40, mz / 5 - 13, seed);

      // Quantos tufos neste metro: campina densa em manchas, pântano médio, deserto ralo.
      const density = w.meadow * (0.2 + patch * 1.1) + w.swamp * (0.2 + patch * 0.45) + w.desert * 0.06;
      let count = Math.floor(density + rand());
      while (count-- > 0) {
        const px = cx + 0.2 + rand() * 0.6, pz = cz + 0.2 + rand() * 0.6;
        const k = 0.88 + rand() * 0.24;
        // Cor: verde vivo na campina, oliva no pântano, palha no deserto.
        const c = tint(k, k, k);
        if (w.swamp > 0.5) c.multiply(tint(0.72, 0.8, 0.62));
        else if (w.desert > 0.5) c.multiply(tint(1.25, 1.05, 0.55));
        else if (h > 4) c.multiply(tint(1.08, 1.02, 0.78)); // capim mais seco nas encostas
        out.push({ kind: "grass", x: px, y: h, z: pz, yaw: Math.floor(rand() * 4) * (Math.PI / 2), scale: 0.8 + rand() * 0.6, tint: c });
      }
      // Flores em canteiros na campina.
      if (w.meadow > 0.6 && bed > 0.64 && rand() < 0.5) {
        const kind = flowerKinds[Math.floor(valueNoise(mx / 14, mz / 14, seed + 3) * 4) % 4]!;
        out.push({ kind, x: cx + 0.2 + rand() * 0.6, y: h, z: cz + 0.2 + rand() * 0.6, yaw: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.4, tint: tint(1, 1, 1) });
      }
      // Juncos na beira da água do pântano.
      if (w.swamp > 0.6 && h <= WATER_LEVEL + 1.5 && rand() < 0.3) {
        out.push({ kind: "reed", x: cx + 0.2 + rand() * 0.6, y: h, z: cz + 0.2 + rand() * 0.6, yaw: Math.floor(rand() * 4) * (Math.PI / 2), scale: 0.9 + rand() * 0.5, tint: tint(1, 1, 1) });
      }
    }
  }
  return out;
}

/** Shader de vento e "pisada": desloca o vértice no mundo, proporcional à altura dentro do tufo. */
function foliageMaterial(uniforms: { uTime: { value: number }; uPlayer: { value: THREE.Vector3 } }): THREE.MeshStandardMaterial {
  const material = voxelMaterial();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uPlayer = uniforms.uPlayer;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform vec3 uPlayer;")
      .replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  vec3 tuftOrigin = instanceMatrix[3].xyz;
#else
  vec3 tuftOrigin = vec3(0.0);
#endif
float tuftHeight = max(mvPosition.y - tuftOrigin.y, 0.0);
float wave = sin(uTime * 1.7 + tuftOrigin.x * 0.37 + tuftOrigin.z * 0.29) * 0.7 + sin(uTime * 3.1 + tuftOrigin.x * 1.3 - tuftOrigin.z * 0.7) * 0.3;
vec2 bend = vec2(wave, wave * 0.45) * 0.22 * tuftHeight;
vec2 away = tuftOrigin.xz - uPlayer.xz;
float dist = length(away);
float push = (1.0 - smoothstep(0.25, 1.3, dist)) * step(abs(tuftOrigin.y - uPlayer.y), 1.5);
bend += (dist > 0.001 ? away / dist : vec2(0.0)) * push * 0.9 * tuftHeight;
mvPosition.xz += bend;
mvPosition.y -= push * tuftHeight * 0.35;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => "foliage-wind";
  return material;
}

export class Foliage {
  readonly group = new THREE.Group();
  private readonly chunks: { mesh: THREE.InstancedMesh; center: THREE.Vector2; full: number; range: number }[] = [];
  private readonly uniforms = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3(0, -999, 0) } };
  /** Instâncias por tipo (para medir e testar). */
  readonly counts: Record<Kind, number> = { grass: 0, flowerRed: 0, flowerYellow: 0, flowerWhite: 0, flowerBlue: 0, reed: 0 };

  constructor(seed = 9173) {
    const material = foliageMaterial(this.uniforms);
    const geometries = new Map<Kind, THREE.BufferGeometry>();
    const buckets = new Map<string, Placement[]>();
    for (const p of placeFoliage(seed)) {
      const key = `${p.kind}|${Math.floor(p.x / CHUNK)}|${Math.floor(p.z / CHUNK)}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(p);
      this.counts[p.kind]++;
    }
    const dummy = new THREE.Object3D();
    for (const [key, list] of buckets) {
      const [kind, ix, iz] = key.split("|") as [Kind, string, string];
      let geometry = geometries.get(kind);
      if (!geometry) geometries.set(kind, (geometry = GEOMETRIES[kind]()));
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      // Embaralha para que "as primeiras N" instâncias sejam uma amostra espalhada do bloco (LOD).
      const shuffle = seededRandom(list.length * 31 + Number(ix) * 977 + Number(iz));
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(shuffle() * (i + 1));
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, p.tint);
      });
      mesh.computeBoundingSphere(); // recorte de câmera por bloco
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      this.chunks.push({
        mesh,
        center: new THREE.Vector2((Number(ix) + 0.5) * CHUNK, (Number(iz) + 0.5) * CHUNK),
        full: list.length,
        range: kind === "grass" ? VIEW_DISTANCE : VIEW_DISTANCE_TALL,
      });
      this.group.add(mesh);
    }
  }

  update(time: number, player: { x: number; y: number; z: number }): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uPlayer.value.set(player.x, player.y, player.z);
    for (const c of this.chunks) {
      const d = Math.hypot(c.center.x - player.x, c.center.y - player.z);
      c.mesh.visible = d < c.range;
      if (c.mesh.visible) c.mesh.count = d < FULL_DETAIL_DISTANCE ? c.full : Math.max(1, Math.round(c.full * FAR_FRACTION));
    }
  }
}
