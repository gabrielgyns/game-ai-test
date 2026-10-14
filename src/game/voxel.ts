import * as THREE from "three";

/**
 * Construtor de malhas voxel. Você "pinta" cubos numa grade inteira e ele gera uma única
 * BufferGeometry com cores por vértice, descartando faces internas (entre dois cubos).
 * Pense nele como LEGO: cada peça é um cubo de 1 unidade; `scale` diz quantos metros tem a peça.
 */
export class VoxelBuilder {
  private readonly voxels = new Map<string, THREE.Color>();

  private key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  set(x: number, y: number, z: number, color: THREE.ColorRepresentation): this {
    this.voxels.set(this.key(x, y, z), new THREE.Color(color));
    return this;
  }

  /** Preenche a caixa [x0,x1) × [y0,y1) × [z0,z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.ColorRepresentation): this {
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) this.set(x, y, z, color);
    return this;
  }

  /** Preenche um "disco" arredondado em y (útil para gosmas e copas de árvore). */
  disc(cx: number, y: number, cz: number, radius: number, color: THREE.ColorRepresentation): this {
    const r = Math.ceil(radius);
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++)
        if (x * x + z * z <= radius * radius + 0.3) this.set(cx + x, y, cz + z, color);
    return this;
  }

  has(x: number, y: number, z: number): boolean {
    return this.voxels.has(this.key(x, y, z));
  }

  /**
   * Gera a geometria. Faces vizinhas, coplanares e da mesma cor são fundidas num único
   * retângulo (greedy meshing): uma copa de árvore 8×3×8 vira ~6 quads em vez de ~224.
   */
  build(scale: number, jitter = 0.06): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const tmp = new THREE.Color();

    for (const face of FACES) {
      // Agrupa as faces expostas desta direção por camada (coordenada ao longo da normal).
      const layers = new Map<number, Map<string, { u: number; v: number; color: THREE.Color }>>();
      for (const [key, color] of this.voxels) {
        const [x, y, z] = key.split(",").map(Number) as [number, number, number];
        if (this.has(x + face.n[0], y + face.n[1], z + face.n[2])) continue;
        const p = [x, y, z] as const;
        const d = p[face.axis];
        const u = p[face.uAxis];
        const v = p[face.vAxis];
        let layer = layers.get(d);
        if (!layer) layers.set(d, (layer = new Map()));
        layer.set(`${u},${v}`, { u, v, color });
      }

      for (const [d, layer] of layers) {
        const done = new Set<string>();
        for (const [k, cell] of layer) {
          if (done.has(k)) continue;
          const same = (u: number, v: number) => {
            const c = layer.get(`${u},${v}`);
            return c !== undefined && !done.has(`${u},${v}`) && c.color.equals(cell.color);
          };
          // Estende em u, depois em v enquanto a linha inteira combinar.
          let w = 1;
          while (same(cell.u + w, cell.v)) w++;
          let h = 1;
          outer: for (;;) {
            for (let i = 0; i < w; i++) if (!same(cell.u + i, cell.v + h)) break outer;
            h++;
          }
          for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) done.add(`${cell.u + i},${cell.v + j}`);

          const shade = 1 + (hash(cell.u, d, cell.v) - 0.5) * jitter * 2;
          tmp.copy(cell.color).multiplyScalar(shade * face.light);
          const plane = d + (face.n[face.axis] > 0 ? 1 : 0);
          const corner = (u: number, v: number): [number, number, number] => {
            const out: [number, number, number] = [0, 0, 0];
            out[face.axis] = plane;
            out[face.uAxis] = u;
            out[face.vAxis] = v;
            return out;
          };
          const corners = [
            corner(cell.u, cell.v),
            corner(cell.u + w, cell.v),
            corner(cell.u + w, cell.v + h),
            corner(cell.u, cell.v + h),
          ];
          // Garante winding anti-horário visto de fora: (c1-c0)×(c2-c0) deve apontar como a normal.
          const [c0, c1, c2] = corners as [[number, number, number], [number, number, number], [number, number, number]];
          const ax = c1[0] - c0[0], ay = c1[1] - c0[1], az = c1[2] - c0[2];
          const bx = c2[0] - c0[0], by = c2[1] - c0[1], bz = c2[2] - c0[2];
          const cross = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
          if (cross[0]! * face.n[0] + cross[1]! * face.n[1] + cross[2]! * face.n[2] < 0) corners.reverse();
          const base = positions.length / 3;
          for (const c of corners) {
            positions.push(c[0] * scale, c[1] * scale, c[2] * scale);
            normals.push(face.n[0], face.n[1], face.n[2]);
            colors.push(tmp.r, tmp.g, tmp.b);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function hash(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

interface Face {
  n: [number, number, number];
  /** Eixo da normal e os dois eixos do plano (0 = x, 1 = y, 2 = z). */
  axis: 0 | 1 | 2;
  uAxis: 0 | 1 | 2;
  vAxis: 0 | 1 | 2;
  /** Multiplicador de luz "cozido" por direção, reforça a leitura dos blocos. */
  light: number;
}

const FACES: Face[] = [
  { n: [0, 1, 0], axis: 1, uAxis: 0, vAxis: 2, light: 1.0 },
  { n: [0, -1, 0], axis: 1, uAxis: 0, vAxis: 2, light: 0.55 },
  { n: [1, 0, 0], axis: 0, uAxis: 1, vAxis: 2, light: 0.86 },
  { n: [-1, 0, 0], axis: 0, uAxis: 1, vAxis: 2, light: 0.78 },
  { n: [0, 0, 1], axis: 2, uAxis: 0, vAxis: 1, light: 0.9 },
  { n: [0, 0, -1], axis: 2, uAxis: 0, vAxis: 1, light: 0.72 },
];

export const voxelMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
