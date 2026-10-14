import { describeAffix, type BonusStat } from "../domain/affixes";
import { itemBonus, type Equipment } from "../domain/inventory";
import { describeStats, RARITY_LABEL, SLOT_LABEL, type Item, type Rarity } from "../domain/items";
import { equippedSetCounts, SET_SLOTS, SETS } from "../domain/sets";
import type { ClassId } from "../domain/classes";

/** Como o item aparece na interface: a raridade, ou "set" para peças de conjunto (verde-água). */
export type DisplayRarity = Rarity | "set";
export const displayRarity = (item: Item): DisplayRarity => (item.set ? "set" : item.rarity);

const STAT_NAMES: Record<BonusStat, string> = {
  damage: "dano",
  maxHealth: "vida",
  speedPercent: "% velocidade",
  regen: "vida/s",
  critChance: "% crítico",
  lifesteal: "% roubo de vida",
  cooldownPercent: "% recarga",
  goldPercent: "% ouro",
};

/**
 * HTML do tooltip de um item: nome, raridade, atributos, afixos (em azul), comparação com o que
 * está equipado no mesmo slot e uma linha de dica (ação do clique, preço).
 */
export function itemTooltipHTML(item: Item, opts: { compare?: Item | null; hint?: string; price?: string; equipment?: Equipment; classId?: ClassId } = {}): string {
  const lines = [`<div class="name">${item.name}${item.quantity > 1 ? ` <span class="qty-inline">×${item.quantity}</span>` : ""}</div>`];
  const kind = item.kind === "equipment" && item.slot ? SLOT_LABEL[item.slot] : "Consumível";
  const label = item.set ? "Peça de conjunto" : RARITY_LABEL[item.rarity];
  lines.push(`<div class="rarity">${label} · ${kind}${item.tier && !item.set ? ` · tier ${item.tier}` : ""}</div>`);
  if (item.kind === "equipment") {
    const base = describeStats(item.stats);
    if (base) lines.push(`<div class="stat">${base}</div>`);
    for (const a of item.affixes ?? []) lines.push(`<div class="affix">◆ ${describeAffix(a)}</div>`);
    const current = opts.compare;
    if (current && current !== item) {
      const mine = itemBonus(item);
      const theirs = itemBonus(current);
      const parts = (Object.keys(mine) as BonusStat[])
        .map((k) => [k, Math.round((mine[k] - theirs[k]) * 10) / 10] as const)
        .filter(([, d]) => d !== 0);
      if (parts.length) {
        lines.push(
          `<div class="cmp">vs. ${current.name}: ` +
            parts.map(([k, d]) => `<span class="${d > 0 ? "better" : "worse"}">${d > 0 ? "+" : ""}${d} ${STAT_NAMES[k]}</span>`).join(", ") +
            "</div>",
        );
      }
    }
  } else if (item.healFraction) {
    lines.push(`<div class="stat">Cura ${Math.round(item.healFraction * 100)}% da vida máxima</div>`);
  }
  if (item.set) lines.push(setBlock(item, opts.equipment, opts.classId ?? "warrior"));
  if (opts.price) lines.push(`<div class="price">${opts.price}</div>`);
  if (opts.hint) lines.push(`<div class="cmp">${opts.hint}</div>`);
  return lines.join("");
}

/** Bloco do conjunto: nome, as três peças (vestidas acesas) e os bônus de 2 e 3 peças. */
function setBlock(item: Item, equipment: Equipment | undefined, classId: ClassId): string {
  const set = SETS[item.set!];
  const worn = equipment ? equippedSetCounts(equipment).get(set.id) ?? 0 : 0;
  const pieces = SET_SLOTS.map((slot) => {
    const name = slot === "weapon" ? set.weapon[classId].name : set[slot].name;
    const on = equipment?.[slot]?.set === set.id;
    return `<div class="piece${on ? " on" : ""}">${on ? "●" : "○"} ${name}</div>`;
  }).join("");
  const bonus = (n: number, text: string) => `<div class="tier${worn >= n ? " on" : ""}">(${n}) ${text}</div>`;
  return `<div class="set"><div class="set-name">${set.name} (${worn}/3)</div>${pieces}${bonus(2, set.two.text)}${bonus(3, set.three.text)}</div>`;
}

