import * as THREE from "three";
import { voxelMaterial } from "../voxel";
import { buildFarLods, buildHi, type PropKind, type PropLods } from "./catalog";

/** Um adereço posto no mundo. */
export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

/** Até aqui o modelo aparece completo; depois, em metade da resolução; além de MID, em um quarto. */
export const LOD_HI = 15;
export const LOD_MID = 34;
/** Peças pequenas (arbustos, pedrinhas) somem de vez além disto: na neblina, nem se veem. */
export const SMALL_CULL = 70;
const SMALL_RADIUS = 1.6;
/** Quanto a câmera precisa andar para redistribuir as instâncias entre os níveis. */
const REFRESH_STEP = 1.5;

type Level = keyof PropLods;
const LEVELS: Level[] = ["hi", "mid", "lo"];

interface PropSet {
  kind: PropKind;
  meshes: Record<Level, THREE.InstancedMesh>;
  /** Projetores de sombra dos níveis completo e médio (geometria magra, invisível na tela). */
  shadows: { hi: THREE.InstancedMesh; mid: THREE.InstancedMesh };
  matrices: THREE.Matrix4[];
  /** Centro e raio de cada instância, para o recorte pela câmera. */
  spheres: THREE.Sphere[];
  /** Índices das instâncias que estão no nível longe (recortadas quadro a quadro). */
  far: number[];
  small: boolean;
  hiReady: boolean;
}

/**
 * Campo de adereços com nível de detalhe. Para cada modelo há três InstancedMesh (completo, médio e
 * longe); conforme a câmera anda, cada instância vai para o nível da sua distância. É como um
 * pintor que detalha o primeiro plano e só sugere as árvores do fundo.
 *
 * - A sombra dos níveis completo e médio vem de uma versão magra e mais grossa do modelo, que custa
 *   uma fração dos triângulos; o nível longe não projeta sombra (fica fora da área de sombra do sol).
 * - O nível longe é recortado pela visão da câmera a cada quadro: o que está atrás de você não é
 *   desenhado.
 * - O nível completo é montado aos poucos depois do boot (`buildPending`); até lá, usa o médio.
 */
export class PropField {
  readonly group = new THREE.Group();
  private readonly sets: PropSet[] = [];
  private readonly last = new THREE.Vector2(Infinity, Infinity);
  private readonly frustum = new THREE.Frustum();
  private readonly viewProj = new THREE.Matrix4();
  /** Instâncias em cada nível no último refresh (para medir e testar). */
  readonly shown: Record<Level, number> = { hi: 0, mid: 0, lo: 0 };

  constructor(placements: PropPlacement[]) {
    const byKind = new Map<PropKind, PropPlacement[]>();
    for (const p of placements) {
      let list = byKind.get(p.kind);
      if (!list) byKind.set(p.kind, (list = []));
      list.push(p);
    }
    const material = voxelMaterial();
    // Na tela, o projetor de sombra não escreve cor nem profundidade: só o sol o "vê".
    const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const dummy = new THREE.Object3D();
    for (const [kind, list] of byKind) {
      const lods = buildFarLods(kind);
      const radius = lods.mid.boundingSphere!.radius;
      const meshes = {} as Record<Level, THREE.InstancedMesh>;
      for (const level of LEVELS) {
        const mesh = new THREE.InstancedMesh(level === "hi" ? lods.mid : lods[level], material, list.length);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `${kind}:${level}`;
        meshes[level] = mesh;
        this.group.add(mesh);
      }
      // O nível longe já vem recortado pela câmera: não precisa do recorte do Three.
      meshes.lo.frustumCulled = false;
      const caster = (geometry: THREE.BufferGeometry, level: string) => {
        const mesh = new THREE.InstancedMesh(geometry, shadowOnly, list.length);
        mesh.castShadow = true;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `${kind}:shadow-${level}`;
        this.group.add(mesh);
        return mesh;
      };
      const shadows = { hi: caster(lods.shadowNear, "hi"), mid: caster(lods.shadowFar, "mid") };
      const matrices = list.map((p) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        return dummy.matrix.clone();
      });
      const center = lods.mid.boundingSphere!.center;
      const spheres = list.map((p) => new THREE.Sphere(new THREE.Vector3(p.x + center.x * p.scale, p.y + center.y * p.scale, p.z + center.z * p.scale), radius * p.scale));
      this.sets.push({ kind, meshes, shadows, matrices, spheres, far: [], small: radius < SMALL_RADIUS, hiReady: false });
    }
  }

  /** Quantos modelos ainda esperam o nível completo. */
  get pending(): number {
    return this.sets.filter((s) => !s.hiReady).length;
  }

  /**
   * Monta o nível completo de um modelo pendente (o que estiver mais perto primeiro). Chamado uma
   * vez por quadro até acabar: espalha o custo em vez de travar o boot.
   */
  buildPending(): boolean {
    const set = this.sets.filter((s) => !s.hiReady).sort((a, b) => b.meshes.hi.count - a.meshes.hi.count)[0];
    if (!set) return false;
    const old = set.meshes.hi.geometry;
    set.meshes.hi.geometry = buildHi(set.kind);
    if (old !== set.meshes.mid.geometry) old.dispose();
    set.hiReady = true;
    return true;
  }

  /** Monta tudo de uma vez (testes e lab). */
  buildAll(): void {
    while (this.buildPending());
  }

  /** Redistribui as instâncias pelos níveis (se a câmera andou) e recorta o nível longe pela visão. */
  update(camera: THREE.Camera, force = false): void {
    const pos = camera.position;
    if (force || this.last.distanceTo(new THREE.Vector2(pos.x, pos.z)) >= REFRESH_STEP) {
      this.last.set(pos.x, pos.z);
      this.assign(pos.x, pos.z);
    }
    camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    this.shown.lo = 0;
    for (const set of this.sets) {
      const mesh = set.meshes.lo;
      let n = 0;
      for (const i of set.far) if (this.frustum.intersectsSphere(set.spheres[i]!)) mesh.setMatrixAt(n++, set.matrices[i]!);
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      this.shown.lo += n;
    }
  }

  private assign(x: number, z: number): void {
    this.shown.hi = this.shown.mid = 0;
    for (const set of this.sets) {
      const counts = { hi: 0, mid: 0 };
      set.far = [];
      set.spheres.forEach((s, i) => {
        const d = Math.hypot(s.center.x - x, s.center.z - z);
        if (d < LOD_HI) {
          set.meshes.hi.setMatrixAt(counts.hi, set.matrices[i]!);
          set.shadows.hi.setMatrixAt(counts.hi++, set.matrices[i]!);
        } else if (d < LOD_MID) {
          set.meshes.mid.setMatrixAt(counts.mid, set.matrices[i]!);
          set.shadows.mid.setMatrixAt(counts.mid++, set.matrices[i]!);
        }
        else if (!set.small || d < SMALL_CULL) set.far.push(i);
      });
      for (const level of ["hi", "mid"] as const) {
        for (const mesh of [set.meshes[level], set.shadows[level]]) {
          mesh.count = counts[level];
          mesh.visible = counts[level] > 0;
          mesh.instanceMatrix.needsUpdate = true;
          // Esfera só das instâncias deste nível: o recorte de câmera descarta o nível inteiro fora da tela.
          if (mesh.count > 0) mesh.computeBoundingSphere();
        }
        this.shown[level] += counts[level];
      }
    }
  }
}
