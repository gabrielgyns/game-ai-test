import type { ClassId } from "./classes";
import type { BonusStat } from "./affixes";
import type { Equipment, Inventory } from "./inventory";
import { newItemId, type EquipSlot, type Item, type ItemStats } from "./items";

/**
 * Conjuntos de itens: três peças (arma, armadura, acessório) que cada chefe guarda. Vestir duas
 * peças do mesmo conjunto dá um bônus de atributo; vestir as três libera um poder que muda o jeito de
 * lutar. É o motivo para voltar ao chefe: cada vitória traz uma peça, de preferência uma que falta.
 *
 * Analogia: as peças avulsas são boas cartas; o conjunto é a combinação que vira a mão.
 */
export type SetId = "goblinKing" | "spiderQueen" | "scorpionEmperor" | "skeletonLord";

/** Poderes de 3 peças. Cada um é lido num ponto do combate (ver `combat.ts`). */
export type SetPower = "royalFury" | "venom" | "sandShell" | "soulHarvest";

interface PieceTemplate {
  name: string;
  icon: string;
  visual?: string;
  stats: ItemStats;
}

export interface SetDefinition {
  id: SetId;
  name: string;
  /** Arquétipo do chefe que guarda o conjunto. */
  boss: string;
  /** A arma muda com a classe de quem a encontra (espada, arco ou cajado). */
  weapon: Record<ClassId, PieceTemplate>;
  armor: PieceTemplate;
  accessory: PieceTemplate;
  two: { stat: BonusStat; value: number; text: string };
  three: { power: SetPower; text: string };
}

export const SETS: Record<SetId, SetDefinition> = {
  goblinKing: {
    id: "goblinKing",
    name: "Espólios do Rei Goblin",
    boss: "goblinKing",
    weapon: {
      warrior: { name: "Machado do Rei Goblin", icon: "axe", stats: { damage: 28 } },
      archer: { name: "Arco do Rei Goblin", icon: "bow", stats: { damage: 27 } },
      mage: { name: "Cetro do Rei Goblin", icon: "staff", stats: { damage: 29 } },
    },
    armor: { name: "Couraça do Rei Goblin", icon: "armor", visual: "plate", stats: { maxHealth: 120 } },
    accessory: { name: "Anel do Rei Goblin", icon: "ring", stats: { damage: 7, maxHealth: 30 } },
    two: { stat: "critChance", value: 8, text: "+8% de chance de crítico" },
    three: { power: "royalFury", text: "Fúria Real: com menos de metade da vida, +30% de dano" },
  },
  spiderQueen: {
    id: "spiderQueen",
    name: "Seda da Rainha",
    boss: "spiderQueen",
    weapon: {
      warrior: { name: "Presa da Rainha", icon: "sword", stats: { damage: 30 } },
      archer: { name: "Arco de Teia", icon: "bow", stats: { damage: 29 } },
      mage: { name: "Cajado de Teia", icon: "staff", stats: { damage: 31 } },
    },
    armor: { name: "Manto de Seda", icon: "armor", visual: "tunic", stats: { maxHealth: 100, speedPercent: 6 } },
    accessory: { name: "Amuleto da Viúva", icon: "amulet", stats: { damage: 12 } },
    two: { stat: "lifesteal", value: 5, text: "5% do dano causado vira vida" },
    three: { power: "venom", text: "Veneno: golpes básicos deixam o alvo lento por 2 s" },
  },
  scorpionEmperor: {
    id: "scorpionEmperor",
    name: "Armadura do Imperador",
    boss: "scorpionEmperor",
    weapon: {
      warrior: { name: "Ferrão do Imperador", icon: "sword", stats: { damage: 32 } },
      archer: { name: "Arco do Imperador", icon: "bow", stats: { damage: 31 } },
      mage: { name: "Cajado do Imperador", icon: "staff", stats: { damage: 33 } },
    },
    armor: { name: "Carapaça do Imperador", icon: "armor", visual: "plate", stats: { maxHealth: 170 } },
    accessory: { name: "Botas das Dunas", icon: "boots", stats: { speedPercent: 14, maxHealth: 30 } },
    two: { stat: "maxHealth", value: 60, text: "+60 vida" },
    three: { power: "sandShell", text: "Casca de Areia: recebe 20% menos dano" },
  },
  skeletonLord: {
    id: "skeletonLord",
    name: "Relíquias do Lorde",
    boss: "skeletonLord",
    weapon: {
      warrior: { name: "Lâmina Sepulcral", icon: "sword", stats: { damage: 31 } },
      archer: { name: "Arco de Osso", icon: "bow", stats: { damage: 30 } },
      mage: { name: "Cajado de Osso", icon: "staff", stats: { damage: 32 } },
    },
    armor: { name: "Mortalha do Lorde", icon: "armor", visual: "chain", stats: { maxHealth: 130 } },
    accessory: { name: "Anel de Ossos", icon: "ring", stats: { damage: 8, maxHealth: 25 } },
    two: { stat: "cooldownPercent", value: 10, text: "-10% de recarga das habilidades" },
    three: { power: "soulHarvest", text: "Colheita de Almas: cada abate cura 6% da vida e adianta as habilidades em 1 s" },
  },
};

export const SET_SLOTS: EquipSlot[] = ["weapon", "armor", "accessory"];
/** Valor em ouro de uma peça (a Mercadora paga um terço disso, como em qualquer item). */
const PIECE_VALUE = 260;

/** Conjunto guardado por um chefe (pelo arquétipo), se houver. */
export function setForBoss(archetype: string): SetDefinition | undefined {
  return Object.values(SETS).find((s) => s.boss === archetype);
}

function template(set: SetDefinition, slot: EquipSlot, classId: ClassId): PieceTemplate {
  return slot === "weapon" ? set.weapon[classId] : set[slot];
}

/** Cria uma peça do conjunto. A arma acompanha a classe; as outras são iguais para todos. */
export function createSetPiece(setId: SetId, slot: EquipSlot, classId: ClassId = "warrior"): Item {
  const set = SETS[setId];
  const t = template(set, slot, classId);
  return {
    id: newItemId(),
    name: t.name,
    kind: "equipment",
    slot,
    rarity: "epic",
    stats: { ...t.stats },
    icon: t.icon,
    visual: t.visual,
    value: PIECE_VALUE,
    quantity: 1,
    maxStack: 1,
    tier: 3,
    set: setId,
  };
}

/** Quantas peças de cada conjunto estão vestidas. */
export function equippedSetCounts(eq: Equipment): Map<SetId, number> {
  const counts = new Map<SetId, number>();
  for (const slot of SET_SLOTS) {
    const id = eq[slot]?.set;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Bônus ativos pelos conjuntos vestidos: atributos (2 peças) e poderes (3 peças). */
export function activeSetBonuses(eq: Equipment): { stats: Partial<Record<BonusStat, number>>; powers: SetPower[] } {
  const stats: Partial<Record<BonusStat, number>> = {};
  const powers: SetPower[] = [];
  for (const [id, n] of equippedSetCounts(eq)) {
    const set = SETS[id];
    if (n >= 2) stats[set.two.stat] = (stats[set.two.stat] ?? 0) + set.two.value;
    if (n >= 3) powers.push(set.three.power);
  }
  return { stats, powers };
}

export function hasSetPower(e: { bonuses?: { powers?: SetPower[] } }, power: SetPower): boolean {
  return e.bonuses?.powers?.includes(power) ?? false;
}

/**
 * Qual peça o chefe deixa cair: uma que o herói ainda não tem (nem vestida nem na mochila), para
 * cada vitória aproximar o conjunto. Com o conjunto completo, qualquer uma.
 */
export function pickSetSlot(setId: SetId, owned: { equipment?: Equipment; inventory?: Inventory }, rand: () => number): EquipSlot {
  const has = (slot: EquipSlot) =>
    owned.equipment?.[slot]?.set === setId || (owned.inventory?.items ?? []).some((i) => i?.set === setId && i.slot === slot);
  const missing = SET_SLOTS.filter((s) => !has(s));
  const pool = missing.length ? missing : SET_SLOTS;
  return pool[Math.floor(rand() * pool.length)]!;
}
