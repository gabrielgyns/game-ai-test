import * as THREE from "three";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/**
 * Portal da cripta: arco de pedra antiga com runas e um véu roxo que gira. O véu é feito de anéis de
 * voxels que giram em sentidos opostos, com cor acima de 1 para acender no bloom.
 */
export interface Portal {
  group: THREE.Group;
  update(time: number): void;
  setColor(color: THREE.ColorRepresentation): void;
}

function archGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const stone = "#6f6a76", dark = "#4a4652", light = "#8a8592";
  // Colunas e verga, em voxels de 1/6 m; o vão fica em x ∈ [-6, 6), y ∈ [0, 17).
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -9 : 6;
    b.box(x0, 0, -2, x0 + 3, 18, 2, stone);
    b.box(x0 - (s < 0 ? 1 : 0), 0, -3, x0 + 3 + (s > 0 ? 1 : 0), 2, 3, dark); // base
    for (let y = 3; y < 17; y += 4) b.box(x0, y, -2, x0 + 3, y + 1, 2, dark); // juntas
    b.set(s < 0 ? -8 : 7, 9, -3, "#b88aff").set(s < 0 ? -8 : 7, 12, -3, "#b88aff"); // runas
  }
  b.box(-9, 17, -2, 9, 21, 2, stone).box(-9, 20, -2, 9, 21, 2, light);
  b.box(-2, 21, -2, 2, 23, 2, dark).set(0, 22, -3, "#b88aff"); // chave do arco
  return b.build(1 / 6, { grain: 0.06, grainScale: 2 });
}

const archCache: { g: THREE.BufferGeometry | null } = { g: null };

export function createPortal(color: THREE.ColorRepresentation = "#9a5aff"): Portal {
  const group = new THREE.Group();
  if (!archCache.g) {
    archCache.g = archGeometry();
    archCache.g.userData.shared = true; // usada por todos os portais: não descartar
  }
  const arch = new THREE.Mesh(archCache.g, voxelMaterial());
  arch.castShadow = arch.receiveShadow = true;
  group.add(arch);

  // Véu: três anéis de cubinhos girando, mais um disco translúcido atrás.
  const veilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9 });
  const discMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.9), transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.8), discMat);
  disc.position.y = 1.45;
  group.add(disc);
  const rings: THREE.Group[] = [];
  const cube = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Group();
    const radius = 0.35 + r * 0.32;
    const n = 10 + r * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const m = new THREE.Mesh(cube, veilMat);
      m.position.set(Math.cos(a) * radius, Math.sin(a) * radius * 1.35, 0);
      ring.add(m);
    }
    ring.position.y = 1.45;
    group.add(ring);
    rings.push(ring);
  }
  return {
    group,
    update(time: number) {
      rings.forEach((ring, i) => (ring.rotation.z = time * (i % 2 ? -1 : 1) * (0.8 + i * 0.4)));
      discMat.opacity = 0.35 + Math.sin(time * 2.5) * 0.1;
    },
    setColor(c: THREE.ColorRepresentation) {
      veilMat.color.set(c).multiplyScalar(1.6);
      discMat.color.set(c).multiplyScalar(0.9);
    },
  };
}
