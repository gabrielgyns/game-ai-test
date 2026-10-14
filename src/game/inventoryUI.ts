import type { Entity } from "../domain/components";
import { equipFromInventory, removeAt, unequip, useItem } from "../domain/inventory";
import { describeStats, RARITY_LABEL, SLOT_LABEL, type EquipSlot, type Item } from "../domain/items";
import type { World } from "../domain/world";
import { iconCanvas } from "./itemIcons";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/** Painel da mochila: equipamento, grade de itens e tooltip com comparação. */
export class InventoryUI {
  private readonly root = el("inventory");
  private readonly grid = el("inv-grid");
  private readonly tooltip = el("tooltip");
  private readonly cells: HTMLDivElement[] = [];
  private readonly equipCells = new Map<EquipSlot, HTMLDivElement>();
  /** Chamado quando o jogador larga um item no chão. */
  onDiscard: (item: Item) => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {
    const inv = player.inventory!;
    for (let i = 0; i < inv.capacity; i++) {
      const cell = document.createElement("div");
      cell.className = "cell empty";
      cell.addEventListener("click", () => this.onCellClick(i));
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.discard(i);
      });
      cell.addEventListener("mouseenter", () => this.showTooltip(inv.items[i] ?? null, false));
      cell.addEventListener("mousemove", (e) => this.moveTooltip(e));
      cell.addEventListener("mouseleave", () => this.hideTooltip());
      this.grid.appendChild(cell);
      this.cells.push(cell);
    }
    for (const slotEl of this.root.querySelectorAll<HTMLDivElement>(".equip-slot")) {
      const slot = slotEl.dataset.slot as EquipSlot;
      const cell = slotEl.querySelector<HTMLDivElement>(".cell")!;
      cell.addEventListener("click", () => {
        if (unequip(this.world, this.player, slot)) this.refresh();
      });
      cell.addEventListener("mouseenter", () => this.showTooltip(this.player.equipment?.[slot] ?? null, true));
      cell.addEventListener("mousemove", (e) => this.moveTooltip(e));
      cell.addEventListener("mouseleave", () => this.hideTooltip());
      this.equipCells.set(slot, cell);
    }
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(): void {
    this.refresh();
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
    this.hideTooltip();
  }

  private onCellClick(index: number): void {
    const item = this.player.inventory!.items[index];
    if (!item) return;
    const ok = item.kind === "equipment" ? equipFromInventory(this.world, this.player, index) : useItem(this.world, this.player, index);
    if (ok) {
      this.refresh();
      this.showTooltip(this.player.inventory!.items[index] ?? null, false);
    }
  }

  private discard(index: number): void {
    const item = removeAt(this.player.inventory!, index);
    if (!item) return;
    this.onDiscard(item);
    this.refresh();
    this.hideTooltip();
  }

  refresh(): void {
    const inv = this.player.inventory!;
    inv.items.forEach((item, i) => this.renderCell(this.cells[i]!, item));
    for (const [slot, cell] of this.equipCells) this.renderCell(cell, this.player.equipment?.[slot] ?? null);
    el("inv-damage").textContent = `${this.player.combat.damage}`;
    el("inv-health").textContent = `${this.player.health.max}`;
    el("inv-speed").textContent = `${Math.round(this.player.movement.speedMultiplier * 100)}%`;
  }

  private renderCell(cell: HTMLDivElement, item: Item | null): void {
    cell.innerHTML = "";
    if (!item) {
      cell.className = "cell empty";
      delete cell.dataset.rarity;
      return;
    }
    cell.className = "cell";
    cell.dataset.rarity = item.rarity;
    const icon = iconCanvas(item.icon).cloneNode(true) as HTMLCanvasElement;
    const ctx = icon.getContext("2d")!;
    ctx.drawImage(iconCanvas(item.icon), 0, 0);
    icon.className = "icon";
    cell.appendChild(icon);
  }

  private showTooltip(item: Item | null, equipped: boolean): void {
    if (!item) return this.hideTooltip();
    const lines = [`<div class="name">${item.name}</div>`];
    const kind = item.kind === "equipment" && item.slot ? SLOT_LABEL[item.slot] : "Consumível";
    lines.push(`<div class="rarity">${RARITY_LABEL[item.rarity]} · ${kind}</div>`);
    if (item.kind === "equipment") {
      lines.push(`<div class="stat">${describeStats(item.stats)}</div>`);
      const current = item.slot ? this.player.equipment?.[item.slot] : null;
      if (!equipped && current && current !== item) {
        const diff = (a?: number, b?: number) => (a ?? 0) - (b ?? 0);
        const parts = [
          ["dano", diff(item.stats.damage, current.stats.damage)],
          ["vida", diff(item.stats.maxHealth, current.stats.maxHealth)],
          ["velocidade %", diff(item.stats.speedPercent, current.stats.speedPercent)],
        ].filter(([, d]) => d !== 0) as [string, number][];
        if (parts.length) {
          lines.push(
            `<div class="cmp">vs. ${current.name}: ` +
              parts.map(([n, d]) => `<span class="${d > 0 ? "better" : "worse"}">${d > 0 ? "+" : ""}${d} ${n}</span>`).join(", ") +
              "</div>",
          );
        }
      }
      lines.push(`<div class="cmp">${equipped ? "Clique para guardar na mochila" : "Clique para equipar"}</div>`);
    } else if (item.healFraction) {
      lines.push(`<div class="stat">Cura ${Math.round(item.healFraction * 100)}% da vida máxima</div>`);
      lines.push(`<div class="cmp">Clique para beber (ou Q no jogo)</div>`);
    }
    this.tooltip.innerHTML = lines.join("");
    this.tooltip.dataset.rarity = item.rarity;
    this.tooltip.classList.remove("hidden");
  }

  private moveTooltip(e: MouseEvent): void {
    const pad = 14;
    const x = Math.min(e.clientX + pad, window.innerWidth - this.tooltip.offsetWidth - pad);
    const y = Math.min(e.clientY + pad, window.innerHeight - this.tooltip.offsetHeight - pad);
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private hideTooltip(): void {
    this.tooltip.classList.add("hidden");
  }
}
