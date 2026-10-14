import * as THREE from "three";
import { terrainHeight } from "../domain/terrain";
import type { ZonePassage } from "../domain/zones";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/**
 * Marca de uma passagem entre zonas: uma trilha de lajes que leva até a borda, dois postes com
 * lanterna na boca e, nela, uma cortina de névoa que sobe devagar. Atravessar a névoa é sair da zona.
 */
export interface PassageMarker {
  group: THREE.Group;
  update(time: number): void;
}

function postGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const wood = "#6a4a2a", dark = "#4a3018";
  b.box(-1, 0, -1, 1, 20, 1, wood).box(-1, 0, -1, 1, 2, 1, dark);
  b.box(-1, 18, -4, 1, 19, 1, dark); // braço
  // Lanterna pendurada (o vidro aceso é outra malha).
  b.box(-2, 13, -5, 2, 14, -1, dark).box(-2, 17, -5, 2, 18, -1, dark);
  for (const [x, z] of [[-2, -5], [1, -5], [-2, -2], [1, -2]] as const) b.box(x, 14, z, x + 1, 17, z + 1, dark);
  return b.build(1 / 8, { grain: 0.05 });
}

function slabGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  for (let x = -5; x < 5; x++) for (let z = -4; z < 4; z++) if (Math.hypot(x + 0.5, (z + 0.5) * 1.2) < 5) b.set(x, 0, z, (x + z) % 3 ? "#9a9488" : "#8a8478");
  return b.build(1 / 8, { grain: 0.08 });
}

/** Textura da névoa: forte embaixo, some no alto e nas laterais. */
function mistTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const v = 1 - y / 63; // 1 embaixo
      const edge = Math.min(1, Math.min(x, 63 - x) / 14);
      const n = 0.75 + 0.25 * Math.sin(x * 0.7 + y * 0.31) * Math.sin(y * 0.23);
      const a = Math.pow(1 - v, 1.6) * edge * n;
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

const shared: { post?: THREE.BufferGeometry; slab?: THREE.BufferGeometry; mist?: THREE.CanvasTexture } = {};

export function createPassageMarker(passage: ZonePassage, color: THREE.ColorRepresentation): PassageMarker {
  const group = new THREE.Group();
  const { at, out, width } = passage;
  const yaw = Math.atan2(-out.x, -out.z); // -Z local aponta para fora da zona
  const side = { x: -out.z, z: out.x };
  shared.post ??= postGeometry();
  shared.slab ??= slabGeometry();
  shared.mist ??= mistTexture();

  // Lajes da trilha, da boca até uns 14 m para dentro, um pouco tortas.
  const slabMat = voxelMaterial();
  for (let i = 0; i < 9; i++) {
    const d = 1 + i * 1.6, s = Math.sin(i * 2.3) * 0.8;
    const x = at.x - out.x * d + side.x * s, z = at.z - out.z * d + side.z * s;
    const slab = new THREE.Mesh(shared.slab, slabMat);
    slab.position.set(x, terrainHeight(x, z) + 0.01, z);
    slab.rotation.y = yaw + i * 0.7;
    slab.receiveShadow = true;
    group.add(slab);
  }
  // Postes com lanterna, um de cada lado da boca.
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) });
  const glass = new THREE.BoxGeometry(0.4, 0.38, 0.4);
  for (const s of [-1, 1]) {
    const x = at.x + side.x * (width + 0.6) * s, z = at.z + side.z * (width + 0.6) * s;
    const post = new THREE.Group();
    post.position.set(x, terrainHeight(x, z), z);
    post.rotation.y = yaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2);
    const wood = new THREE.Mesh(shared.post, voxelMaterial());
    wood.castShadow = true;
    const lamp = new THREE.Mesh(glass, glowMat);
    lamp.position.set(0, 1.94, -0.38);
    post.add(wood, lamp);
    group.add(post);
  }
  // Cortina de névoa: três planos que sobem em velocidades diferentes.
  const h = terrainHeight(at.x, at.z);
  const layers: THREE.MeshBasicMaterial[] = [];
  for (let k = 0; k < 3; k++) {
    const tex = shared.mist.clone();
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width * 2 + 3, 4.5), mat);
    const d = k * 0.9;
    plane.position.set(at.x + out.x * d, h + 2.1, at.z + out.z * d);
    plane.rotation.y = yaw;
    plane.renderOrder = 2;
    group.add(plane);
    layers.push(mat);
  }
  return {
    group,
    update(time: number) {
      layers.forEach((m, k) => {
        m.map!.offset.x = time * (0.02 + k * 0.015) * (k % 2 ? -1 : 1);
        m.opacity = 0.38 + Math.sin(time * 0.8 + k * 1.7) * 0.1;
      });
    },
  };
}
