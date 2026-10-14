import { addItem, type Inventory } from "./inventory";
import { newItemId, type Item } from "./items";

/**
 * Baú do santuário: um depósito com abas, compartilhado por todos os heróis (como o baú do Diablo).
 * Mora fora do save de cada herói, então passar uma peça de conjunto para outro personagem é guardar
 * num e tirar no outro. Aqui só as regras; quem guarda no navegador é a apresentação (`storage.ts`).
 */
export const STASH_TABS = 3;
export const STASH_TAB_SIZE = 30;
export const STASH_TAB_NAMES = ["Baú I", "Baú II", "Baú III"];

export interface Stash {
  tabs: (Item | null)[][];
}

export function createStash(): Stash {
  return { tabs: Array.from({ length: STASH_TABS }, () => Array.from({ length: STASH_TAB_SIZE }, () => null)) };
}

/** Guarda o item da mochila na aba (empilhando poções iguais). Falso se a aba estiver cheia. */
export function deposit(stash: Stash, inv: Inventory, index: number, tab: number): boolean {
  const item = inv.items[index];
  const slots = stash.tabs[tab];
  if (!item || !slots) return false;
  const holder: Inventory = { items: slots, capacity: slots.length };
  const quantity = item.quantity;
  if (!addItem(holder, item)) {
    item.quantity = quantity; // não coube: nada muda
    return false;
  }
  inv.items[index] = null;
  return true;
}

/** Tira o item da aba para a mochila. Falso se a mochila estiver cheia. */
export function withdraw(stash: Stash, inv: Inventory, tab: number, index: number): boolean {
  const slots = stash.tabs[tab];
  const item = slots?.[index];
  if (!slots || !item) return false;
  const quantity = item.quantity;
  if (!addItem(inv, item)) {
    item.quantity = quantity;
    return false;
  }
  slots[index] = null;
  return true;
}

/** Lê um baú salvo, tolerando formato velho ou estranho, e dá ids novos aos itens (não colidem com o save). */
export function restoreStash(data: unknown): Stash {
  const stash = createStash();
  const tabs = (data as { tabs?: unknown })?.tabs;
  if (!Array.isArray(tabs)) return stash;
  tabs.slice(0, STASH_TABS).forEach((tab, t) => {
    if (!Array.isArray(tab)) return;
    tab.slice(0, STASH_TAB_SIZE).forEach((item, i) => {
      if (item && typeof item === "object" && typeof (item as Item).name === "string") stash.tabs[t]![i] = { ...(item as Item), id: newItemId() };
    });
  });
  return stash;
}

export const stashCount = (stash: Stash): number => stash.tabs.reduce((n, tab) => n + tab.filter(Boolean).length, 0);
