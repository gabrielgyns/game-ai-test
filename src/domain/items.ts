import { AFFIXES, rollAffixes, type Affix } from "./affixes";
import type { SetId } from "./sets";

export type EquipSlot = "weapon" | "armor" | "accessory";
export type Rarity = "common" | "uncommon" | "rare" | "epic";
export type ItemKind = "equipment" | "consumable";

/** Bônus que um item concede quando equipado. */
export interface ItemStats {
  damage?: number;
  maxHealth?: number;
  /** Bônus de velocidade em porcentagem (8 = +8%). */
  speedPercent?: number;
}

export interface Item {
  id: number;
  name: string;
  kind: ItemKind;
  slot?: EquipSlot;
  rarity: Rarity;
  stats: ItemStats;
  /** Para consumíveis: fração da vida máxima curada (0.4 = 40%). */
  healFraction?: number;
  /** Quantidade na pilha (1 para equipamentos). */
  quantity: number;
  /** Tamanho máximo da pilha; itens com o mesmo nome se empilham até este limite. */
  maxStack: number;
  /** Identificador do ícone/modelo visual. */
  icon: string;
  /** Variante visual no corpo do herói (ex.: tunic, chain, plate). */
  visual?: string;
  /** Valor em ouro (base do preço de compra e venda). */
  value: number;
  /** Propriedades extras sorteadas (equipamentos incomuns ou melhores). */
  affixes?: Affix[];
  /** Tier de origem (1 perto do spawn, 3 na borda). */
  tier?: 1 | 2 | 3;
  /** Peça de conjunto (ver `sets.ts`): bônus quando vestida junto com as outras do mesmo conjunto. */
  set?: SetId;
}

export const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.3,
  rare: 1.7,
  epic: 2.3,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
};

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: "Arma",
  armor: "Armadura",
  accessory: "Acessório",
};

interface EquipmentTemplate {
  name: string;
  slot: EquipSlot;
  icon: string;
  visual?: string;
  stats: ItemStats;
  value: number;
}

/** Modelos base por tier (1 = perto do spawn, 3 = borda do mundo). */
const EQUIPMENT_TEMPLATES: Record<1 | 2 | 3, EquipmentTemplate[]> = {
  1: [
    { name: "Adaga", slot: "weapon", icon: "dagger", stats: { damage: 3 }, value: 8 },
    { name: "Espada Curta", slot: "weapon", icon: "sword", stats: { damage: 5 }, value: 12 },
    { name: "Arco de Caça", slot: "weapon", icon: "bow", stats: { damage: 5 }, value: 12 },
    { name: "Cajado de Carvalho", slot: "weapon", icon: "staff", stats: { damage: 5 }, value: 12 },
    { name: "Túnica de Couro", slot: "armor", icon: "armor", visual: "tunic", stats: { maxHealth: 15 }, value: 10 },
    { name: "Anel de Vigor", slot: "accessory", icon: "ring", stats: { maxHealth: 10 }, value: 15 },
    { name: "Botas Ligeiras", slot: "accessory", icon: "boots", stats: { speedPercent: 8 }, value: 15 },
  ],
  2: [
    { name: "Machado de Guerra", slot: "weapon", icon: "axe", stats: { damage: 9 }, value: 30 },
    { name: "Espada Longa", slot: "weapon", icon: "sword", stats: { damage: 8 }, value: 28 },
    { name: "Arco Longo", slot: "weapon", icon: "bow", stats: { damage: 8 }, value: 28 },
    { name: "Cajado Rúnico", slot: "weapon", icon: "staff", stats: { damage: 9 }, value: 30 },
    { name: "Cota de Malha", slot: "armor", icon: "armor", visual: "chain", stats: { maxHealth: 35 }, value: 32 },
    { name: "Amuleto de Força", slot: "accessory", icon: "amulet", stats: { damage: 4 }, value: 35 },
    { name: "Botas do Vento", slot: "accessory", icon: "boots", stats: { speedPercent: 14 }, value: 35 },
  ],
  3: [
    { name: "Montante", slot: "weapon", icon: "sword", stats: { damage: 14 }, value: 80 },
    { name: "Machado Duplo", slot: "weapon", icon: "axe", stats: { damage: 16 }, value: 85 },
    { name: "Arco do Vento", slot: "weapon", icon: "bow", stats: { damage: 14, speedPercent: 5 }, value: 85 },
    { name: "Cajado do Dragão", slot: "weapon", icon: "staff", stats: { damage: 17 }, value: 90 },
    { name: "Armadura de Placas", slot: "armor", icon: "armor", visual: "plate", stats: { maxHealth: 70 }, value: 90 },
    { name: "Anel do Titã", slot: "accessory", icon: "ring", stats: { maxHealth: 40, damage: 3 }, value: 100 },
    { name: "Amuleto do Berserker", slot: "accessory", icon: "amulet", stats: { damage: 8 }, value: 100 },
  ],
};

const RARITY_SUFFIX: Record<Rarity, string> = {
  common: "",
  uncommon: " Reforçad@",
  rare: " Encantad@",
  epic: " Lendári@",
};

/**
 * Concorda o sufixo em gênero e número com a primeira palavra do nome (heurística simples:
 * "Botas" → Reforçadas, "Espada" → Reforçada, "Arco" → Reforçado).
 */
export function agree(suffix: string, name: string): string {
  const first = name.split(" ")[0] ?? name;
  const ending = /as$/i.test(first) ? "as" : /os$/i.test(first) ? "os" : /a$/i.test(first) ? "a" : "o";
  return suffix.replace("@", ending);
}

let nextItemId = 1;

/** Reinicia o contador de ids (usado em testes e ao carregar um jogo salvo). */
export function resetItemIds(start = 1): void {
  nextItemId = start;
}

/** Próximo id de item (para quem cria itens fora daqui, como as peças de conjunto). */
export function newItemId(): number {
  return nextItemId++;
}

/** Ouro que cada afixo soma ao valor do item, por tier. */
const AFFIX_VALUE = [6, 14, 30] as const;

export function createEquipment(rand: () => number, tier: 1 | 2 | 3, rarity: Rarity): Item {
  const pool = EQUIPMENT_TEMPLATES[tier];
  const t = pool[Math.floor(rand() * pool.length)]!;
  const mult = RARITY_MULTIPLIER[rarity];
  const stats: ItemStats = {};
  if (t.stats.damage) stats.damage = Math.round(t.stats.damage * mult);
  if (t.stats.maxHealth) stats.maxHealth = Math.round(t.stats.maxHealth * mult);
  if (t.stats.speedPercent) stats.speedPercent = Math.round(t.stats.speedPercent * mult);
  const affixes = rollAffixes(rand, t.slot, tier, rarity);
  // O primeiro afixo dá sobrenome ao item: "Espada Longa Encantada da Serpente".
  const surname = affixes[0] ? AFFIXES[affixes[0].id].suffix : "";
  return {
    id: nextItemId++,
    name: t.name + agree(RARITY_SUFFIX[rarity], t.name) + surname,
    kind: "equipment",
    slot: t.slot,
    rarity,
    stats,
    icon: t.icon,
    visual: t.visual,
    value: Math.round(t.value * mult) + affixes.length * (AFFIX_VALUE[tier - 1] ?? 6),
    quantity: 1,
    maxStack: 1,
    affixes: affixes.length ? affixes : undefined,
    tier,
  };
}

export type PotionSize = "small" | "large";

export function createPotion(size: PotionSize = "small", quantity = 1): Item {
  const large = size === "large";
  return {
    id: nextItemId++,
    name: large ? "Poção Grande" : "Poção Pequena",
    kind: "consumable",
    rarity: large ? "uncommon" : "common",
    stats: {},
    healFraction: large ? 0.6 : 0.3,
    icon: large ? "potionLarge" : "potion",
    value: large ? 14 : 5,
    quantity,
    maxStack: 10,
  };
}

/** Dois itens se empilham se forem consumíveis do mesmo nome. */
export function canStack(a: Item, b: Item): boolean {
  return a.kind === "consumable" && b.kind === "consumable" && a.name === b.name && a.maxStack > 1;
}

/** Sorteia a raridade com pesos que melhoram com o tier. */
export function rollRarity(rand: () => number, tier: 1 | 2 | 3): Rarity {
  const r = rand();
  const table: Record<1 | 2 | 3, [number, number, number]> = {
    1: [0.75, 0.95, 0.995], // comum, incomum, raro; resto épico
    2: [0.5, 0.82, 0.96],
    3: [0.2, 0.55, 0.85],
  };
  const [c, u, ra] = table[tier];
  if (r < c) return "common";
  if (r < u) return "uncommon";
  if (r < ra) return "rare";
  return "epic";
}

/** Texto curto dos bônus, para tooltip e log. */
export function describeStats(stats: ItemStats): string {
  const parts: string[] = [];
  if (stats.damage) parts.push(`+${stats.damage} dano`);
  if (stats.maxHealth) parts.push(`+${stats.maxHealth} vida`);
  if (stats.speedPercent) parts.push(`+${stats.speedPercent}% velocidade`);
  return parts.join(", ");
}
