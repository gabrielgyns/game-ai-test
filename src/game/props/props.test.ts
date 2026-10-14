import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DESERT_BOSS_HOME, SWAMP_BOSS_HOME, biomeAt } from "../../domain/biomes";
import { DUNGEON_ENTRANCE } from "../../domain/dungeon";
import { isWater, terrainHeight } from "../../domain/terrain";
import { BOSS_HOME } from "../../domain/worldgen";
import { placeProps } from "../environment";
import { builderToVox } from "../vox";
import { buildLods, loadVoxOverrides, PROP_MODELS, propVoxels, type PropKind } from "./catalog";
import { LOD_HI, LOD_MID, PropField } from "./field";
import { blob, limb } from "./sculpt";
import { VoxelBuilder } from "../voxel";

const tris = (g: THREE.BufferGeometry) => g.getIndex()!.count / 3;

describe("escultura", () => {
  it("limb faz uma cápsula que afina; blob respeita o chão", () => {
    const b = new VoxelBuilder();
    limb(b, [0, 0, 0], [0, 20, 0], 4, 1, () => "#6b4a2b");
    expect(b.has(3, 1, 0)).toBe(true); // largo embaixo
    expect(b.has(3, 19, 0)).toBe(false); // fino em cima
    const r = new VoxelBuilder();
    blob(r, [0, 2, 0], [6, 6, 6], () => "#777", { floor: 0, rough: 0 });
    let minY = Infinity;
    r.forEach((_x, y) => (minY = Math.min(minY, y)));
    expect(minY).toBe(0);
  });
});

describe("catálogo do cenário", () => {
  const kinds = Object.keys(PROP_MODELS) as PropKind[];

  it("todo modelo apoia no chão, cabe num .vox e respeita o orçamento de triângulos", () => {
    for (const kind of kinds) {
      const voxels = propVoxels(kind);
      const { min, max } = voxels.bounds();
      expect(min[1], kind).toBeGreaterThanOrEqual(0);
      expect(min[1], kind).toBeLessThanOrEqual(1);
      expect(Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]), kind).toBeLessThanOrEqual(256);
      expect(() => builderToVox(voxels)).not.toThrow();
      const lods = buildLods(kind);
      // O completo é o mais caro, e cada nível de longe custa bem menos que o anterior.
      expect(tris(lods.hi), kind).toBeLessThan(60000);
      expect(tris(lods.mid), kind).toBeLessThan(tris(lods.hi) * 0.5);
      expect(tris(lods.lo), kind).toBeLessThanOrEqual(tris(lods.mid));
    }
  }, 30000);

  it("o pilar do santuário tem 1,5 m, a altura em que o braseiro se apoia", () => {
    const { max } = propVoxels("pillar").bounds();
    expect(max[1] * PROP_MODELS.pillar.voxel).toBeCloseTo(1.5);
  });

  it("ids são únicos (são os nomes dos arquivos .vox)", () => {
    const ids = kinds.map((k) => PROP_MODELS[k].id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("sem arquivos em assets/vox, nada é substituído", async () => {
    expect(await loadVoxOverrides()).toEqual([]);
  });
});

describe("posição dos adereços", () => {
  const props = placeProps();

  it("é determinística e deixa livres as arenas, o portal da cripta e a água", () => {
    expect(placeProps()).toEqual(props);
    const scattered = props.filter((p) => !["pillar", "totem", "cocoon", "obelisk", "obeliskBroken"].includes(p.kind));
    expect(scattered.length).toBeGreaterThan(600);
    for (const p of scattered) {
      expect(Math.hypot(p.x - BOSS_HOME.x, p.z - BOSS_HOME.z)).toBeGreaterThan(15);
      expect(Math.hypot(p.x - SWAMP_BOSS_HOME.x, p.z - SWAMP_BOSS_HOME.z)).toBeGreaterThan(15);
      expect(Math.hypot(p.x - DESERT_BOSS_HOME.x, p.z - DESERT_BOSS_HOME.z)).toBeGreaterThan(16);
      expect(Math.hypot(p.x - DUNGEON_ENTRANCE.x, p.z - DUNGEON_ENTRANCE.z)).toBeGreaterThan(5);
      expect(isWater(p.x, p.z)).toBe(false);
    }
  });

  it("cada coisa no seu bioma: cactos no deserto, árvores mortas no pântano, pinheiros no alto", () => {
    for (const p of props) {
      if (p.kind.startsWith("cactus")) expect(biomeAt(p.x, p.z)).toBe("desert");
      if (p.kind.startsWith("deadTree")) expect(biomeAt(p.x, p.z)).toBe("swamp");
      if (p.kind === "pineSnow") expect(terrainHeight(p.x, p.z)).toBeGreaterThanOrEqual(8.5);
    }
    expect(props.filter((p) => p.kind === "pillar")).toHaveLength(8);
  });
});

describe("campo com nível de detalhe", () => {
  const placements = [
    { kind: "bush" as const, x: 0, y: 0, z: -5, yaw: 0, scale: 1 },
    { kind: "bush" as const, x: 0, y: 0, z: -(LOD_HI + 5), yaw: 0, scale: 1 },
    { kind: "bush" as const, x: 0, y: 0, z: -(LOD_MID + 10), yaw: 0, scale: 1 }, // longe, na frente
    { kind: "bush" as const, x: 0, y: 0, z: LOD_MID + 10, yaw: 0, scale: 1 }, // longe, atrás
  ];

  it("perto é completo, no meio é médio, longe é simples; o que está atrás da câmera não é desenhado", () => {
    const field = new PropField(placements);
    const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 500);
    camera.position.set(0, 2, 0);
    camera.lookAt(0, 2, -10); // olhando para -Z
    field.update(camera);
    expect(field.shown).toEqual({ hi: 1, mid: 1, lo: 1 });
  });

  it("o modelo completo é montado depois, um por chamada", () => {
    const field = new PropField(placements);
    expect(field.pending).toBe(1);
    expect(field.buildPending()).toBe(true);
    expect(field.pending).toBe(0);
    expect(field.buildPending()).toBe(false);
  });
});
