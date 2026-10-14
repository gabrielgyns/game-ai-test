import * as THREE from "three";
import { cellToWorld, type DungeonRun } from "../domain/dungeon";
import { Tile, tileOf, type DungeonLayout } from "../domain/dungeonLayout";
import { createPortal, type Portal } from "./portal";
import { VoxelBuilder, voxelMaterial } from "./voxel";

/**
 * A cripta desenhada a partir da planta do domínio: piso de lajes, paredes de tijolo nas células
 * vazias que encostam no chão, pilares, tochas nas paredes (com um punhado de luzes que acompanham o
 * herói), portais e o baú. Montada ao entrar e desmontada ao sair.
 */
const WALL_HEIGHT_VOX = 10; // 2,5 m em voxels de 1/4 m

function floorGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const base = ["#55525c", "#4d4a54", "#5c5862"][variant % 3]!;
  b.box(0, -1, 0, 4, 0, 4, base);
  // Junta escura entre lajes e, às vezes, uma rachadura.
  b.box(0, -1, 0, 4, 0, 1, "#3a3840").box(0, -1, 0, 1, 0, 4, "#3a3840");
  if (variant === 1) b.set(2, -1, 2, "#2e2c33").set(3, -1, 2, "#2e2c33");
  if (variant === 2) b.set(1, -1, 3, "#4a5a3a").set(2, -1, 3, "#4a5a3a"); // musgo
  return b.build(1 / 4, { jitter: 0.04, ao: false });
}

function wallGeometry(variant: number): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const brick = ["#6a5f58", "#625750"][variant % 2]!;
  const mortar = "#3e3833";
  b.box(0, 0, 0, 4, WALL_HEIGHT_VOX, 4, brick);
  // Tijolos: linha de argamassa a cada 2 voxels, juntas verticais alternadas.
  for (let y = 1; y < WALL_HEIGHT_VOX; y += 2) {
    b.box(0, y, 0, 4, y + 1, 4, mortar).carve(1, y, 1, 3, y + 1, 3);
    const off = (y >> 1) % 2 ? 1 : 3;
    b.box(off, y + 1, 0, off + 1, y + 2, 4, mortar).carve(1, y + 1, 1, 3, y + 2, 3);
  }
  b.box(0, WALL_HEIGHT_VOX - 1, 0, 4, WALL_HEIGHT_VOX, 4, "#7a6e66"); // topo gasto
  if (variant === 1) b.set(0, 1, 2, "#4a6a3a").set(1, 0, 0, "#4a6a3a").set(3, 2, 0, "#4a6a3a"); // musgo na base
  return b.build(1 / 4, { jitter: 0.05, ao: true, aoStrength: 0.35 });
}

function pillarGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(0, 0, 0, 4, 12, 4, "#7a7480");
  b.box(0, 0, 0, 4, 1, 4, "#5a5560").box(0, 11, 0, 4, 12, 4, "#8a8490");
  for (let y = 3; y < 11; y += 3) b.box(0, y, 0, 4, y + 1, 4, "#66606c");
  return b.build(1 / 4, { jitter: 0.04, ao: true, aoStrength: 0.3 });
}

function sconceGeometry(): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  b.box(-1, 0, 0, 1, 1, 3, "#3a3632").box(-1, 1, 2, 1, 3, 4, "#4a4540"); // haste e copo
  return b.build(1 / 8, { jitter: 0, ao: false });
}

function flameGeometry(): THREE.BufferGeometry {
  return new VoxelBuilder()
    .box(-1, 0, -1, 1, 2, 1, "#ff7a1a")
    .box(-1, 2, 0, 1, 3, 1, "#ffb43a")
    .set(0, 3, 0, "#ffe08a")
    .build(1 / 8, { jitter: 0, ao: false });
}

function chestGeometry(lid: boolean): THREE.BufferGeometry {
  const b = new VoxelBuilder();
  const wood = "#7a4a2a", dark = "#5a3420", gold = "#d4a92a";
  if (!lid) {
    b.box(-6, 0, -4, 6, 6, 4, wood).box(-6, 0, -4, 6, 1, 4, dark);
    for (const x of [-6, -1, 4]) b.box(x, 0, -4, x + 2, 6, 4, gold);
    b.box(-1, 3, -5, 1, 5, -4, gold).set(0, 3, -5, "#1b1b1b"); // fechadura
  } else {
    b.box(-6, 0, -8, 6, 3, 0, wood).box(-6, 2, -8, 6, 3, 0, "#8a5a32");
    for (const x of [-6, -1, 4]) b.box(x, 0, -8, x + 2, 3, 0, gold);
  }
  return b.build(1 / 8, { grain: 0.05, grainScale: 2 });
}

/** Paredes: células vazias com algum chão (ou pilar) em volta, nas 8 direções. */
function wallCells(layout: DungeonLayout): { i: number; j: number }[] {
  const out: { i: number; j: number }[] = [];
  for (let j = 0; j < layout.height; j++)
    for (let i = 0; i < layout.width; i++) {
      if (tileOf(layout, i, j) !== Tile.Void) continue;
      let near = false;
      for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1 && !near; di++) if (tileOf(layout, i + di, j + dj) !== Tile.Void) near = true;
      if (near) out.push({ i, j });
    }
  return out;
}

/**
 * Recorte de paredes: o shader descarta os pixels de parede que ficam dentro de um funil entre a câmera
 * e o herói, para a parede da frente nunca tapar a luta (o mesmo truque de jogos vistos de cima).
 */
const cutUniforms = { uCutCam: { value: new THREE.Vector3() }, uCutPlayer: { value: new THREE.Vector3(0, -999, 0) } };

function cutawayMaterial(): THREE.MeshStandardMaterial {
  const m = voxelMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCutCam = cutUniforms.uCutCam;
    shader.uniforms.uCutPlayer = cutUniforms.uCutPlayer;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutWorld;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vec4 cutWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cutWorld = instanceMatrix * cutWorld;
#endif
vCutWorld = (modelMatrix * cutWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutWorld;\nuniform vec3 uCutCam;\nuniform vec3 uCutPlayer;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
vec3 cutSeg = uCutPlayer - uCutCam;
float cutT = clamp(dot(vCutWorld - uCutCam, cutSeg) / max(dot(cutSeg, cutSeg), 0.001), 0.0, 1.0);
float cutD = length(vCutWorld - (uCutCam + cutSeg * cutT));
// Funil: largo perto da câmera, estreito perto do herói (só a parede "da frente" some).
if (cutT < 0.94 && cutD < mix(9.0, 1.7, cutT) && vCutWorld.y > 0.3) discard;`,
      );
  };
  m.customProgramCacheKey = () => "dungeon-cutaway";
  return m;
}

export class DungeonView {
  readonly group = new THREE.Group();
  private run: DungeonRun | null = null;
  private torches: THREE.Vector3[] = [];
  private flames: THREE.InstancedMesh | null = null;
  private readonly lights: THREE.PointLight[] = [];
  private startPortal: Portal | null = null;
  private exitPortal: Portal | null = null;
  private chestLid: THREE.Object3D | null = null;
  private chest: THREE.Group | null = null;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    // Luzes de tocha: sempre na cena (para não recompilar shaders), apagadas fora da cripta.
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight("#ffa04a", 0, 13, 1.3);
      this.lights.push(l);
      scene.add(l);
    }
  }

  get active(): boolean {
    return this.run !== null;
  }

  update(run: DungeonRun | undefined, focus: THREE.Vector3, time: number, camera?: THREE.Camera): void {
    if ((run ?? null) !== this.run) this.rebuild(run ?? null);
    if (camera) {
      cutUniforms.uCutCam.value.copy(camera.position);
      cutUniforms.uCutPlayer.value.set(focus.x, focus.y + 1.2, focus.z);
    }
    if (!this.run) {
      for (const l of this.lights) l.intensity = 0;
      return;
    }
    // As 6 tochas mais próximas do herói ganham luz de verdade; as outras só brilham.
    const nearest = this.torches
      .map((t) => ({ t, d: (t.x - focus.x) ** 2 + (t.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length);
    this.lights.forEach((l, i) => {
      const n = nearest[i];
      if (!n) return void (l.intensity = 0);
      l.position.copy(n.t).add(new THREE.Vector3(0, 0.4, 0));
      l.intensity = 9 + Math.sin(time * 11 + i * 2.1) * 1.2 + Math.sin(time * 17 + i) * 0.6;
    });
    if (this.flames) {
      this.torches.forEach((t, i) => {
        this.dummy.position.copy(t);
        this.dummy.rotation.set(0, time * 1.3 + i, 0);
        this.dummy.scale.set(1, 1 + Math.sin(time * 9 + i * 1.7) * 0.15, 1);
        this.dummy.updateMatrix();
        this.flames!.setMatrixAt(i, this.dummy.matrix);
      });
      this.flames.instanceMatrix.needsUpdate = true;
    }
    this.startPortal?.update(time);
    if (this.run.exitPortal && !this.exitPortal) {
      this.exitPortal = createPortal("#5ad8a0");
      this.exitPortal.group.position.set(this.run.exitPortal.x, 0, this.run.exitPortal.z);
      this.exitPortal.group.rotation.y = Math.PI / 2;
      this.group.add(this.exitPortal.group);
    }
    this.exitPortal?.update(time);
    if (this.run.chest && !this.chest) this.buildChest(this.run.chest.position);
    if (this.chestLid && this.run.chest?.opened) {
      this.chestLid.rotation.x += (-1.9 - this.chestLid.rotation.x) * 0.15; // tampa abre
    }
  }

  private buildChest(at: { x: number; z: number }): void {
    this.chest = new THREE.Group();
    const body = new THREE.Mesh(chestGeometry(false), voxelMaterial());
    const lid = new THREE.Mesh(chestGeometry(true), voxelMaterial());
    body.castShadow = lid.castShadow = true;
    const hinge = new THREE.Group();
    hinge.position.set(0, 6 / 8, 4 / 8);
    hinge.add(lid);
    this.chest.add(body, hinge);
    this.chest.position.set(at.x, 0, at.z);
    this.chestLid = hinge;
    this.group.add(this.chest);
  }

  private clear(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry && !(m.geometry as { userData?: { shared?: boolean } }).userData?.shared) m.geometry.dispose();
      });
    }
    this.torches = [];
    this.flames = null;
    this.startPortal = this.exitPortal = null;
    this.chest = null;
    this.chestLid = null;
  }

  private rebuild(run: DungeonRun | null): void {
    this.clear();
    this.run = run;
    if (!run) return;
    const L = run.layout;

    // Piso e pilares.
    const floors: { i: number; j: number }[] = [];
    const pillars: { i: number; j: number }[] = [];
    for (let j = 0; j < L.height; j++)
      for (let i = 0; i < L.width; i++) {
        const t = tileOf(L, i, j);
        if (t === Tile.Floor || t === Tile.Pillar) floors.push({ i, j });
        if (t === Tile.Pillar) pillars.push({ i, j });
      }
    const place = (mesh: THREE.InstancedMesh, cells: { i: number; j: number }[], y = 0, rotate = false) => {
      cells.forEach((c, k) => {
        const p = cellToWorld(c.i, c.j);
        this.dummy.position.set(p.x - 0.5, y, p.z - 0.5);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(1);
        if (rotate) {
          // Gira em torno do centro da célula para variar o desenho.
          const r = ((c.i * 7 + c.j * 13) % 4) * (Math.PI / 2);
          this.dummy.position.set(p.x, y, p.z);
          this.dummy.rotation.y = r;
          this.dummy.position.add(new THREE.Vector3(-0.5, 0, -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), r));
        }
        this.dummy.updateMatrix();
        mesh.setMatrixAt(k, this.dummy.matrix);
      });
      mesh.computeBoundingSphere();
    };
    for (let v = 0; v < 3; v++) {
      const cells = floors.filter((c) => (c.i * 31 + c.j * 17) % 3 === v);
      const mesh = new THREE.InstancedMesh(floorGeometry(v), voxelMaterial(), cells.length);
      mesh.receiveShadow = true;
      place(mesh, cells, 0, true);
      this.group.add(mesh);
    }
    const walls = wallCells(L);
    for (let v = 0; v < 2; v++) {
      const cells = walls.filter((c) => ((c.i * 13 + c.j * 7) % 5 === 0 ? 1 : 0) === v);
      const mesh = new THREE.InstancedMesh(wallGeometry(v), cutawayMaterial(), cells.length);
      mesh.castShadow = mesh.receiveShadow = true;
      place(mesh, cells);
      this.group.add(mesh);
    }
    const pillarMesh = new THREE.InstancedMesh(pillarGeometry(), cutawayMaterial(), pillars.length);
    pillarMesh.castShadow = pillarMesh.receiveShadow = true;
    place(pillarMesh, pillars);
    this.group.add(pillarMesh);

    // Tochas: em paredes com chão logo ao lado (N/S/L/O), espaçadas pela grade.
    const torchSpots: { pos: THREE.Vector3; yaw: number }[] = [];
    for (const c of walls) {
      if ((c.i + c.j * 3) % 7 !== 0) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (tileOf(L, c.i + di, c.j + dj) !== Tile.Floor) continue;
        const p = cellToWorld(c.i, c.j);
        torchSpots.push({ pos: new THREE.Vector3(p.x + di * 0.55, 1.7, p.z + dj * 0.55), yaw: Math.atan2(di, dj) });
        break;
      }
    }
    const sconces = new THREE.InstancedMesh(sconceGeometry(), voxelMaterial(), torchSpots.length);
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    flameMat.color.setScalar(2.2); // acima de 1: brilha no bloom
    this.flames = new THREE.InstancedMesh(flameGeometry(), flameMat, torchSpots.length);
    torchSpots.forEach((s, k) => {
      this.dummy.position.copy(s.pos).add(new THREE.Vector3(-Math.sin(s.yaw) * 0.45, -0.3, -Math.cos(s.yaw) * 0.45));
      this.dummy.rotation.set(0, s.yaw, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      sconces.setMatrixAt(k, this.dummy.matrix);
      this.torches.push(s.pos.clone().add(new THREE.Vector3(0, 0.05, 0)));
    });
    this.group.add(sconces, this.flames);

    this.startPortal = createPortal("#9a5aff");
    this.startPortal.group.position.set(run.startPortal.x, 0, run.startPortal.z);
    this.startPortal.group.rotation.y = Math.PI / 2;
    this.group.add(this.startPortal.group);
  }
}
