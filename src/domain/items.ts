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
  /** Identificador do ícone/modelo visual. */
  icon: string;
  /** Valor em ouro (futuro: venda). */
  value: number;
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
  stats: ItemStats;
  value: number;
}

/** Modelos base por tier (1 = perto do spawn, 3 = borda do mundo). */
const EQUIPMENT_TEMPLATES: Record<1 | 2 | 3, EquipmentTemplate[]> = {
  1: [
    { name: "Adaga", slot: "weapon", icon: "dagger", stats: { damage: 3 }, value: 8 },
    { name: "Espada Curta", slot: "weapon", icon: "sword", stats: { damage: 5 }, value: 12 },
    { name: "Túnica de Couro", slot: "armor", icon: "armor", stats: { maxHealth: 15 }, value: 10 },
    { name: "Anel de Vigor", slot: "accessory", icon: "ring", stats: { maxHealth: 10 }, value: 15 },
    { name: "Botas Ligeiras", slot: "accessory", icon: "boots", stats: { speedPercent: 8 }, value: 15 },
  ],
  2: [
    { name: "Machado de Guerra", slot: "weapon", icon: "axe", stats: { damage: 9 }, value: 30 },
    { name: "Espada Longa", slot: "weapon", icon: "sword", stats: { damage: 8 }, value: 28 },
    { name: "Cota de Malha", slot: "armor", icon: "armor", stats: { maxHealth: 35 }, value: 32 },
    { name: "Amuleto de Força", slot: "accessory", icon: "amulet", stats: { damage: 4 }, value: 35 },
    { name: "Botas do Vento", slot: "accessory", icon: "boots", stats: { speedPercent: 14 }, value: 35 },
  ],
  3: [
    { name: "Montante", slot: "weapon", icon: "sword", stats: { damage: 14 }, value: 80 },
    { name: "Machado Duplo", slot: "weapon", icon: "axe", stats: { damage: 16 }, value: 85 },
    { name: "Armadura de Placas", slot: "armor", icon: "armor", stats: { maxHealth: 70 }, value: 90 },
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

/** Concorda o sufixo em gênero com o nome (heurística simples: nomes terminados em "a" são femininos). */
function agree(suffix: string, name: string): string {
  const feminine = /a$/i.test(name.split(" ")[0] ?? name);
  return suffix.replace("@", feminine ? "a" : "o");
}

let nextItemId = 1;

/** Reinicia o contador de ids (usado em testes e ao carregar um jogo salvo). */
export function resetItemIds(start = 1): void {
  nextItemId = start;
}

export function createEquipment(rand: () => number, tier: 1 | 2 | 3, rarity: Rarity): Item {
  const pool = EQUIPMENT_TEMPLATES[tier];
  const t = pool[Math.floor(rand() * pool.length)]!;
  const mult = RARITY_MULTIPLIER[rarity];
  const stats: ItemStats = {};
  if (t.stats.damage) stats.damage = Math.round(t.stats.damage * mult);
  if (t.stats.maxHealth) stats.maxHealth = Math.round(t.stats.maxHealth * mult);
  if (t.stats.speedPercent) stats.speedPercent = Math.round(t.stats.speedPercent * mult);
  return {
    id: nextItemId++,
    name: t.name + agree(RARITY_SUFFIX[rarity], t.name),
    kind: "equipment",
    slot: t.slot,
    rarity,
    stats,
    icon: t.icon,
    value: Math.round(t.value * mult),
  };
}

export function createPotion(): Item {
  return {
    id: nextItemId++,
    name: "Poção de Vida",
    kind: "consumable",
    rarity: "common",
    stats: {},
    healFraction: 0.4,
    icon: "potion",
    value: 5,
  };
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
