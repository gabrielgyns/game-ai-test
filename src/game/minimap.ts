import { BIOME_LABEL, biomeAt } from "../domain/biomes";
import type { Entity } from "../domain/components";
import { DUNGEON_ORIGIN, DUNGEON_THEMES, type DungeonRun } from "../domain/dungeon";
import { Tile, tileOf } from "../domain/dungeonLayout";
import { mapMarkers, type MapMarker } from "../domain/mapMarkers";
import { DUNGEON_REGION_X, FOREST_RUINS, isIce, isLava, isWater, PEAKS_VILLAGE, terrainHeight, WORLD_HALF } from "../domain/terrain";
import type { World } from "../domain/world";
import { placeForestProps, placePeaksProps, placeProps, placeVolcanoProps } from "./environment";
import { zoneAt, type ZoneDefinition } from "../domain/zones";

/** Uma imagem de fundo do mapa e o retângulo do mundo que ela cobre. */
interface MapBase {
  canvas: HTMLCanvasElement;
  x0: number;
  z0: number;
  size: number;
}

/** Metros visíveis do centro à borda do minimapa. */
const MINI_RANGE = 48;
/** Marcadores que, fora do alcance, ficam presos na borda apontando a direção. */
const PINNED = new Set<MapMarker["kind"]>(["boss", "questOffer", "questTurnIn", "portal", "chest", "exit", "stairs", "gate"]);

const LEGEND: { kind: MapMarker["kind"]; label: string }[] = [
  { kind: "questOffer", label: "Quest nova" },
  { kind: "questTurnIn", label: "Quest para entregar" },
  { kind: "npc", label: "Personagem" },
  { kind: "enemy", label: "Inimigo" },
  { kind: "boss", label: "Chefe" },
  { kind: "portal", label: "Portal de dungeon" },
  { kind: "gate", label: "Passagem para outra região" },
  { kind: "exit", label: "Saída" },
  { kind: "chest", label: "Baú da cripta" },
  { kind: "stairs", label: "Escada" },
  { kind: "shrine", label: "Santuário" },
  { kind: "stash", label: "Baú da vila" },
  { kind: "waystone", label: "Pedra de Teleporte" },
  { kind: "loot", label: "Item raro ou épico" },
];

/**
 * Fundo do vale, desenhado uma vez: cor por bioma e altura, sombreado de relevo (luz vindo do
 * noroeste), água, a praça do santuário e as árvores como pontinhos escuros.
 */
function overworldBase(zone: ZoneDefinition): MapBase {
  const ppm = 2; // pixels por metro
  const size = WORLD_HALF * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * ppm;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const COLORS = {
    meadow: rgb("#5f9a46"), swamp: rgb("#4a5e3a"), desert: rgb("#d4b47a"), forest: rgb("#2f5a2c"), ruins: rgb("#3a6232"),
    water: rgb("#3c6b86"), rock: rgb("#8a8a84"), snow: rgb("#e8ecf0"), plaza: rgb("#cdb88a"),
    ice: rgb("#9fd4ec"), slate: rgb("#6a7280"), packed: rgb("#b8b0a4"),
    volcano: rgb("#3e3a3c"), lava: rgb("#ff7a1a"), ash: rgb("#5e5856"),
  };
  const ox = zone.center.x, oz = zone.center.z;
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      const x = ox - WORLD_HALF + (px + 0.5) / ppm, z = oz - WORLD_HALF + (py + 0.5) / ppm;
      const h = terrainHeight(x, z);
      let c = isWater(x, z) ? COLORS.water : h > 10 ? COLORS.snow : h > 7 ? COLORS.rock : COLORS[biomeAt(x, z)];
      if (zone.id === "vulcao") c = isLava(x, z) ? COLORS.lava : Math.hypot(x - ox, z - oz - 76) < 9 ? COLORS.plaza : h > 6 ? COLORS.ash : COLORS.volcano;
      if (zone.id === "picos") {
        const steep = Math.max(Math.abs(h - terrainHeight(x + 1, z)), Math.abs(h - terrainHeight(x, z + 1)));
        c = isIce(x, z) ? COLORS.ice : steep >= 1.5 ? COLORS.slate : Math.hypot(x - ox - PEAKS_VILLAGE.x, z - oz - PEAKS_VILLAGE.z) < 9 ? COLORS.packed : COLORS.snow;
      }
      if (zone.id === "vale" && Math.hypot(x, z) < 10) c = COLORS.plaza;
      if (zone.id === "floresta" && Math.hypot(x - ox - FOREST_RUINS.x, z - oz - FOREST_RUINS.z) < 14) c = COLORS.rock; // pátio das ruínas
      // Relevo: degrau virado para o noroeste clareia, para o sudeste escurece.
      const slope = h - terrainHeight(x - 1, z - 1);
      const k = 1 + Math.max(-0.25, Math.min(0.25, slope * 0.12)) + h * 0.012;
      const i = (py * canvas.width + px) * 4;
      img.data[i] = Math.min(255, c[0] * k);
      img.data[i + 1] = Math.min(255, c[1] * k);
      img.data[i + 2] = Math.min(255, c[2] * k);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  // Árvores e pedras grandes: pontos escuros (dão textura e ajudam a se orientar).
  for (const p of zone.id === "floresta" ? placeForestProps() : zone.id === "picos" ? placePeaksProps() : zone.id === "vulcao" ? placeVolcanoProps() : placeProps()) {
    const big = /oak|Oak|birch|pine|deadTree|mushrooms|Mushrooms|cactus|boulder|rocks|sandstone|slab|giantTree|elven|Column|frozenTree|snowRock|cabin|iceSpire|basalt|obsidian|charred|stoneHut/.test(p.kind);
    if (!big) continue;
    ctx.fillStyle = /cabin|stoneHut/.test(p.kind) ? "rgba(90, 64, 40, 0.9)" : /iceSpire/.test(p.kind) ? "rgba(90, 160, 210, 0.8)" : /pine/.test(p.kind) ? "rgba(20, 50, 30, 0.55)" : /boulder|rocks|sandstone|slab|snowRock/.test(p.kind) ? "rgba(70, 66, 60, 0.5)" : "rgba(25, 55, 25, 0.45)";
    ctx.beginPath();
    ctx.arc((p.x - ox + WORLD_HALF) * ppm, (p.z - oz + WORLD_HALF) * ppm, /giantTree/.test(p.kind) ? 4 : /pine|oak|Oak|birch|deadTree/.test(p.kind) ? 2.6 : 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, x0: ox - WORLD_HALF, z0: oz - WORLD_HALF, size };
}

/** Fundo da cripta, a partir da planta do domínio: chão claro, pilares escuros, salas limpas em verde. */
function dungeonBase(run: DungeonRun): MapBase {
  const ppc = 4; // pixels por célula (1 m)
  const { layout } = run;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = layout.width * ppc;
  const ctx = canvas.getContext("2d")!;
  for (let j = 0; j < layout.height; j++)
    for (let i = 0; i < layout.width; i++) {
      const t = tileOf(layout, i, j);
      if (t === Tile.Void) continue;
      ctx.fillStyle = t === Tile.Pillar ? "#3a3640" : t === Tile.Trap ? "#8a4a42" : "#8d8676";
      ctx.fillRect(i * ppc, j * ppc, ppc, ppc);
    }
  for (const room of layout.rooms) {
    const cleared = run.clearedRooms.includes(room.id) || (room.kind === "boss" && run.bossDefeated);
    if (!cleared && room.kind !== "start") continue;
    ctx.fillStyle = "rgba(120, 200, 120, 0.18)";
    ctx.fillRect(room.i0 * ppc, room.j0 * ppc, (room.i1 - room.i0) * ppc, (room.j1 - room.j0) * ppc);
  }
  return { canvas, x0: DUNGEON_ORIGIN.x, z0: DUNGEON_ORIGIN.z, size: layout.width };
}

/** Desenha um marcador centrado em (x, y) da tela. `r` é o tamanho base em pixels. */
function drawMarker(ctx: CanvasRenderingContext2D, kind: MapMarker["kind"], x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1, r * 0.35);
  ctx.strokeStyle = "rgba(10, 10, 14, 0.9)";
  const dot = (color: string, size: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  const glyph = (text: string, color: string) => {
    ctx.font = `bold ${r * 3}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = r * 0.8;
    ctx.strokeText(text, 0, r * 0.1);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, r * 0.1);
  };
  switch (kind) {
    case "enemy": dot("#e5484d", r * 0.8); break;
    case "npc": dot("#8fd0ff", r * 0.85); break;
    case "questOffer": glyph("!", "#ffd54a"); break;
    case "questTurnIn": glyph("?", "#9ce39c"); break;
    case "boss":
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#b02a3a";
      ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
      ctx.strokeRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "#ffe0e0";
      ctx.fillRect(-r * 0.25, -r * 0.8, r * 0.5, r * 1.6);
      break;
    case "gate":
      ctx.fillStyle = "#7ad86a";
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, r * 1.1);
      ctx.lineTo(-r * 1.1, -r * 0.2);
      ctx.arc(0, -r * 0.2, r * 1.1, Math.PI, 0);
      ctx.lineTo(r * 1.1, r * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "portal":
    case "exit":
      ctx.lineWidth = r * 0.7;
      ctx.strokeStyle = kind === "portal" ? "#c08aff" : "#7dff9a";
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "stairs":
      ctx.fillStyle = "#9a6aff";
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(-r + k * r * 0.66, -r + k * r * 0.66, r * 2 - k * r * 0.66, r * 0.6);
        ctx.strokeRect(-r + k * r * 0.66, -r + k * r * 0.66, r * 2 - k * r * 0.66, r * 0.6);
      }
      break;
    case "shrine":
      dot("#5ab0ff", r * 1.0);
      break;
    case "waystone":
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#5ad0ff";
      ctx.fillRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8);
      ctx.strokeRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8);
      break;
    case "stash":
    case "chest":
      ctx.fillStyle = kind === "stash" ? "#a8743a" : "#e0b040";
      ctx.fillRect(-r, -r * 0.75, r * 2, r * 1.5);
      ctx.strokeRect(-r, -r * 0.75, r * 2, r * 1.5);
      break;
    case "loot":
      ctx.fillStyle = "#b06cf0";
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, rr = k % 2 ? r * 0.45 : r * 1.1;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Seta do herói: aponta para onde ele olha. */
function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.5);
  ctx.lineTo(r, r);
  ctx.lineTo(0, r * 0.45);
  ctx.lineTo(-r, r);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#101014";
  ctx.lineWidth = r * 0.4;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Minimapa redondo no canto (gira com a câmera: para cima é para onde você olha) e mapa grande na
 * tecla M (norte para cima, o vale inteiro ou a cripta inteira). O fundo é desenhado uma vez; por
 * cima, a cada quadro, os marcadores que o domínio manda (`mapMarkers`).
 */
export class Minimap {
  private readonly mini: HTMLCanvasElement;
  private readonly region: HTMLElement;
  private readonly full: HTMLElement;
  private readonly fullCanvas: HTMLCanvasElement;
  private readonly zoneBases = new Map<string, MapBase>();
  private dungeon: { base: MapBase; key: string } | null = null;

  constructor() {
    this.mini = document.getElementById("minimap-canvas") as HTMLCanvasElement;
    this.region = document.getElementById("minimap-region")!;
    this.full = document.getElementById("worldmap")!;
    this.fullCanvas = document.getElementById("worldmap-canvas") as HTMLCanvasElement;
    const legend = document.getElementById("worldmap-legend")!;
    for (const item of LEGEND) {
      const row = document.createElement("div");
      const icon = document.createElement("canvas");
      icon.width = icon.height = 22;
      drawMarker(icon.getContext("2d")!, item.kind, 11, 11, 4.5);
      row.append(icon, item.label);
      legend.appendChild(row);
    }
    document.getElementById("worldmap-close")!.addEventListener("click", () => this.toggleFull(false));
  }

  get fullOpen(): boolean {
    return !this.full.classList.contains("hidden");
  }

  toggleFull(open = !this.fullOpen): void {
    this.full.classList.toggle("hidden", !open);
  }

  private baseFor(world: World, player: Entity): MapBase {
    const run = world.dungeon;
    if (run && player.transform.position.x >= DUNGEON_REGION_X) {
      // Redesenha quando muda a cripta ou quando uma sala é limpa.
      const key = `${run.seed}|${run.floor}|${run.clearedRooms.length}|${run.bossDefeated}`;
      if (this.dungeon?.key !== key) this.dungeon = { base: dungeonBase(run), key };
      return this.dungeon.base;
    }
    const zone = zoneAt(player.transform.position.x, player.transform.position.z);
    let base = this.zoneBases.get(zone.id);
    if (!base) this.zoneBases.set(zone.id, (base = overworldBase(zone)));
    return base;
  }

  update(world: World, player: Entity, cameraYaw: number): void {
    const base = this.baseFor(world, player);
    const markers = mapMarkers(world, player);
    const inside = player.transform.position.x >= DUNGEON_REGION_X;
    const regionName = inside ? (world.dungeon ? DUNGEON_THEMES[world.dungeon.theme].name : "") : BIOME_LABEL[biomeAt(player.transform.position.x, player.transform.position.z)];
    if (this.region.textContent !== regionName) this.region.textContent = regionName;
    this.drawMini(base, markers, player, cameraYaw, inside);
    if (this.fullOpen) this.drawFull(base, markers, player);
  }

  private drawMini(base: MapBase, markers: MapMarker[], player: Entity, yaw: number, inside: boolean): void {
    const canvas = this.mini;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = canvas.clientWidth || 190;
    if (canvas.width !== Math.round(css * dpr)) canvas.width = canvas.height = Math.round(css * dpr);
    const ctx = canvas.getContext("2d")!;
    const R = canvas.width / 2;
    const range = inside ? MINI_RANGE * 0.6 : MINI_RANGE;
    const s = R / range; // pixels por metro
    const { x: px, z: pz } = player.transform.position;
    // Mundo → tela: centrado no herói e girado pela câmera (para cima = para onde a câmera olha).
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const toScreen = (x: number, z: number) => {
      const dx = x - px, dz = z - pz;
      return { x: R + (dx * cos - dz * sin) * s, y: R + (dx * sin + dz * cos) * s };
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = inside ? "#16141a" : "#2a3a2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(yaw);
    ctx.scale(s, s);
    ctx.translate(-px, -pz);
    ctx.imageSmoothingEnabled = !inside;
    ctx.drawImage(base.canvas, base.x0, base.z0, base.size, base.size);
    ctx.restore();

    const r = R * 0.06;
    for (const m of markers) {
      let p = toScreen(m.x, m.z);
      const d = Math.hypot(p.x - R, p.y - R);
      const edge = R - r * 2.2;
      if (d > edge) {
        if (!PINNED.has(m.kind)) continue;
        p = { x: R + ((p.x - R) / d) * edge, y: R + ((p.y - R) / d) * edge };
      }
      drawMarker(ctx, m.kind, p.x, p.y, m.kind === "enemy" ? r * 0.9 : r);
    }
    // Herói: seta no centro, girada pela diferença entre para onde ele olha e a câmera.
    drawPlayer(ctx, R, R, yaw - player.transform.yaw, r * 1.2);
    ctx.restore();

    // Aro e o "N" que mostra onde fica o norte (-Z).
    ctx.lineWidth = Math.max(2, R * 0.03);
    ctx.strokeStyle = "rgba(230, 220, 190, 0.75)";
    ctx.beginPath();
    ctx.arc(R, R, R - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    const north = { x: R + Math.sin(yaw) * (R - r * 2.2), y: R - Math.cos(yaw) * (R - r * 2.2) };
    ctx.font = `bold ${R * 0.16}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = "#101014";
    ctx.strokeText("N", north.x, north.y);
    ctx.fillStyle = "#ffd36e";
    ctx.fillText("N", north.x, north.y);
  }

  private drawFull(base: MapBase, markers: MapMarker[], player: Entity): void {
    const canvas = this.fullCanvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = canvas.clientWidth || 600;
    if (canvas.width !== Math.round(css * dpr)) canvas.width = canvas.height = Math.round(css * dpr);
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const s = W / base.size;
    const toScreen = (x: number, z: number) => ({ x: (x - base.x0) * s, y: (z - base.z0) * s });
    ctx.fillStyle = "#141218"; // a cripta não cobre o quadro inteiro
    ctx.fillRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = base.x0 < DUNGEON_REGION_X;
    ctx.drawImage(base.canvas, 0, 0, W, W);
    const r = W * 0.008;
    for (const m of markers) {
      const p = toScreen(m.x, m.z);
      drawMarker(ctx, m.kind, p.x, p.y, m.kind === "enemy" ? r * 0.8 : r * 1.3);
    }
    // Nomes dos chefes e do portal, para o mapa servir de guia.
    ctx.font = `600 ${Math.round(W * 0.019)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = W * 0.005;
    ctx.strokeStyle = "rgba(10,10,14,0.85)";
    ctx.fillStyle = "#f4ecd8";
    for (const m of markers) {
      if (m.kind !== "boss" && m.kind !== "portal" && m.kind !== "chest") continue;
      const p = toScreen(m.x, m.z);
      ctx.strokeText(m.label ?? "", p.x, p.y - r * 3.2);
      ctx.fillText(m.label ?? "", p.x, p.y - r * 3.2);
    }
    const p = toScreen(player.transform.position.x, player.transform.position.z);
    drawPlayer(ctx, p.x, p.y, -player.transform.yaw, r * 1.8);
  }
}
