import type { EquipSlot, Rarity } from "./items";

/**
 * Afixos: propriedades extras sorteadas num equipamento, que dão nome ao item ("Espada Longa
 * Encantada da Serpente"). São o tempero do loot: dois itens do mesmo modelo deixam de ser iguais,
 * e vale a pena olhar cada drop.
 *
 * Analogia: o modelo é a receita do bolo; o afixo é o recheio que vem diferente em cada fornada.
 */
export type AffixId = "fury" | "bear" | "serpent" | "eagle" | "vampire" | "wind" | "sage" | "fortune";

/** Atributos que afixos e equipamentos podem conceder, somados em `Bonuses`. */
export type BonusStat = "damage" | "maxHealth" | "speedPercent" | "regen" | "critChance" | "lifesteal" | "cooldownPercent" | "goldPercent";

export interface Affix {
  id: AffixId;
  value: number;
}

export interface AffixDefinition {
  id: AffixId;
  /** Vai depois do nome do item. */
  suffix: string;
  stat: BonusStat;
  /** Valor base por tier (1, 2, 3). */
  values: [number, number, number];
  slots: EquipSlot[];
  describe: (value: number) => string;
}

export const AFFIXES: Record<AffixId, AffixDefinition> = {
  fury: { id: "fury", suffix: " da Fúria", stat: "damage", values: [2, 4, 6], slots: ["weapon", "accessory"], describe: (v) => `+${v} dano` },
  bear: { id: "bear", suffix: " do Urso", stat: "maxHealth", values: [8, 16, 28], slots: ["armor", "accessory"], describe: (v) => `+${v} vida` },
  serpent: { id: "serpent", suffix: " da Serpente", stat: "regen", values: [1, 2, 3.5], slots: ["weapon", "armor", "accessory"], describe: (v) => `+${v} vida/s, mesmo em combate` },
  eagle: { id: "eagle", suffix: " da Águia", stat: "critChance", values: [4, 7, 10], slots: ["weapon", "accessory"], describe: (v) => `+${v}% de chance de crítico` },
  vampire: { id: "vampire", suffix: " do Vampiro", stat: "lifesteal", values: [3, 5, 8], slots: ["weapon"], describe: (v) => `${v}% do dano causado vira vida` },
  wind: { id: "wind", suffix: " do Vento", stat: "speedPercent", values: [4, 6, 9], slots: ["armor", "accessory"], describe: (v) => `+${v}% velocidade` },
  sage: { id: "sage", suffix: " do Sábio", stat: "cooldownPercent", values: [5, 8, 12], slots: ["weapon", "armor", "accessory"], describe: (v) => `-${v}% de recarga das habilidades` },
  fortune: { id: "fortune", suffix: " da Fortuna", stat: "goldPercent", values: [10, 20, 35], slots: ["accessory", "armor"], describe: (v) => `+${v}% de ouro dos inimigos` },
};

/** Quantos afixos cada raridade carrega. */
export function affixCount(rarity: Rarity, rand: () => number): number {
  switch (rarity) {
    case "common": return 0;
    case "uncommon": return 1;
    case "rare": return rand() < 0.5 ? 1 : 2;
    case "epic": return 2;
  }
}

const RARITY_POWER: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 1.15, epic: 1.3 };

/** Sorteia afixos distintos permitidos no slot, com valor variando ±20% em volta da base. */
export function rollAffixes(rand: () => number, slot: EquipSlot, tier: 1 | 2 | 3, rarity: Rarity, power = 1): Affix[] {
  const pool = Object.values(AFFIXES).filter((a) => a.slots.includes(slot));
  const count = Math.min(pool.length, affixCount(rarity, rand));
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const options = pool.filter((a) => !out.some((o) => o.id === a.id));
    const def = options[Math.floor(rand() * options.length)]!;
    // O nível do item só cresce o que é número absoluto (dano, vida, regeneração), não porcentagens.
    const flat = def.stat === "damage" || def.stat === "maxHealth" || def.stat === "regen";
    const raw = (def.values[tier - 1] ?? def.values[0]) * RARITY_POWER[rarity] * (0.8 + rand() * 0.4) * (flat ? power : 1);
    // Regeneração aceita meio ponto; o resto é inteiro, nunca zero.
    const value = def.stat === "regen" ? Math.max(0.5, Math.round(raw * 2) / 2) : Math.max(1, Math.round(raw));
    out.push({ id: def.id, value });
  }
  return out;
}

export function describeAffix(a: Affix): string {
  return AFFIXES[a.id].describe(a.value);
}
