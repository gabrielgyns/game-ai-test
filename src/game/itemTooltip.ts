import { describeAffix, type BonusStat } from "../domain/affixes";
import { itemBonus } from "../domain/inventory";
import { describeStats, RARITY_LABEL, SLOT_LABEL, type Item } from "../domain/items";

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
export function itemTooltipHTML(item: Item, opts: { compare?: Item | null; hint?: string; price?: string } = {}): string {
  const lines = [`<div class="name">${item.name}${item.quantity > 1 ? ` <span class="qty-inline">×${item.quantity}</span>` : ""}</div>`];
  const kind = item.kind === "equipment" && item.slot ? SLOT_LABEL[item.slot] : "Consumível";
  lines.push(`<div class="rarity">${RARITY_LABEL[item.rarity]} · ${kind}${item.tier ? ` · tier ${item.tier}` : ""}</div>`);
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
  if (opts.price) lines.push(`<div class="price">${opts.price}</div>`);
  if (opts.hint) lines.push(`<div class="cmp">${opts.hint}</div>`);
  return lines.join("");
}
