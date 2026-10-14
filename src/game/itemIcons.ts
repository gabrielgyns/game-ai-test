/**
 * Ícones de itens em pixel art 12×12, desenhados por código.
 * Cada string é uma linha; letras mapeiam cores na paleta. "." é transparente.
 */
const PALETTE: Record<string, string> = {
  s: "#d8dde6", // aço
  g: "#c9a227", // dourado
  w: "#8a5a2b", // madeira
  l: "#6b4a2b", // couro
  L: "#8c6a45",
  a: "#7f8794", // metal escuro
  A: "#a8b0bc",
  r: "#e5484d", // vermelho (poção)
  R: "#ff8a8a",
  k: "#1b1b1b",
  b: "#3b5aa6", // azul
  p: "#b06cf0", // roxo
  G: "#5fd36b",
};

const ICONS: Record<string, string[]> = {
  sword: [
    "..........s.",
    ".........ss.",
    "........ss..",
    ".......ss...",
    "......ss....",
    ".....ss.....",
    "..g.ss......",
    "...gg.......",
    "..gggg......",
    ".w..gg......",
    "w....g......",
    "............",
  ],
  dagger: [
    "............",
    "............",
    "........s...",
    ".......ss...",
    "......ss....",
    ".....ss.....",
    "..g.ss......",
    "...gg.......",
    "..ww........",
    ".w..........",
    "............",
    "............",
  ],
  axe: [
    ".....AAA....",
    "....AAAAA...",
    "...AAAaAA...",
    "...AAAaAA...",
    "....AAwA....",
    "......w.....",
    "......w.....",
    "......w.....",
    "......w.....",
    "......w.....",
    "......w.....",
    "............",
  ],
  armor: [
    "...a....a...",
    "..aaa..aaa..",
    ".aaaaaaaaaa.",
    ".aAAaaaaAAa.",
    ".aAaaaaaaAa.",
    "..aaaaaaaa..",
    "..aaaaaaaa..",
    "..aaagaaaa..",
    "..aaaaaaaa..",
    "...aaaaaa...",
    "...aaaaaa...",
    "............",
  ],
  ring: [
    "............",
    ".....pp.....",
    "....pppp....",
    ".....pp.....",
    "....gggg....",
    "...gg..gg...",
    "..gg....gg..",
    "..gg....gg..",
    "...gg..gg...",
    "....gggg....",
    "............",
    "............",
  ],
  boots: [
    "............",
    "...ll.......",
    "...ll.......",
    "...ll.......",
    "...ll.......",
    "...lll......",
    "...llll.....",
    "...lllll....",
    "..LLLLLL....",
    "..LLLLLLL...",
    "............",
    "............",
  ],
  amulet: [
    ".....gg.....",
    "....g..g....",
    "...g....g...",
    "...g....g...",
    "...g....g...",
    "....g..g....",
    ".....gg.....",
    "....bbbb....",
    "...bbbbbb...",
    "...bbGbbb...",
    "....bbbb....",
    ".....bb.....",
  ],
  whirlwind: [
    "............",
    "....ssss....",
    "..ss....ss..",
    ".s........s.",
    ".s..gg....s.",
    "....gg...ss.",
    "........ss..",
    "...ss..ss...",
    "..s..ss.....",
    ".s..........",
    "..ss........",
    "............",
  ],
  charge: [
    "............",
    "......g.....",
    ".......g....",
    "........g...",
    "ggggggggggg.",
    "........g...",
    ".......g....",
    "......g.....",
    "............",
    "..r.r.r.....",
    ".r.r.r......",
    "............",
  ],
  warcry: [
    "............",
    "...rrrrrr...",
    "..rRRRRRRr..",
    "..rRkRRkRr..",
    "..rRRRRRRr..",
    "..rRRkkRRr..",
    "..rRRkkRRr..",
    "...rrRRrr...",
    ".g..rrrr..g.",
    "g....gg....g",
    ".g...gg...g.",
    "............",
  ],
  secondWind: [
    "............",
    "..GG....GG..",
    ".GGGG..GGGG.",
    ".GGGGGGGGGG.",
    ".GGGGGGGGGG.",
    "..GGGGGGGG..",
    "...GGGGGG...",
    "....GGGG....",
    ".....GG.....",
    "............",
    "....ssss....",
    "............",
  ],
  potion: [
    ".....kk.....",
    ".....ss.....",
    ".....ss.....",
    "....ssss....",
    "...sRRRRs...",
    "..sRRrrRRs..",
    "..srrrrrrs..",
    "..srrrrrrs..",
    "..srrrrrrs..",
    "...srrrrs...",
    "....ssss....",
    "............",
  ],
};

const cache = new Map<string, HTMLCanvasElement>();

/** Canvas 12×12 com o ícone; escale com CSS (image-rendering: pixelated). */
export function iconCanvas(icon: string): HTMLCanvasElement {
  const cached = cache.get(icon);
  if (cached) return cached;
  const rows = ICONS[icon] ?? ICONS.potion!;
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  cache.set(icon, canvas);
  return canvas;
}

/** Pixels do ícone como lista (x, y, cor) para construir um modelo voxel do drop. */
export function iconPixels(icon: string): { x: number; y: number; color: string }[] {
  const rows = ICONS[icon] ?? ICONS.potion!;
  const out: { x: number; y: number; color: string }[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (color) out.push({ x, y: rows.length - 1 - y, color });
    });
  });
  return out;
}
