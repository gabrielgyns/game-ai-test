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
  b: "#5b8def", // azul
  p: "#b06cf0", // roxo
  G: "#5fd36b",
  d: "#b8322f", // vermelho escuro (poção grande)
  D: "#ff6b6b",
  S: "#aab0bc",
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
  bow: [
    ".....w......",
    "....w.s.....",
    "...w...s....",
    "...w....s...",
    "..w.....s...",
    "..w......s..",
    "..w......s..",
    "..w.....s...",
    "...w....s...",
    "...w...s....",
    "....w.s.....",
    ".....w......",
  ],
  staff: [
    ".....pp.....",
    "....pGGp....",
    "....pGGp....",
    ".....pp.....",
    "....w.w.....",
    ".....w......",
    ".....w......",
    ".....w......",
    ".....w......",
    ".....w......",
    ".....w......",
    "............",
  ],
  piercingShot: [
    "............",
    "G...........",
    "GG..........",
    "GGGGGGGGGGs.",
    "GGGGGGGGGGGs",
    "GGGGGGGGGGs.",
    "GG..........",
    "G...........",
    "....k...k...",
    "...kkk.kkk..",
    "....k...k...",
    "............",
  ],
  arrowRain: [
    "..s...s...s.",
    "..s...s...s.",
    "..s...s...s.",
    ".sss.sss.sss",
    "..s...s...s.",
    "............",
    "..s...s...s.",
    "..s...s...s.",
    ".sss.sss.sss",
    "..s...s...s.",
    "............",
    "............",
  ],
  disengage: [
    "............",
    "......gg....",
    ".....g..g...",
    "....g....g..",
    "...g......g.",
    "..gg......gg",
    ".g..........",
    "g...........",
    ".g..........",
    "..g.........",
    "............",
    "............",
  ],
  focus: [
    "............",
    "....gggg....",
    "..gg....gg..",
    ".g...gg...g.",
    ".g..gggg..g.",
    "g...grrg...g",
    "g...grrg...g",
    ".g..gggg..g.",
    ".g...gg...g.",
    "..gg....gg..",
    "....gggg....",
    "............",
  ],
  fireball: [
    "............",
    ".....rr.....",
    "....rRRr....",
    "...rRRRRr...",
    "..rRRggRRr..",
    "..rRgggg Rr.",
    "..rRgggg Rr.",
    "..rRRggRRr..",
    "...rRRRRr...",
    "....rRRr....",
    ".....rr.....",
    "............",
  ],
  frostNova: [
    ".....b......",
    "..b..b..b...",
    "...b.b.b....",
    "....bbb.....",
    "bbbbbSbbbbb.",
    "....bbb.....",
    "...b.b.b....",
    "..b..b..b...",
    ".....b......",
    "............",
    "............",
    "............",
  ],
  blink: [
    "............",
    "..p......p..",
    ".p.p....p.p.",
    "..p......p..",
    "....pppp....",
    "...p....p...",
    "...p.pp.p...",
    "...p....p...",
    "....pppp....",
    "..p......p..",
    ".p.p....p.p.",
    "..p......p..",
  ],
  arcaneShield: [
    "....bbbb....",
    "..bbppppbb..",
    ".bpppppppppb",
    ".bpppSSpppb.",
    ".bpppSSpppb.",
    ".bpppppppppb",
    "..bpppppppb.",
    "..bpppppppb.",
    "...bpppppb..",
    "....bpppb...",
    ".....bpb....",
    "......b.....",
  ],
  potionLarge: [
    ".....kk.....",
    ".....ss.....",
    "....ssss....",
    "...sDDDDs...",
    "..sDDddDDs..",
    ".sDdddddddS.",
    ".sddddddddS.",
    ".sddddddddS.",
    ".sDdddddddS.",
    "..sDddddDs..",
    "...ssssss...",
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
