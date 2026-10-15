import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";

/**
 * Estilo "HQ": o jogo desenhado como uma página de quadrinho pintada.
 *
 * Três ingredientes, todos de apresentação (o domínio não sabe que existem):
 * - nanquim: um passe de pós-processamento que lê a profundidade e risca linhas escuras nas
 *   silhuetas e nas dobras, como o arte-finalista que passa a caneta por cima do lápis;
 * - luz em degraus: a luz do sol deixa de ser um degradê e vira 3 tons chapados (cel shading);
 * - contorno do herói: uma casca vermelha atrás do personagem, para achá-lo no meio da multidão.
 *
 * `?estilo=classico` na URL desliga tudo e mostra o visual anterior, para comparar.
 */
export const HQ_STYLE = typeof location === "undefined" || new URLSearchParams(location.search).get("estilo") !== "classico";

/**
 * Troca o "dotNL" da luz direta por uma rampa de degraus. Mexe no pedaço de shader que todos os
 * MeshStandardMaterial compartilham, então precisa rodar antes de o primeiro material compilar.
 */
export function applyToonLighting(): void {
  const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  // O texto do shader muda de espaços entre o código-fonte e o build do three: casa por regex.
  const from = /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/;
  if (!from.test(chunk)) {
    console.warn("estilo HQ: shader de luz mudou; luz em degraus desligada");
    return;
  }
  // Degraus suaves (smoothstep curto) para a borda entre tons não serrilhar.
  const to = [
    "float dotNLRaw = saturate( dot( geometryNormal, directLight.direction ) );",
    "\tfloat dotNL = 0.38 + 0.32 * smoothstep( 0.08, 0.14, dotNLRaw ) + 0.3 * smoothstep( 0.55, 0.62, dotNLRaw );",
    "\tdotNL *= step( 0.001, dotNLRaw );",
    "\tvec3 irradiance = dotNL * directLight.color;",
  ].join("\n");
  THREE.ShaderChunk.lights_physical_pars_fragment = chunk.replace(from, to);
}

export interface InkOptions {
  /** Cor da tinta (um marrom quase preto fica mais "pintado" que o preto puro). */
  color?: THREE.ColorRepresentation;
  /** Distância (m) em que as linhas começam a sumir e em que somem de vez. */
  fade?: [number, number];
  /** Saturação extra das cores (1 = igual). */
  saturation?: number;
}

const inkShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2() },
    near: { value: 0.1 },
    far: { value: 400 },
    ink: { value: new THREE.Color() },
    fade: { value: new THREE.Vector2(45, 120) },
    saturation: { value: 1.15 },
    /** Limiares: silhueta (salto relativo de distância) e dobra (curvatura de 1/z). */
    silhouetteRange: { value: new THREE.Vector2(0.012, 0.03) },
    creaseRange: { value: new THREE.Vector2(0.004, 0.012) },
    debug: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 texel;
    uniform float near;
    uniform float far;
    uniform vec3 ink;
    uniform vec2 fade;
    uniform float saturation;
    uniform vec2 silhouetteRange;
    uniform vec2 creaseRange;
    uniform float debug;
    varying vec2 vUv;

    // Distância (positiva) até a câmera.
    float viewDist(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return (near * far) / ((far - near) * d - far) * -1.0;
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float zc = viewDist(vUv);
      float zl = viewDist(vUv - vec2(texel.x, 0.0));
      float zr = viewDist(vUv + vec2(texel.x, 0.0));
      float zd = viewDist(vUv - vec2(0.0, texel.y));
      float zu = viewDist(vUv + vec2(0.0, texel.y));

      // Silhueta: um vizinho a uma distância bem diferente. Os dois lados da borda riscam, o que
      // dá uma linha com o dobro da grossura (o traço de contorno da HQ é mais grosso que o interno).
      float zmin = min(min(min(zl, zr), min(zu, zd)), zc);
      float zmax = max(max(max(zl, zr), max(zu, zd)), zc);
      float silhouette = smoothstep(silhouetteRange.x, silhouetteRange.y, (zmax - zmin) / zmin);

      // Dobra: em um plano, 1/z varia em linha reta na tela; a "curvatura" de 1/z acusa quinas.
      float wc = 1.0 / zc;
      float lap = abs((1.0 / zl + 1.0 / zr + 1.0 / zu + 1.0 / zd) - 4.0 * wc) / wc;
      float crease = smoothstep(creaseRange.x, creaseRange.y, lap) * 0.9;

      float edge = max(silhouette, crease);
      edge *= 1.0 - smoothstep(fade.x, fade.y, zc);
      edge *= step(zc, far * 0.98); // o céu não tem dobras

      vec3 color = base.rgb;
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, saturation);
      // A tinta não apaga o que brilha (neon e fogo continuam acesos por cima da linha).
      float glow = smoothstep(1.8, 2.6, max(max(base.r, base.g), base.b));
      color = mix(color, ink, edge * 0.92 * (1.0 - glow));
      if (debug > 0.5) color = vec3(1.0 - edge);
      gl_FragColor = vec4(color, base.a);
    }
  `,
};

/** Passe de nanquim: precisa que o alvo de render da cena tenha uma DepthTexture. */
export class InkPass extends Pass {
  readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(private readonly camera: THREE.PerspectiveCamera, options: InkOptions = {}) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(inkShader.uniforms),
      vertexShader: inkShader.vertexShader,
      fragmentShader: inkShader.fragmentShader,
    });
    this.material.uniforms.ink!.value = new THREE.Color(options.color ?? "#1c1410");
    if (options.fade) this.material.uniforms.fade!.value = new THREE.Vector2(...options.fade);
    if (options.saturation !== undefined) this.material.uniforms.saturation!.value = options.saturation;
    this.quad = new FullScreenQuad(this.material);
  }

  override setSize(width: number, height: number): void {
    // Vizinhos a 2 px (dos dois lados da borda): traço de uns 3 px, como caneta de arte-final.
    (this.material.uniforms.texel!.value as THREE.Vector2).set(2 / width, 2 / height);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms;
    u.tDiffuse!.value = readBuffer.texture;
    u.tDepth!.value = readBuffer.depthTexture;
    u.near!.value = this.camera.near;
    u.far!.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** Alvo de render da cena com profundidade legível pelo passe de nanquim. */
export function inkRenderTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Com estêncil: o contorno do herói usa a marca que as peças deixam nele.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, stencilBuffer: true });
  target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedInt248Type);
  target.depthTexture.format = THREE.DepthStencilFormat;
  return target;
}

const RIM_COLOR = new THREE.Color("#ff2a2a").multiplyScalar(1.25);
const RIM_STENCIL = 1;

/**
 * Contorno vermelho do herói: cada peça ganha uma casca um pouco maior, só com as faces de trás
 * (o truque do "casco invertido"). As peças marcam o estêncil e a casca só pinta fora dessa marca,
 * então o vermelho aparece só em volta da silhueta, nunca por cima do próprio herói.
 */
export function addHeroRim(root: THREE.Object3D): void {
  const material = new THREE.MeshBasicMaterial({
    color: RIM_COLOR,
    side: THREE.BackSide,
    fog: false,
    stencilWrite: true,
    stencilRef: RIM_STENCIL,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.KeepStencilOp,
  });
  const parts: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.rim || !(m.material instanceof THREE.MeshStandardMaterial)) return;
    if (m.material.transparent) return;
    parts.push(m);
  });
  for (const part of parts) {
    const body = part.material as THREE.MeshStandardMaterial;
    body.stencilWrite = true;
    body.stencilRef = RIM_STENCIL;
    body.stencilFunc = THREE.AlwaysStencilFunc;
    body.stencilZPass = THREE.ReplaceStencilOp;
    part.renderOrder = 1;
    const geometry = part.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // Espessura constante (~4 cm) em vez de proporcional: peça pequena não some, peça grande não engorda.
    const pad = 0.04;
    const hull = new THREE.Mesh(geometry, material);
    hull.userData.rim = true;
    hull.renderOrder = 2; // depois de todas as peças terem marcado o estêncil
    hull.scale.set(1 + (2 * pad) / Math.max(size.x, 0.01), 1 + (2 * pad) / Math.max(size.y, 0.01), 1 + (2 * pad) / Math.max(size.z, 0.01));
    hull.position.copy(center).multiply(new THREE.Vector3(1, 1, 1).sub(hull.scale));
    hull.castShadow = false;
    part.add(hull);
  }
}

/* ---------- Golpes de HQ: estrela de impacto e números de dano com cara de quadrinho ---------- */

interface Burst {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  size: number;
}

const burstTextures = new Map<string, THREE.Texture>();

/** Estrela de pontas irregulares com contorno de tinta: o "POW" sem a palavra. */
function burstTexture(fill: string): THREE.Texture {
  const cached = burstTextures.get(fill);
  if (cached) return cached;
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const spikes = 11;
  const star = (outer: number, inner: number): void => {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const jag = i % 2 === 0 ? 1 - ((i * 37) % 7) / 28 : 1; // pontas de tamanhos diferentes
      const r = (i % 2 === 0 ? outer * jag : inner);
      ctx.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.lineJoin = "miter";
  star(60, 28);
  ctx.fillStyle = "#1c1410";
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#1c1410";
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  star(30, 15);
  ctx.fillStyle = "#fff6e8";
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  burstTextures.set(fill, texture);
  return texture;
}

export class ComicBursts {
  private items: Burst[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  spawn(position: { x: number; y: number; z: number }, heavy: boolean, fill = "#e8358a"): void {
    const material = new THREE.SpriteMaterial({ map: burstTexture(fill), transparent: true, depthTest: false, rotation: Math.random() * Math.PI });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(position.x + (Math.random() - 0.5) * 0.5, position.y + (Math.random() - 0.3) * 0.4, position.z + (Math.random() - 0.5) * 0.5);
    sprite.renderOrder = 19;
    this.scene.add(sprite);
    this.items.push({ sprite, age: 0, life: heavy ? 0.42 : 0.3, size: heavy ? 1.15 : 0.75 });
  }

  update(dt: number): void {
    this.items = this.items.filter((b) => {
      b.age += dt;
      const t = b.age / b.life;
      // Estoura rápido (passa um pouco do tamanho) e encolhe sumindo.
      const pop = t < 0.3 ? (t / 0.3) * 1.15 : 1.15 - (t - 0.3) * 0.5;
      b.sprite.scale.setScalar(b.size * pop);
      (b.sprite.material as THREE.SpriteMaterial).opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      if (t >= 1) {
        this.scene.remove(b.sprite);
        b.sprite.material.dispose();
        return false;
      }
      return true;
    });
  }
}
