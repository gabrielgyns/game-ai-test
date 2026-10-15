import * as THREE from "three";
import { DUNGEON_REGION_X, terrainHeight } from "../../domain/terrain";

/**
 * Chão do estilo HQ: o mesmo relevo do domínio (em degraus de 0,5 m), desenhado liso e pintado.
 *
 * - Relevo: cada canto de célula fica na média das 4 células em volta; os degraus viram rampas
 *   suaves. O domínio não muda (colisão e alturas continuam nos degraus); só os pés dos personagens
 *   acompanham a superfície lisa (`groundOffset`), no máximo um quarto de degrau de diferença.
 * - Pintura: três texturas desenhadas por código em canvas (grama em pinceladas, paralelepípedos e
 *   terra salpicada) multiplicam a cor de cada célula. É a "aquarela por cima do lápis".
 */

/** Altura de um canto de célula (coordenadas inteiras): média das 4 células que o tocam. */
export function cornerHeight(x: number, z: number): number {
  return (terrainHeight(x - 0.5, z - 0.5) + terrainHeight(x + 0.5, z - 0.5) + terrainHeight(x - 0.5, z + 0.5) + terrainHeight(x + 0.5, z + 0.5)) / 4;
}

/** Altura da superfície lisa em (x, z): interpolação dos 4 cantos da célula. */
export function smoothGroundHeight(x: number, z: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = x - x0, fz = z - z0;
  const a = cornerHeight(x0, z0), b = cornerHeight(x0 + 1, z0);
  const c = cornerHeight(x0, z0 + 1), d = cornerHeight(x0 + 1, z0 + 1);
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

/**
 * Quanto subir ou descer um personagem em pé para os pés tocarem o chão liso. Só vale para quem
 * está no chão (pulando ou voando segue a altura do domínio) e fora das dungeons (chão plano).
 */
export function groundOffset(x: number, y: number, z: number): number {
  if (x >= DUNGEON_REGION_X) return 0;
  const step = terrainHeight(x, z);
  if (Math.abs(y - step) > 0.05) return 0;
  return smoothGroundHeight(x, z) - step;
}

/* ---------- Texturas pintadas (cinza 50% = cor da célula intacta) ---------- */

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 1234567;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  draw(ctx, rand);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace; // os valores são multiplicadores, não cores
  t.anisotropy = 4;
  return t;
}

/** Desenha nas 9 posições (o centro e as 8 vizinhas) para a textura repetir sem costura. */
function tiled(size: number, fn: (dx: number, dy: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
}

const grey = (v: number, a = 1): string => `rgba(${v},${v},${v},${a})`;

/** Manchas grandes e suaves: o "tom de aquarela" que varia pelo chão. */
function blotches(ctx: CanvasRenderingContext2D, rand: () => number, size: number, count: number, spread: number): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size, r = size * (0.08 + rand() * 0.18);
    const v = 128 + (rand() - 0.5) * spread;
    tiled(size, (dx, dy) => {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, grey(Math.round(v), 0.55));
      g.addColorStop(1, grey(Math.round(v), 0));
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }
}

/** Grama: tufos em "V" de traço escuro e algumas folhas claras, como pinceladas rápidas. */
export function grassTexture(): THREE.CanvasTexture {
  const S = 512;
  return canvasTexture(S, (ctx, rand) => {
    blotches(ctx, rand, S, 26, 40);
    ctx.lineCap = "round";
    for (let i = 0; i < 260; i++) {
      const x = rand() * S, y = rand() * S;
      const h = 7 + rand() * 9;
      const dark = rand() < 0.7;
      tiled(S, (dx, dy) => {
        ctx.strokeStyle = dark ? grey(70, 0.75) : grey(185, 0.7);
        ctx.lineWidth = dark ? 2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(x + dx - h * 0.45, y + dy - h);
        ctx.lineTo(x + dx, y + dy);
        ctx.lineTo(x + dx + h * 0.35, y + dy - h * 0.9);
        if (rand() < 0.5) {
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + 1, y + dy - h * 1.1);
        }
        ctx.stroke();
      });
    }
  });
}

/** Paralelepípedos em fileiras levemente tortas: pedra clara, junta de tinta e um brilho no topo. */
export function cobbleTexture(): THREE.CanvasTexture {
  const S = 512;
  return canvasTexture(S, (ctx, rand) => {
    ctx.fillStyle = grey(60);
    ctx.fillRect(0, 0, S, S);
    const rows = 12;
    const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * rh;
      while (x < S) {
        const w = rh * (0.9 + rand() * 0.8);
        const y = r * rh;
        const v = 130 + Math.round((rand() - 0.5) * 40);
        const inset = 3;
        const draw = (dx: number): void => {
          ctx.beginPath();
          ctx.roundRect(x + dx + inset, y + inset, w - inset * 2, rh - inset * 2, 7);
          ctx.fillStyle = grey(v);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = grey(35);
          ctx.stroke();
          // Brilho de cima e sombra de baixo: a pedra parece abaulada.
          ctx.fillStyle = grey(175, 0.5);
          ctx.fillRect(x + dx + inset + 5, y + inset + 4, w - inset * 2 - 12, 3);
          ctx.fillStyle = grey(70, 0.35);
          ctx.fillRect(x + dx + inset + 4, y + rh - inset - 7, w - inset * 2 - 8, 3);
        };
        draw(0);
        if (x + w > S) draw(-S);
        x += w;
      }
    }
    blotches(ctx, rand, S, 10, 30);
  });
}

/** Terra/areia/neve: salpicos, pedrinhas com contorno e algumas rachaduras. */
export function groundTexture(): THREE.CanvasTexture {
  const S = 512;
  return canvasTexture(S, (ctx, rand) => {
    blotches(ctx, rand, S, 30, 50);
    for (let i = 0; i < 500; i++) {
      const x = rand() * S, y = rand() * S, r = 0.8 + rand() * 1.6;
      ctx.fillStyle = grey(rand() < 0.6 ? 85 : 170, 0.6);
      tiled(S, (dx, dy) => ctx.fillRect(x + dx, y + dy, r, r));
    }
    for (let i = 0; i < 28; i++) {
      const x = rand() * S, y = rand() * S, rx = 3 + rand() * 6, ry = rx * (0.5 + rand() * 0.3);
      tiled(S, (dx, dy) => {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = grey(160);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = grey(45);
        ctx.stroke();
      });
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      let x = rand() * S, y = rand() * S;
      ctx.strokeStyle = grey(60, 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rand() - 0.5) * 40;
        y += (rand() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

let textures: { grass: THREE.Texture; cobble: THREE.Texture; ground: THREE.Texture } | null = null;

/**
 * Material do chão pintado: a cor de cada célula (atributo `color`) multiplicada pela textura certa,
 * escolhida pelos pesos do atributo `paint` (grama, paralelepípedo, terra). As texturas são
 * projetadas de cima (coordenadas X/Z do mundo), então não precisam de UV.
 */
export function paintedGroundMaterial(): THREE.MeshStandardMaterial {
  textures ??= { grass: grassTexture(), cobble: cobbleTexture(), ground: groundTexture() };
  const t = textures;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.tGrass = { value: t.grass };
    shader.uniforms.tCobble = { value: t.cobble };
    shader.uniforms.tGround = { value: t.ground };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 paint;\nvarying vec3 vPaint;\nvarying vec2 vWorldXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaint = paint;\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tGrass;\nuniform sampler2D tCobble;\nuniform sampler2D tGround;\nvarying vec3 vPaint;\nvarying vec2 vWorldXZ;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 w = vPaint / max(vPaint.x + vPaint.y + vPaint.z, 1e-3);
        float g = texture2D(tGrass, vWorldXZ / 6.0).r;
        float c = texture2D(tCobble, vWorldXZ / 4.0).r;
        float d = texture2D(tGround, vWorldXZ / 5.0).r;
        // Paralelepípedo puxa a cor para um cinza de pedra (a praça não fica bege).
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.5, 0.47), w.y * 0.6);
        diffuseColor.rgb *= 2.0 * (g * w.x + c * w.y + d * w.z);`,
      );
  };
  m.customProgramCacheKey = () => "painted-ground";
  return m;
}
