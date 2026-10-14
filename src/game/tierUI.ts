import type { Entity } from "../domain/components";
import { BOSS_TITLES } from "./bossTitles";
import { newWorldTierState, setWorldTier, TIER_BOSSES, WORLD_TIERS, type TierChange } from "../domain/worldTier";
import type { World } from "../domain/world";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const FAIL: Record<Exclude<TierChange, "ok" | "same">, string> = {
  locked: "Esse nível ainda está selado.",
  inDungeon: "Não dá para mudar o mundo de dentro da cripta.",
};

/**
 * Altar das Eras: escolha da dificuldade do mundo. Cada nível mostra o bônus, se está destravado e,
 * no maior destravado, quais chefes faltam vencer para abrir o próximo.
 */
export class TierUI {
  private readonly root = el("tiers");
  private readonly list = el("tiers-list");
  onChange: () => void = () => {};
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {
    el("tiers-close").addEventListener("click", () => this.onClose());
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
  }

  render(): void {
    const state = (this.player.worldTier ??= newWorldTierState());
    this.list.replaceChildren(
      ...WORLD_TIERS.map((t) => {
        const row = document.createElement("div");
        const locked = t.id > state.unlocked;
        const current = t.id === state.current;
        row.className = `tier${locked ? " locked" : ""}${current ? " current" : ""}`;
        const info = document.createElement("div");
        info.className = "info";
        info.innerHTML = `<div class="tname">${locked ? "🔒 " : ""}${t.name}${t.levelBonus ? ` <span class="bonus">+${t.levelBonus} níveis</span>` : ""}</div><div class="tdesc">${t.description}</div>`;
        if (t.id === state.unlocked && t.id < WORLD_TIERS.length) {
          const bosses = TIER_BOSSES.map((b) => `<span class="${state.defeated.includes(b) ? "done" : ""}">${state.defeated.includes(b) ? "✓" : "○"} ${BOSS_TITLES[b] ?? b}</span>`).join(" ");
          info.innerHTML += `<div class="tseal">Para abrir o próximo, vença aqui: ${bosses}</div>`;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = current ? "Atual" : locked ? "Selado" : "Escolher";
        btn.disabled = current || locked;
        btn.addEventListener("click", () => {
          const r = setWorldTier(this.world, this.player, t.id);
          if (r === "ok") this.onChange();
          else if (r !== "same") this.onMessage(FAIL[r]);
          this.render();
        });
        row.append(info, btn);
        return row;
      }),
    );
  }
}
