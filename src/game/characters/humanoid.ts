import * as THREE from "three";
import { VoxelBuilder } from "../voxel";
import {
  V, mesh, paintArm, paintFace, paintHead, paintLeg, pivot,
  type CharacterModel, type HeadSpec, type LimbSpec, type Shades,
} from "./common";

/**
 * Receita de um humanoide articulado: tronco e cabeça fixos, pernas e braços em pivôs.
 * Cada criatura preenche as medidas e os "pintores" de detalhe (roupa, cabelo, arma).
 */
export interface HumanoidSpec {
  skin: Shades;
  legs: LimbSpec;
  arms: LimbSpec;
  head: HeadSpec;
  torso: { hw: number; h: number; hd: number };
  /** Distância do centro até o pivô de cada perna e de cada braço. */
  legX: number;
  armX: number;
  pants: Shades;
  boots: Shades;
  bootH: number;
  sleeve: Shades;
  sleeveLen: number;
  face: Parameters<typeof paintFace>[5];
  /** Linha da boca, relativa à base da cabeça. */
  mouthY?: number;
  /** Tronco em coordenadas do mundo (y começa no quadril). */
  torsoPaint?: (b: VoxelBuilder, hipY: number) => void;
  /** Cabeça em coordenadas locais (base do pescoço em y = 0), depois do rosto. */
  headPaint?: (b: VoxelBuilder) => void;
  /** Arma em coordenadas do braço direito (mão em y = -length .. -length+3). */
  weaponPaint?: (b: VoxelBuilder) => void;
  /** Item na mão esquerda. */
  offhandPaint?: (b: VoxelBuilder) => void;
  /** Braço direito esticado para a frente (zumbi) em vez de pendurado. */
  rightArmForward?: boolean;
  /** Altura extra acima da cabeça (chapéu, coroa), em voxels. */
  topExtra?: number;
  /** Pescoço entre tronco e cabeça. */
  neck?: number;
  /** Inclinação de repouso do braço da arma. */
  weaponArmRest?: number;
}

export function buildHumanoid(spec: HumanoidSpec): CharacterModel {
  const hipY = spec.legs.length;
  const shoulderY = hipY + spec.torso.h - 1;
  const neck = spec.neck ?? 0;
  const headY = hipY + spec.torso.h + neck;
  const root = new THREE.Group();

  const torso = new VoxelBuilder();
  const { hw, h, hd } = spec.torso;
  torso.box(-hw, hipY, -hd, hw, hipY + h, hd, spec.sleeve.base);
  torso.box(-hw, hipY + h - 1, -hd, hw, hipY + h, hd, spec.sleeve.light);
  torso.box(-hw, hipY, -hd, hw, hipY + 1, hd, spec.sleeve.dark);
  if (neck > 0) torso.box(-2, hipY + h, -2, 2, headY + 1, 2, spec.skin.dark);
  spec.torsoPaint?.(torso, hipY);
  root.add(mesh(torso));

  const head = new VoxelBuilder();
  paintHead(head, spec.head, spec.skin);
  paintFace(head, spec.head.hw, spec.head.hd, spec.mouthY ?? Math.round(spec.head.h * 0.25), spec.skin, spec.face);
  spec.headPaint?.(head);
  const headGroup = pivot(0, headY, 0, mesh(head));
  root.add(headGroup);

  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new VoxelBuilder();
    paintLeg(leg, spec.legs, spec.pants, spec.boots, spec.bootH);
    const group = pivot(side * spec.legX, hipY, 0, mesh(leg));
    legs.push(group);
    root.add(group);
  }

  const left = new VoxelBuilder();
  paintArm(left, spec.arms, spec.sleeve, spec.skin, spec.sleeveLen);
  spec.offhandPaint?.(left);
  const offArm = pivot(-spec.armX, shoulderY, 0, mesh(left));
  root.add(offArm);

  const right = new VoxelBuilder();
  if (spec.rightArmForward) {
    const { hw: aw, hd: ad, length } = spec.arms;
    right.box(-aw, -ad, -length, aw, ad, 0, spec.skin.base);
    right.box(-aw, -ad, -length, aw, ad, -length + 3, spec.skin.dark);
    if (spec.sleeveLen > 0) right.box(-aw, -ad, -spec.sleeveLen, aw, ad, 0, spec.sleeve.base);
  } else {
    paintArm(right, spec.arms, spec.sleeve, spec.skin, spec.sleeveLen);
  }
  spec.weaponPaint?.(right);
  const weaponArm = pivot(spec.armX, shoulderY, 0, mesh(right));
  root.add(weaponArm);

  return {
    root,
    weaponArm,
    offArm,
    legs,
    head: headGroup,
    height: (headY + spec.head.h + 2 + (spec.topExtra ?? 0) * 0.5) * V + 0.1,
    weaponArmRest: spec.weaponArmRest ?? (spec.rightArmForward ? 0 : 0.3),
  };
}
