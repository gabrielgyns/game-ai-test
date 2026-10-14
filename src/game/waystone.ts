import * as THREE from "three";
import { terrainHeight } from "../domain/terrain";
import type { Village } from "../domain/villages";

/**
 * Cristal que flutua sobre a Pedra de Teleporte: gira e sobe e desce devagar. Apagado (cinza) até a
 * pedra ser ativada; depois, azul aceso (acima de 1, para o bloom) com uma luz fria em volta.
 */
export interface WaystoneGlow {
  group: THREE.Group;
  update(time: number, attuned: boolean): void;
}

const OFF = new THREE.Color("#6a7484");
const ON = new THREE.Color("#5ad0ff").multiplyScalar(2.2);

export function createWaystoneGlow(village: Village): WaystoneGlow {
  const group = new THREE.Group();
  const base = terrainHeight(village.stone.x, village.stone.z);
  group.position.set(village.stone.x, base, village.stone.z);
  const mat = new THREE.MeshBasicMaterial({ color: OFF.clone() });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
  crystal.scale.y = 1.6;
  const light = new THREE.PointLight("#5ad0ff", 0, 9, 1.6);
  light.position.y = 3.3;
  group.add(crystal, light);
  return {
    group,
    update(time, attuned) {
      crystal.position.y = 3.35 + Math.sin(time * 1.6) * 0.08;
      crystal.rotation.y = time * (attuned ? 0.9 : 0.25);
      mat.color.lerp(attuned ? ON : OFF, 0.08);
      light.intensity = attuned ? 3.5 + Math.sin(time * 2.2) * 0.6 : 0;
    },
  };
}
