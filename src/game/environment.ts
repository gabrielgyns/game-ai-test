import * as THREE from "three";
import { terrainHeight, SPAWN_FLAT_RADIUS, WORLD_HALF } from "../domain/terrain";
import { seededRandom } from "../domain/worldgen";

/** Árvores e pedras instanciadas: cenário barato, estilo low-poly. */
export function createEnvironment(seed = 4242): THREE.Group {
  const group = new THREE.Group();
  const rand = seededRandom(seed);
  const dummy = new THREE.Object3D();

  const TREES = 260;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b4a2b", flatShading: true });
  const leafGeo = new THREE.ConeGeometry(1.6, 3.6, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: "#2f7a3e", flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, TREES);
  trunks.castShadow = leaves.castShadow = true;
  leaves.receiveShadow = true;

  for (let i = 0; i < TREES; i++) {
    const { x, z } = randomPoint(rand, SPAWN_FLAT_RADIUS + 2);
    const y = terrainHeight(x, z);
    const s = 0.8 + rand() * 0.7;
    dummy.position.set(x, y + 1.1 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = y + (2.2 + 1.6) * s;
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }
  group.add(trunks, leaves);

  const ROCKS = 120;
  const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: "#8a8780", flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  rocks.castShadow = rocks.receiveShadow = true;
  for (let i = 0; i < ROCKS; i++) {
    const { x, z } = randomPoint(rand, 6);
    const s = 0.5 + rand() * 1.4;
    dummy.position.set(x, terrainHeight(x, z) + s * 0.3, z);
    dummy.scale.set(s, s * (0.6 + rand() * 0.5), s);
    dummy.rotation.set(rand(), rand() * Math.PI * 2, rand());
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  group.add(rocks);

  // Pedras em círculo no spawn: ponto de referência para o jogador achar o caminho de volta.
  const shrineMat = new THREE.MeshStandardMaterial({ color: "#d9d2c0", flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.7), shrineMat);
    pillar.position.set(Math.cos(a) * 8, terrainHeight(0, 0) + 0.55, Math.sin(a) * 8);
    pillar.rotation.y = -a;
    pillar.castShadow = true;
    group.add(pillar);
  }
  return group;
}

function randomPoint(rand: () => number, minRadius: number): { x: number; z: number } {
  for (;;) {
    const x = (rand() * 2 - 1) * (WORLD_HALF - 6);
    const z = (rand() * 2 - 1) * (WORLD_HALF - 6);
    if (Math.hypot(x, z) >= minRadius) return { x, z };
  }
}
