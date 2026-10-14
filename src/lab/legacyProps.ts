import * as THREE from "three";
import { VoxelBuilder } from "../game/voxel";

/**
 * Adereços de cenário da versão anterior (voxels de 25 cm, caixas empilhadas), guardados só para a
 * comparação de antes e depois no lab.
 */
/** Voxel de cenário: 4 por metro (mais grosso que os personagens, como blocos de mundo). */
const V = 1 / 4;

function treeGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const trunk = "#6b4a2b";
  const leaf = ["#2f7a3e", "#3b8f3a", "#2a6b4a"][variant % 3]!;
  const h = 6 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, trunk);
  // Copa em camadas: larga embaixo, estreita em cima.
  b.box(-4, h - 1, -4, 4, h + 2, 4, leaf);
  b.box(-3, h + 2, -3, 3, h + 4, 3, leaf);
  b.box(-2, h + 4, -2, 2, h + 6, 2, leaf);
  b.box(-1, h + 6, -1, 1, h + 7, 1, leaf);
  return b.build(V, { grain: 0.09, grainScale: 2 });
}

function rockGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const stone = ["#8a8780", "#77756e", "#9a968c"][variant % 3]!;
  b.box(-3, 0, -2, 3, 2, 2, stone);
  b.box(-2, 2, -2, 2, 3, 1, stone);
  b.box(-1, 3, -1, 1, 4, 1, stone);
  if (variant % 2) b.box(-4, 0, -1, -3, 1, 1, stone);
  return b.build(V, { grain: 0.08, grainScale: 2 });
}

function deadTreeGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const bark = ["#3b2f25", "#4a3a2c"][variant % 2]!;
  const h = 7 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, bark);
  b.box(-4, h - 3, 0, -1, h - 2, 1, bark).box(-5, h - 2, 0, -4, h + 1, 1, bark); // galho esquerdo
  b.box(1, h - 1, -1, 4, h, 0, bark).box(3, h, -1, 4, h + 3, 0, bark); // galho direito
  if (variant % 2) b.box(-1, h, -1, 1, h + 2, 1, bark);
  return b.build(V, 0.08);
}

function mushroomGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(-1, 0, -1, 1, 3, 1, "#d9cfb8");
  b.box(-3, 3, -3, 3, 5, 3, "#7a3d8f").box(-2, 5, -2, 2, 6, 2, "#8f4da3");
  b.set(-2, 4, -3, "#e8dcc0").set(2, 4, 3, "#e8dcc0").set(0, 5, -2, "#e8dcc0");
  return b.build(V, 0.1);
}

function cactusGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const green = ["#4f8f3a", "#3f7a33"][variant % 2]!;
  const h = 8 + variant * 2;
  b.box(-1, 0, -1, 1, h, 1, green);
  b.box(-3, 3, -1, -1, 4, 0, green).box(-3, 4, -1, -2, h - 2, 0, green); // braço
  if (variant % 2) b.box(1, 5, -1, 3, 6, 0, green).box(2, 6, -1, 3, h - 1, 0, green);
  b.set(0, h, 0, "#f0d0d8"); // flor
  return b.build(V, 0.06);
}

function bonesGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const bone = "#e8e0cf";
  b.box(-4, 0, -1, 4, 1, 0, bone); // espinha
  for (const x of [-3, -1, 1, 3]) b.box(x, 0, -3, x + 1, 1, 3, bone);
  b.box(4, 0, -2, 7, 2, 2, bone).box(5, 1, -3, 6, 2, -2, bone); // crânio
  return b.build(V, 0.05);
}

/** Catálogo de adereços de cenário, para a vitrine (/lab). */
export const LEGACY_PROPS: Record<string, () => THREE.BufferGeometry> = {
  "Árvore 1": () => treeGeometry(0),
  "Árvore 2": () => treeGeometry(1),
  "Árvore 3": () => treeGeometry(2),
  "Pedra 1": () => rockGeometry(0),
  "Pedra 2": () => rockGeometry(1),
  "Árvore morta 1": () => deadTreeGeometry(0),
  "Árvore morta 2": () => deadTreeGeometry(1),
  "Cogumelo": () => mushroomGeometry(),
  "Cacto 1": () => cactusGeometry(0),
  "Cacto 2": () => cactusGeometry(1),
  "Ossada": () => bonesGeometry(),
  "Pilar do santuário": () => pillarGeometry(),
  "Totem goblin": () => totemGeometry(),
  "Casulo de teia": () => cocoonGeometry(),
  "Obelisco do deserto": () => obeliskGeometry(),
  "Obelisco quebrado": () => obeliskGeometry(true),
};

function pillarGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder().box(-1, 0, -1, 1, 5, 1, "#d9d2c0").box(-2, 5, -2, 2, 6, 2, "#c8bfa8").build(V, 0.08);
}

function totemGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 7, 1, "#5a3d2b")
    .box(-2, 7, -2, 2, 10, 2, "#e8dcc0")
    .set(-1, 8, -3, "#1b1b1b").set(0, 8, -3, "#1b1b1b")
    .box(-3, 4, -1, 3, 5, 1, "#7a1f2b")
    .build(V, 0.08);
}

/** Obelisco de arenito com ponta de ouro e hieróglifos escuros (arena do deserto). */
function obeliskGeometry(broken = false): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const sand = "#d8b878", sandDark = "#b8945a";
  b.box(-2, 0, -2, 2, 1, 2, sandDark);
  const h = broken ? 6 : 11;
  b.box(-1, 1, -1, 1, h, 1, sand);
  for (let y = 2; y < h - 1; y += 2) b.set(-1, y, -2, "#5a3a20").set(0, y + 1, -2, "#5a3a20"); // hieróglifos
  b.box(-1, 1, -2, 1, h, -1, sand);
  if (broken) {
    b.box(1, 0, 1, 3, 1, 4, sand).box(2, 1, 2, 3, 2, 3, sandDark); // pedaço caído
  } else {
    b.box(-1, h, -1, 1, h + 1, 1, "#d4a92a").set(0, h + 1, 0, "#f0d070"); // ponta de ouro
  }
  return b.build(V, { grain: 0.06, grainScale: 2 });
}

function cocoonGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 8, 1, "#3b2f25")
    .box(-2, 5, -2, 2, 9, 2, "#e8e4da").box(-3, 6, -1, 3, 8, 1, "#e8e4da").box(-1, 6, -3, 1, 8, 3, "#e8e4da")
    .set(-2, 7, -3, "#b8322f").set(2, 7, 3, "#b8322f")
    .build(V, 0.06);
}

