import * as THREE from "three";
import { VoxelBuilder } from "../voxel";
import { parseVox, voxToBuilder } from "../vox";
import { cactus, bones, cocoon, goblinTotem, mushrooms, obelisk, shrinePillar } from "./landmarks";
import { boulder, rockCluster, sandstone, slab } from "./rocks";
import { birch, bush, deadTree, oak, pine } from "./trees";

/**
 * Catálogo do cenário. Cada modelo tem um id (que também é o nome do arquivo .vox que pode
 * substituí-lo), um nome para a vitrine, o tamanho do voxel e a receita de escultura.
 *
 * Para trocar um modelo por um desenhado no MagicaVoxel, salve `assets/vox/<id>.vox`: o jogo usa o
 * arquivo no lugar da receita, na mesma escala (1 voxel do editor = `voxel` metros).
 */
export interface PropModel {
  id: string;
  label: string;
  /** Metros por voxel. */
  voxel: number;
  sculpt(): VoxelBuilder;
}

/** Cenário em alta resolução: 12 voxels por metro (os personagens usam 16). */
export const SCENERY_VOXEL = 1 / 12;

const LEAVES_OAK = ["#1f4a24", "#28592a", "#326a30", "#3d7c36", "#4a8e3e", "#8cc85a"];
const LEAVES_OAK_AUTUMN = ["#6a3a14", "#8a4a18", "#a85e1c", "#c27424", "#d48a2e", "#f0c060"];

const model = (id: string, label: string, sculpt: () => VoxelBuilder, voxel = SCENERY_VOXEL): PropModel => ({ id, label, voxel, sculpt });

export const PROP_MODELS = {
  oak1: model("carvalho-1", "Carvalho 1", () => oak({ seed: 11, height: 56, leaves: LEAVES_OAK })),
  oak2: model("carvalho-2", "Carvalho 2", () => oak({ seed: 23, height: 50, leaves: LEAVES_OAK })),
  oakAutumn: model("carvalho-outono", "Carvalho de outono", () => oak({ seed: 37, height: 52, leaves: LEAVES_OAK_AUTUMN })),
  birch: model("betula", "Bétula", () => birch(5, 62)),
  pine: model("pinheiro", "Pinheiro", () => pine(7, 58)),
  pineSnow: model("pinheiro-nevado", "Pinheiro nevado", () => pine(9, 52, true)),
  bush: model("arbusto", "Arbusto", () => bush(3, false)),
  berryBush: model("arbusto-frutas", "Arbusto com frutas", () => bush(8, true)),
  boulder1: model("pedregulho-1", "Pedregulho 1", () => boulder({ seed: 4, size: [14, 11, 11], moss: 0.45 })),
  boulder2: model("pedregulho-2", "Pedregulho 2", () => boulder({ seed: 15, size: [10, 9, 12], moss: 0.3 })),
  rocks: model("pedras", "Grupo de pedras", () => rockCluster(6, 0.4)),
  slab: model("laje", "Laje com musgo", () => slab(12)),
  sandstone1: model("arenito-1", "Arenito 1", () => sandstone(3, [14, 12, 12])),
  sandstone2: model("arenito-2", "Arenito 2", () => sandstone(17, [18, 9, 13])),
  deadTree1: model("arvore-morta-1", "Árvore morta 1", () => deadTree(2, 64)),
  deadTree2: model("arvore-morta-2", "Árvore morta 2", () => deadTree(13, 54)),
  mushrooms: model("cogumelos", "Cogumelos gigantes", () => mushrooms(5)),
  cactus1: model("cacto-1", "Cacto 1", () => cactus(4, 40, 2)),
  cactus2: model("cacto-2", "Cacto 2", () => cactus(19, 30, 1)),
  bones: model("ossada", "Ossada", () => bones(7)),
  pillar: model("pilar", "Pilar do santuário", () => shrinePillar(3)),
  totem: model("totem", "Totem goblin", () => goblinTotem(5)),
  cocoon: model("casulo", "Casulo de teia", () => cocoon(2)),
  obelisk: model("obelisco", "Obelisco do deserto", () => obelisk(4, false)),
  obeliskBroken: model("obelisco-quebrado", "Obelisco quebrado", () => obelisk(9, true)),
} satisfies Record<string, PropModel>;

export type PropKind = keyof typeof PROP_MODELS;

/** Modelos substituídos por arquivos .vox (pelo id). */
const overrides = new Map<string, VoxelBuilder>();

/**
 * Procura arquivos em `assets/vox/*.vox` (o Vite lista na hora do build) e carrega os que existirem.
 * Devolve os ids carregados. Falhas não travam o jogo: o modelo esculpido continua valendo.
 */
export async function loadVoxOverrides(): Promise<string[]> {
  const files = import.meta.glob("/assets/vox/*.vox", { query: "?url", import: "default", eager: true }) as Record<string, string>;
  const loaded: string[] = [];
  await Promise.all(
    Object.entries(files).map(async ([path, url]) => {
      const id = path.split("/").pop()!.replace(/\.vox$/, "");
      try {
        const response = await fetch(url);
        overrides.set(id, voxToBuilder(parseVox(await response.arrayBuffer())));
        loaded.push(id);
      } catch (err) {
        console.warn(`Não consegui ler assets/vox/${id}.vox:`, err);
      }
    }),
  );
  return loaded;
}

/** Voxels do modelo: o .vox, se houver, senão a escultura. */
export function propVoxels(kind: PropKind): VoxelBuilder {
  const m = PROP_MODELS[kind];
  return overrides.get(m.id) ?? m.sculpt();
}

/** Três níveis de detalhe: completo, metade e um quarto da resolução. */
export interface PropLods {
  hi: THREE.BufferGeometry;
  mid: THREE.BufferGeometry;
  lo: THREE.BufferGeometry;
}

const BUILD = { jitter: 0, aoStrength: 0.55 };

/**
 * Só os níveis de longe (rápidos de montar); o completo pode vir depois, com `buildHi`. Vêm junto as
 * "sombras": versões magras (só blocos bem cheios), que ficam por dentro do modelo e por isso não
 * sombreiam a própria superfície por engano. O sol desenha a sombra delas, que custam bem menos.
 */
export function buildFarLods(kind: PropKind): Omit<PropLods, "hi"> & { shadowNear: THREE.BufferGeometry; shadowFar: THREE.BufferGeometry } {
  const voxels = propVoxels(kind);
  const v = PROP_MODELS[kind].voxel;
  const plain = { jitter: 0, ao: false };
  return {
    mid: voxels.downsample(2, 0.3).build(v * 2, BUILD),
    lo: voxels.downsample(4, 0.3).build(v * 4, BUILD),
    shadowNear: voxels.downsample(2, 0.6).build(v * 2, plain),
    shadowFar: voxels.downsample(4, 0.55).build(v * 4, plain),
  };
}

export function buildHi(kind: PropKind): THREE.BufferGeometry {
  return propVoxels(kind).build(PROP_MODELS[kind].voxel, BUILD);
}

export function buildLods(kind: PropKind): PropLods {
  return { hi: buildHi(kind), ...buildFarLods(kind) };
}
