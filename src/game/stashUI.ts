import type { Entity } from "../domain/components";
import type { Item } from "../domain/items";
import { deposit, STASH_TAB_NAMES, STASH_TAB_SIZE, stashCount, withdraw, type Stash } from "../domain/stash";
import { iconCanvas } from "./itemIcons";
import { displayRarity, itemTooltipHTML } from "./itemTooltip";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/**
 * Painel do baú do santuário: à esquerda a aba escolhida do baú, à direita a mochila. Um clique leva o
 * item para o outro lado. As regras ficam em `domain/stash.ts`; `onChange` avisa para salvar.
 */
export class StashUI {
  private readonly root = el("stash");
  private readonly tabsEl = el("stash-tabs");
  private readonly stashGrid = el("stash-grid");
  private readonly bagGrid = el("stash-bag");
  private readonly tooltip = el("stash-tooltip");
  private readonly stashCells: HTMLDivElement[] = [];
  private readonly bagCells: HTMLDivElement[] = [];
  private tab = 0;
  onChange: () => void = () => {};
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(private readonly stash: Stash, private readonly player: Entity) {
    for (let i = 0; i < STASH_TAB_SIZE; i++) {
      const cell = this.makeCell(() => this.take(i), () => this.stash.tabs[this.tab]?.[i] ?? null, "Clique para levar à mochila");
      this.stashGrid.appendChild(cell);
      this.stashCells.push(cell);
    }
    for (let i = 0; i < player.inventory!.capacity; i++) {
      const cell = this.makeCell(() => this.store(i), () => this.player.inventory!.items[i] ?? null, "Clique para guardar no baú");
      this.bagGrid.appendChild(cell);
      this.bagCells.push(cell);
    }
    el("stash-close").addEventListener("click", () => this.onClose());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(): void {
    this.render();
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
    this.tooltip.classList.add("hidden");
  }

  private makeCell(click: () => void, item: () => Item | null, hint: string): HTMLDivElement {
    const cell = document.createElement("div");
    cell.className = "cell empty";
    cell.addEventListener("click", click);
    cell.addEventListener("mouseenter", () => this.tip(item(), hint));
    cell.addEventListener("mousemove", (e) => this.moveTip(e));
    cell.addEventListener("mouseleave", () => this.tooltip.classList.add("hidden"));
    return cell;
  }

  private store(index: number): void {
    if (!this.player.inventory!.items[index]) return;
    if (!deposit(this.stash, this.player.inventory!, index, this.tab)) this.onMessage(`${STASH_TAB_NAMES[this.tab]} está cheio.`);
    this.after(this.player.inventory!.items[index] ?? null, "Clique para guardar no baú");
  }

  private take(index: number): void {
    if (!this.stash.tabs[this.tab]?.[index]) return;
    if (!withdraw(this.stash, this.player.inventory!, this.tab, index)) this.onMessage("Mochila cheia.");
    this.after(this.stash.tabs[this.tab]?.[index] ?? null, "Clique para levar à mochila");
  }

  private after(left: Item | null, hint: string): void {
    this.onChange();
    this.render();
    if (left) this.tip(left, hint);
    else this.tooltip.classList.add("hidden");
  }

  render(): void {
    this.tabsEl.replaceChildren(
      ...STASH_TAB_NAMES.map((name, t) => {
        const b = document.createElement("button");
        b.type = "button";
        const used = this.stash.tabs[t]!.filter(Boolean).length;
        b.textContent = `${name} · ${used}/${STASH_TAB_SIZE}`;
        b.classList.toggle("active", t === this.tab);
        b.addEventListener("click", () => {
          this.tab = t;
          this.render();
        });
        return b;
      }),
    );
    el("stash-count").textContent = `${stashCount(this.stash)} itens guardados · compartilhado entre todos os heróis`;
    this.stash.tabs[this.tab]!.forEach((item, i) => renderCell(this.stashCells[i]!, item));
    this.player.inventory!.items.forEach((item, i) => renderCell(this.bagCells[i]!, item));
  }

  private tip(item: Item | null, hint: string): void {
    if (!item) return;
    const compare = item.slot ? this.player.equipment?.[item.slot] ?? null : null;
    this.tooltip.innerHTML = itemTooltipHTML(item, { compare, hint, equipment: this.player.equipment, classId: this.player.classId });
    this.tooltip.dataset.rarity = displayRarity(item);
    this.tooltip.classList.remove("hidden");
  }

  private moveTip(e: MouseEvent): void {
    const pad = 14;
    this.tooltip.style.left = `${Math.min(e.clientX + pad, window.innerWidth - this.tooltip.offsetWidth - pad)}px`;
    this.tooltip.style.top = `${Math.min(e.clientY + pad, window.innerHeight - this.tooltip.offsetHeight - pad)}px`;
  }
}

function renderCell(cell: HTMLDivElement, item: Item | null): void {
  cell.innerHTML = "";
  if (!item) {
    cell.className = "cell empty";
    delete cell.dataset.rarity;
    return;
  }
  cell.className = "cell";
  cell.dataset.rarity = displayRarity(item);
  const icon = iconCanvas(item.icon).cloneNode(true) as HTMLCanvasElement;
  icon.getContext("2d")!.drawImage(iconCanvas(item.icon), 0, 0);
  icon.className = "icon";
  cell.appendChild(icon);
  if (item.quantity > 1) {
    const qty = document.createElement("span");
    qty.className = "qty";
    qty.textContent = `×${item.quantity}`;
    cell.appendChild(qty);
  }
}
