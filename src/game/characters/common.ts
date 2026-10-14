import * as THREE from "three";
import { VoxelBuilder, voxelMaterial, shades, tone, type BuildOptions, type Shades } from "../voxel";
import type { Rarity } from "../../domain/items";

/**
 * Um modelo visual com ganchos de animação. Os membros são malhas separadas com pivô na
 * articulação, como um boneco articulado: o ciclo de caminhada gira pernas e braços.
 */
export interface CharacterModel {
  root: THREE.Group;
  /** Pivô do braço que balança no ataque (braço direito ou cauda/pata equivalente). */
  weaponArm?: THREE.Object3D;
  /** Braço livre, balança no passo oposto ao da perna. */
  offArm?: THREE.Object3D;
  /** Pernas [esquerda, direita] com pivô no quadril. */
  legs?: THREE.Object3D[];
  /** Cabeça, para inclinar levemente no passo e no aviso. */
  head?: THREE.Object3D;
  /** Altura aproximada em metros, para posicionar a barra de vida. */
  height: number;
  /** Inclinação de repouso do braço da arma (rad, para a frente), para a lâmina não raspar no chão. */
  weaponArmRest?: number;
  /** Materiais com glow de raridade (arma, armadura), para pulsar a intensidade. */
  glowMaterials?: { material: THREE.MeshStandardMaterial; baseIntensity: number }[];
}

/** Tamanho de um voxel de personagem, em metros (16 voxels = 1 m). */
export const V = 1 / 16;

/**
 * Opções padrão de malha para personagens: AO marcada e grão leve em manchas de 2 voxels.
 * O grão quebra a fusão de faces: com manchas de 2, um orc fica em ~6k triângulos em vez de 13k.
 */
export const CHARACTER_BUILD: BuildOptions = { grain: 0.05, grainScale: 2, ao: true, aoStrength: 0.45 };
/** O herói é o centro da tela: grão fino (1 voxel) vale os triângulos extras. */
export const HERO_BUILD: BuildOptions = { grain: 0.05, grainScale: 1, ao: true, aoStrength: 0.45 };

export function mesh(builder: VoxelBuilder, material: THREE.Material = voxelMaterial(), scale = V, options: BuildOptions = CHARACTER_BUILD): THREE.Mesh {
  const m = new THREE.Mesh(builder.build(scale, options), material);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/** Raridade como aparece no corpo: peças de conjunto brilham em verde-água. */
export type LookRarity = Rarity | "set";
export const lookRarity = (item: { rarity: Rarity; set?: string }): LookRarity => (item.set ? "set" : item.rarity);

export const RARITY_GLOW: Record<LookRarity, string | null> = {
  common: null,
  uncommon: "#5fd36b",
  rare: "#5b8def",
  epic: "#b06cf0",
  set: "#2fe0a8",
};

export const BLADE_BY_RARITY: Record<LookRarity, string> = {
  common: "#d8dde6",
  uncommon: "#9fe3a8",
  rare: "#8fb3ff",
  epic: "#d29bff",
  set: "#8ff0d0",
};

/** Material da peça: tingido leve na cor da raridade (a cor do item continua legível). */
export function glowMaterial(rarity: LookRarity, intensity: number): { material: THREE.MeshStandardMaterial; baseIntensity: number } | null {
  const color = RARITY_GLOW[rarity];
  if (!color) return null;
  const material = voxelMaterial();
  material.emissive = new THREE.Color(color);
  material.emissiveIntensity = intensity;
  return { material, baseIntensity: intensity };
}

/**
 * Aura neon: uma casca da mesma geometria, um pouco maior, aditiva e acima do limiar do bloom.
 * É o que dá o contorno brilhante em volta da peça sem mudar a cor dela.
 */
export function addAura(part: THREE.Mesh, rarity: LookRarity, strength = 1): THREE.Mesh | null {
  const color = RARITY_GLOW[rarity];
  if (!color) return null;
  const geometry = part.geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const k = 1.07;
  const aura = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.7 * strength),
      transparent: true,
      opacity: 0.24,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  aura.scale.setScalar(k);
  aura.position.copy(center).multiplyScalar(1 - k); // cresce em volta do centro da peça, não dos pés
  part.add(aura);
  return aura;
}

/* ---------- Paletas compartilhadas ---------- */

export const PAL = {
  gold: shades("#d4a92a", 0.12),
  steel: shades("#c3c9d3", 0.12),
  darkSteel: shades("#6f7682", 0.1),
  wood: shades("#7a5230", 0.1),
  leather: shades("#6b4a2b", 0.1),
  eyeWhite: "#f4f1ea",
  pupil: "#1b1b1b",
  teeth: "#f1ead6",
};

/* ---------- Peças de humanoide ---------- */

export interface LimbSpec {
  /** Meia largura (x) e meia profundidade (z). */
  hw: number;
  hd: number;
  /** Comprimento para baixo a partir do pivô. */
  length: number;
}

/**
 * Perna em coordenadas locais com pivô no quadril (y = 0 no topo, desce até -length).
 * A bota ocupa as `bootH` últimas camadas, com sola escura e cano claro.
 */
export function paintLeg(b: VoxelBuilder, spec: LimbSpec, pants: Shades, boots: Shades, bootH: number, kneeAt?: number): void {
  const { hw, hd, length } = spec;
  b.box(-hw, -length, -hd, hw, 0, hd, pants.base);
  // Dobra atrás do joelho e vinco na frente: a perna deixa de ser um bloco.
  const knee = kneeAt ?? Math.round(length * 0.45);
  b.box(-hw, -knee, -hd, hw, -knee + 1, -hd + 1, pants.dark);
  b.box(-hw, -knee - 1, hd - 1, hw, -knee + 1, hd, pants.dark);
  // Bota: cano, corpo e sola, um voxel mais larga que a perna.
  b.box(-hw - 1, -length, -hd - 1, hw + 1, -length + bootH, hd + 1, boots.base);
  b.box(-hw - 1, -length + bootH - 1, -hd - 1, hw + 1, -length + bootH, hd + 1, boots.light);
  b.box(-hw - 1, -length, -hd - 1, hw + 1, -length + 1, hd + 1, boots.dark);
  // Biqueira: a bota avança um voxel para a frente.
  b.box(-hw - 1, -length, -hd - 2, hw + 1, -length + Math.max(1, bootH - 1), -hd - 1, boots.base);
}

/**
 * Braço em coordenadas locais com pivô no ombro. Manga até `sleeveLen`, antebraço de pele,
 * mão um tom mais escura e um voxel mais larga.
 */
export function paintArm(b: VoxelBuilder, spec: LimbSpec, sleeve: Shades, skin: Shades, sleeveLen: number): void {
  const { hw, hd, length } = spec;
  b.box(-hw, -length + 2, -hd, hw, 0, hd, skin.base);
  if (sleeveLen > 0) {
    b.box(-hw, -sleeveLen, -hd, hw, 0, hd, sleeve.base);
    b.box(-hw, -sleeveLen, -hd, hw, -sleeveLen + 1, hd, sleeve.dark); // bainha
    b.box(-hw, -1, -hd, hw, 0, hd, sleeve.light); // ombro iluminado
  }
  b.box(-hw, -length, -hd, hw, -length + 3, hd, skin.dark); // mão
}

export interface HeadSpec {
  /** Meia largura, altura e meia profundidade. */
  hw: number;
  h: number;
  hd: number;
}

/** Cabeça em coordenadas locais com pivô na base do pescoço (y = 0 embaixo). */
export function paintHead(b: VoxelBuilder, spec: HeadSpec, skin: Shades): void {
  const { hw, h, hd } = spec;
  b.box(-hw, 0, -hd, hw, h, hd, skin.base);
  // Sombra do queixo e das têmporas: lê como rosto mesmo de longe.
  b.box(-hw, 0, -hd, hw, 1, hd, skin.dark);
  b.box(-hw, 0, -hd, -hw + 1, Math.round(h * 0.45), hd, skin.dark);
  b.box(hw - 1, 0, -hd, hw, Math.round(h * 0.45), hd, skin.dark);
  // Orelhas.
  const ey = Math.round(h * 0.45);
  b.box(-hw - 1, ey, -1, -hw, ey + 3, 1, skin.base).box(hw, ey, -1, hw + 1, ey + 3, 1, skin.base);
}

/**
 * Rosto padrão de 12 colunas (x de -6 a 5) carimbado na frente da cabeça. `y0` é a linha da
 * boca; olhos ficam 3 acima. `eyeColor` permite olhos vermelhos de orc ou amarelos de goblin.
 */
export function paintFace(b: VoxelBuilder, hw: number, hd: number, y0: number, skin: Shades, opts: { eye?: string; brow?: string; mouth?: "smile" | "flat" | "fangs" | "grin"; nose?: boolean } = {}): void {
  const pal = { s: skin.base, d: skin.dark, w: PAL.eyeWhite, e: opts.eye ?? PAL.pupil, b: opts.brow ?? tone(skin.dark, -0.18), m: tone(skin.dark, -0.12), t: PAL.teeth };
  const z = -hd; // plano da frente
  const x0 = -hw;
  const w = hw * 2;
  const pad = (s: string) => (s.length >= w ? s.slice(0, w) : s.padEnd(w, "s"));
  const mid = Math.floor(w / 2);
  // Olhos: 2 de largura (3 em cabeças grandes), pupila para dentro.
  const ew = hw >= 8 ? 3 : 2;
  const gap = hw >= 8 ? 3 : 2;
  const li = mid - gap - ew, ri = mid + gap;
  const eyeRow = (): string => {
    const row = Array(w).fill("s");
    for (let i = 0; i < ew; i++) { row[li + i] = i === ew - 1 ? "e" : "w"; row[ri + i] = i === 0 ? "e" : "w"; }
    return row.join("");
  };
  const browRow = (): string => {
    const row = Array(w).fill("s");
    for (let i = 0; i < ew; i++) { row[li + i] = "b"; row[ri + i] = "b"; }
    return row.join("");
  };
  const mouthRow = (): string => {
    const row = Array(w).fill("s");
    if (opts.mouth === "fangs") { row[mid - 2] = "t"; row[mid + 1] = "t"; row[mid - 1] = "m"; row[mid] = "m"; }
    else if (opts.mouth === "grin") { for (let i = mid - 3; i < mid + 3; i++) row[i] = i % 2 ? "t" : "m"; }
    else if (opts.mouth === "flat") { row[mid - 1] = "m"; row[mid] = "m"; }
    else { row[mid - 2] = "m"; row[mid - 1] = "m"; row[mid] = "m"; row[mid + 1] = "m"; }
    return row.join("");
  };
  const rows = hw >= 8
    ? [pad(browRow()), pad(eyeRow()), pad(eyeRow()), pad(eyeRow()), pad("s".repeat(w)), pad("s".repeat(w)), pad(mouthRow())]
    : [pad(browRow()), pad(eyeRow()), pad(eyeRow()), pad("s".repeat(w)), pad(mouthRow())];
  b.stampXY(rows, pal, x0, y0, z, z + 1);
  if (opts.nose !== false) b.set(0, y0 + 1, z - 1, skin.dark).set(-1, y0 + 1, z - 1, skin.dark);
}

/** Pintura de cabelo curto: topo, franja e nuca. */
export function paintHairShort(b: VoxelBuilder, head: HeadSpec, hair: Shades): void {
  const { hw, h, hd } = head;
  b.box(-hw, h, -hd, hw, h + 2, hd, hair.base); // topo
  b.box(-hw, h + 1, -hd, hw, h + 2, hd, hair.light);
  b.box(-hw, h - 3, hd - 1, hw, h, hd, hair.base); // nuca
  b.box(-hw, h - 2, -hd - 1, hw, h, -hd, hair.base); // franja
  b.box(-hw, h - 4, -hd, -hw + 1, h, hd, hair.base).box(hw - 1, h - 4, -hd, hw, h, hd, hair.base); // laterais
  b.box(-hw, h - 2, -hd - 1, -hw + 3, h, -hd, hair.dark).box(hw - 3, h - 2, -hd - 1, hw, h, -hd, hair.dark);
}

/** Monta um grupo com pivô numa posição, contendo a malha. */
export function pivot(x: number, y: number, z: number, ...meshes: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x * V, y * V, z * V);
  g.add(...meshes);
  return g;
}

export { shades, tone, type Shades };
