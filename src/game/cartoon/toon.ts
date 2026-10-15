import * as THREE from "three";

/**
 * Peças do visual cartoon: formas lisas (cápsulas, esferas, caixas arredondadas) com cor chapada e
 * contorno de tinta. É o oposto do voxel: em vez de empilhar cubos, modela-se com "massinha".
 *
 * O contorno é o truque do casco invertido: uma cópia da peça, inflada ao longo das normais e
 * desenhada só pelas costas, em tinta escura. Como as formas são lisas, as normais são contínuas e a
 * casca não racha nas quinas (no voxel ela rachava, por isso lá se usa só o passe de nanquim).
 */

/** Cor chapada; a luz em degraus do estilo HQ faz o resto. */
export function toonMaterial(color: THREE.ColorRepresentation, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

/** Material que brilha na cor da raridade (o neon); a intensidade pulsa pelo glowMaterials. */
export function neonMaterial(color: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, intensity: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0 });
  m.emissive = new THREE.Color(glow);
  m.emissiveIntensity = intensity;
  return m;
}

const outlineCache = new Map<string, THREE.MeshBasicMaterial>();

/** Tinta do contorno, inflada `thickness` metros ao longo das normais no vertex shader. */
export function outlineMaterial(thickness: number, color: THREE.ColorRepresentation = "#1c1410"): THREE.MeshBasicMaterial {
  const key = `${thickness}|${new THREE.Color(color).getHexString()}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = vec3( position ) + normalize( normal ) * ${thickness.toFixed(4)};`,
    );
  };
  // Cada espessura compila o próprio programa (o valor está no código do shader).
  m.customProgramCacheKey = () => `outline-${thickness}`;
  outlineCache.set(key, m);
  return m;
}

export interface PartOptions {
  /** Espessura do contorno em metros (0 = sem contorno). */
  ink?: number;
  castShadow?: boolean;
}

/** Monta uma peça lisa com contorno. A casca é filha da peça, então acompanha qualquer transformação. */
export function part(geometry: THREE.BufferGeometry, material: THREE.Material, options: PartOptions = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.userData.smooth = true;
  const ink = options.ink ?? 0.018;
  if (ink > 0) {
    const hull = new THREE.Mesh(geometry, outlineMaterial(ink));
    hull.userData.ink = true;
    hull.castShadow = false;
    mesh.add(hull);
  }
  return mesh;
}

/* ---------- Formas ---------- */

/** Caixa de cantos arredondados com normais suaves (boa para placas de armadura e botas). */
export function roundedBox(w: number, h: number, d: number, radius: number, segments = 3): THREE.BufferGeometry {
  // Começa de uma esfera achatada em cubo: cada vértice é empurrado para a caixa e arredondado nas quinas.
  const g = new THREE.BoxGeometry(1, 1, 1, segments * 2 + 2, segments * 2 + 2, segments * 2 + 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normals: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).multiply(new THREE.Vector3(w, h, d));
    const core = new THREE.Vector3(
      THREE.MathUtils.clamp(v.x, -inner.x, inner.x),
      THREE.MathUtils.clamp(v.y, -inner.y, inner.y),
      THREE.MathUtils.clamp(v.z, -inner.z, inner.z),
    );
    n.subVectors(v, core);
    if (n.lengthSq() < 1e-10) n.set(0, 1, 0);
    n.normalize();
    v.copy(core).addScaledVector(n, r);
    pos.setXYZ(i, v.x, v.y, v.z);
    normals.push(n.x, n.y, n.z);
  }
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  // Os vértices das faces do cubo ficaram duplicados nas arestas; funde para o contorno não rachar.
  return mergeByPosition(g);
}

/** Funde vértices na mesma posição (média das normais), para a casca do contorno ficar inteira. */
export function mergeByPosition(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const nor = src.attributes.normal as THREE.BufferAttribute;
  const map = new Map<string, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = positions.length / 3;
      map.set(key, k);
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(0, 0, 0);
    }
    normals[k * 3]! += nor.getX(i);
    normals[k * 3 + 1]! += nor.getY(i);
    normals[k * 3 + 2]! += nor.getZ(i);
    index.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const n = new THREE.Vector3();
  for (let k = 0; k < normals.length; k += 3) {
    n.set(normals[k]!, normals[k + 1]!, normals[k + 2]!).normalize();
    normals[k] = n.x; normals[k + 1] = n.y; normals[k + 2] = n.z;
  }
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setIndex(index);
  return out;
}

/** Cápsula vertical com a base em y = 0 (fácil de pendurar num pivô de articulação). */
export function capsule(radius: number, length: number, radial = 12): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(radius, length, 4, radial);
  g.translate(0, -(length / 2 + radius), 0); // topo no pivô, pendurada para baixo
  return mergeByPosition(g);
}

/** Esfera (ou elipsoide, com escala) já fundida para o contorno. */
export function ball(radius: number, w = 16, h = 12): THREE.BufferGeometry {
  return mergeByPosition(new THREE.SphereGeometry(radius, w, h));
}

/** Tronco de cone com tampas: peito em V, cano de bota, guarda de espada. */
export function frustum(rTop: number, rBottom: number, height: number, radial = 14): THREE.BufferGeometry {
  return mergeByPosition(new THREE.CylinderGeometry(rTop, rBottom, height, radial, 1, false));
}

export function cone(radius: number, height: number, radial = 10): THREE.BufferGeometry {
  return mergeByPosition(new THREE.ConeGeometry(radius, height, radial));
}

/** Lâmina: losango alongado, gordo no meio e fino nas pontas e no fio. */
export function bladeGeometry(length: number, width: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, -length * 0.82);
  shape.lineTo(0, -length);
  shape.lineTo(-width / 2, -length * 0.82);
  shape.lineTo(-width / 2, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.5, bevelSize: thickness * 0.6, bevelSegments: 1 });
  g.translate(0, 0, -thickness / 2);
  g.computeVertexNormals();
  return mergeByPosition(g);
}
