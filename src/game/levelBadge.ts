import * as THREE from "three";
import type { LevelDifficulty } from "../domain/levels";

/** Cor do nível pela dificuldade (cinza, verde, amarelo, laranja, vermelho). */
export const DIFFICULTY_COLOR: Record<LevelDifficulty, string> = {
  trivial: "#a0a0a0",
  easy: "#62d46e",
  even: "#f2e27a",
  hard: "#ffa040",
  deadly: "#ff5050",
};

const cache = new Map<string, THREE.CanvasTexture>();

/**
 * Textura do selo de nível que fica à esquerda da barra de vida flutuante: o número na cor da
 * dificuldade, sobre um fundo escuro. Uma textura por combinação, compartilhada por todos.
 */
export function levelBadgeTexture(level: number, difficulty: LevelDifficulty): THREE.CanvasTexture {
  const key = `${level}|${difficulty}`;
  let tex = cache.get(key);
  if (tex) return tex;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 40;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(16, 16, 20, 0.92)";
  ctx.beginPath();
  ctx.roundRect(1, 1, 62, 38, 8);
  ctx.fill();
  ctx.strokeStyle = DIFFICULTY_COLOR[difficulty];
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = DIFFICULTY_COLOR[difficulty];
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(level), 32, 22);
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
