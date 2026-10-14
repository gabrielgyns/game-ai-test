import type { Entity } from "../domain/components";
import { describeAffix } from "../domain/affixes";
import { clockAt, DAY_LENGTH } from "../domain/dayCycle";
import { describeStats, type Item } from "../domain/items";
import {
  buyBack, buyOffer, buyPotion, ensureShop, POTION_PRICES, sellAllCommon, sellFromInventory, sellPrice, type ShopResult,
} from "../domain/shop";
import { createPotion } from "../domain/items";
import type { World } from "../domain/world";
import { iconCanvas } from "./itemIcons";
import { itemTooltipHTML } from "./itemTooltip";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const FAIL_TEXT: Record<Exclude<ShopResult, "ok">, string> = {
  noGold: "Ouro insuficiente.",
  bagFull: "Mochila cheia.",
  unavailable: "Esse item já foi vendido.",
};

/**
 * Painel da Mercadora: à esquerda o que ela vende (poções, estoque do dia, recompra), à direita a
 * mochila do herói, onde um clique vende. Toda regra vive em `domain/shop.ts`; aqui só desenha e
 * repassa cliques.
 */
export class ShopUI {
  private readonly root = el("shop");
  private readonly offers = el("shop-offers");
  private readonly buyback = el("shop-buyback");
  private readonly grid = el("shop-grid");
  private readonly gold = el("shop-gold");
  private readonly tooltip = el("shop-tooltip");
  private readonly cells: HTMLDivElement[] = [];
  /** Poções de vitrine (só para desenhar a linha; a compra cria uma nova). */
  private readonly displayPotions = { small: createPotion("small"), large: createPotion("large") };
  /** Depois de comprar ou vender: processa os eventos na hora (o mundo está pausado). */
  onAction: () => void = () => {};
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {
    const inv = player.inventory!;
    for (let i = 0; i < inv.capacity; i++) {
      const cell = document.createElement("div");
      cell.className = "cell empty";
      cell.addEventListener("click", () => this.sell(i));
      cell.addEventListener("mouseenter", () => {
        const item = this.player.inventory!.items[i];
        if (item) this.showTip(item, `Vender por ${sellPrice(item)} ouro${item.quantity > 1 ? " (uma unidade)" : ""}`, "Clique para vender");
      });
      cell.addEventListener("mousemove", (e) => this.moveTip(e));
      cell.addEventListener("mouseleave", () => this.hideTip());
      this.grid.appendChild(cell);
      this.cells.push(cell);
    }
    el("shop-sell-common").addEventListener("click", () => {
      const total = sellAllCommon(this.world, this.player);
      if (total === 0) this.onMessage("Nenhum equipamento comum na mochila.");
      this.after();
    });
    el("shop-close").addEventListener("click", () => this.onClose());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(merchantName: string): void {
    el("shop-title").textContent = merchantName;
    this.render();
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
    this.hideTip();
  }

  private sell(index: number): void {
    const item = this.player.inventory!.items[index];
    if (!item) return;
    sellFromInventory(this.world, this.player, index);
    this.after();
    const left = this.player.inventory!.items[index];
    if (left) this.showTip(left, `Vender por ${sellPrice(left)} ouro`, "Clique para vender");
    else this.hideTip();
  }

  private result(r: ShopResult): void {
    if (r !== "ok") this.onMessage(FAIL_TEXT[r]);
    this.after();
  }

  private after(): void {
    this.onAction();
    this.render();
  }

  render(): void {
    const shop = ensureShop(this.world, this.player);
    const gold = this.player.wallet?.gold ?? 0;
    this.gold.textContent = `${gold} ouro`;
    const clock = clockAt(this.world.time);
    const hoursLeft = Math.ceil(24 - clock.hour);
    el("shop-day").textContent = `estoque do dia ${shop.day} · novidades em ~${hoursLeft}h (${Math.ceil((hoursLeft * DAY_LENGTH) / 24 / 60)} min)`;

    this.offers.replaceChildren(
      this.row(this.displayPotions.small, POTION_PRICES.small, gold, false, () => this.result(buyPotion(this.world, this.player, "small")), "Sempre em estoque"),
      this.row(this.displayPotions.large, POTION_PRICES.large, gold, false, () => this.result(buyPotion(this.world, this.player, "large")), "Sempre em estoque"),
      ...shop.offers.map((o, i) => this.row(o.item, o.price, gold, o.sold, () => this.result(buyOffer(this.world, this.player, i)))),
    );
    this.buyback.replaceChildren(...shop.buyback.map((b, i) => this.row(b.item, b.price, gold, false, () => this.result(buyBack(this.world, this.player, i)))));

    const inv = this.player.inventory!;
    inv.items.forEach((item, i) => this.renderCell(this.cells[i]!, item));
  }

  /** Linha de oferta: ícone, nome na cor da raridade, resumo dos atributos e o botão de compra. */
  private row(item: Item, price: number, gold: number, sold: boolean, buy: () => void, note?: string): HTMLElement {
    const row = document.createElement("div");
    row.className = `offer${sold ? " sold" : ""}`;
    row.dataset.rarity = item.rarity;
    const cell = document.createElement("div");
    this.renderCell(cell, item);
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "oname";
    name.textContent = item.name;
    const sub = document.createElement("div");
    sub.className = "osub";
    const stats = item.kind === "equipment" ? describeStats(item.stats) : `Cura ${Math.round((item.healFraction ?? 0) * 100)}% da vida`;
    const affixes = (item.affixes ?? []).map((a) => `<span class="aff">${describeAffix(a)}</span>`).join(" · ");
    sub.innerHTML = [stats, affixes, note].filter(Boolean).join(" · ");
    info.append(name, sub);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `buy${gold < price ? " poor" : ""}`;
    btn.textContent = sold ? "Vendido" : `${price} ouro`;
    btn.disabled = sold;
    btn.addEventListener("click", buy);
    row.append(cell, info, btn);
    row.addEventListener("mouseenter", () => {
      if (!sold) this.showTip(item, `Comprar por ${price} ouro`, gold < price ? "Ouro insuficiente" : "Clique em comprar");
    });
    row.addEventListener("mousemove", (e) => this.moveTip(e));
    row.addEventListener("mouseleave", () => this.hideTip());
    return row;
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

  private showTip(item: Item, price: string, hint: string): void {
    const compare = item.slot ? this.player.equipment?.[item.slot] ?? null : null;
    this.tooltip.innerHTML = itemTooltipHTML(item, { compare, price, hint });
    this.tooltip.dataset.rarity = item.rarity;
    this.tooltip.classList.remove("hidden");
  }

  private moveTip(e: MouseEvent): void {
    const pad = 14;
    const x = Math.min(e.clientX + pad, window.innerWidth - this.tooltip.offsetWidth - pad);
    const y = Math.min(e.clientY + pad, window.innerHeight - this.tooltip.offsetHeight - pad);
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
  }

  private hideTip(): void {
    this.tooltip.classList.add("hidden");
  }
}
