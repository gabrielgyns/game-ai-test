import type { Entity } from "../domain/components";
import { SKILLS, type SkillId } from "../domain/skills";
import { iconCanvas } from "./itemIcons";
import { countItems } from "../domain/inventory";

/** Barra de habilidades (1 a 4) com cooldown e destaque do buff ativo. */
export class SkillBar {
  private readonly root = document.getElementById("skillbar")!;
  private readonly slots = new Map<SkillId, { el: HTMLDivElement; cd: HTMLDivElement; text: HTMLDivElement }>();
  private readonly potionSlot: HTMLDivElement;
  private readonly potionCount: HTMLSpanElement;

  constructor(skillIds: SkillId[]) {
    skillIds.forEach((id, i) => {
      const def = SKILLS[id];
      const el = document.createElement("div");
      el.className = "skill ready";
      el.title = `${def.name}: ${def.description}`;
      const icon = document.createElement("canvas");
      icon.width = 12;
      icon.height = 12;
      icon.className = "icon";
      icon.getContext("2d")!.drawImage(iconCanvas(def.icon), 0, 0);
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = `${i + 1}`;
      const cd = document.createElement("div");
      cd.className = "cd";
      const text = document.createElement("div");
      text.className = "cd-text";
      el.append(icon, key, cd, text);
      this.root.appendChild(el);
      this.slots.set(id, { el, cd, text });
    });

    // Slot da poção (Q), separado das habilidades.
    const gap = document.createElement("div");
    gap.className = "skill-gap";
    this.root.appendChild(gap);
    const potion = document.createElement("div");
    potion.className = "skill potion ready";
    potion.title = "Poção (Q): bebe a menor que cobre o que falta. Pequena cura 30%, grande 60%.";
    const icon = document.createElement("canvas");
    icon.width = 12;
    icon.height = 12;
    icon.className = "icon";
    icon.getContext("2d")!.drawImage(iconCanvas("potion"), 0, 0);
    const key = document.createElement("span");
    key.className = "key";
    key.textContent = "Q";
    const count = document.createElement("span");
    count.className = "count";
    potion.append(icon, key, count);
    this.root.appendChild(potion);
    this.potionSlot = potion;
    this.potionCount = count;
  }

  update(player: Entity): void {
    const potions = player.inventory ? countItems(player.inventory, (i) => i.kind === "consumable") : 0;
    this.potionCount.textContent = `×${potions}`;
    this.potionSlot.classList.toggle("ready", potions > 0);
    this.potionSlot.classList.toggle("empty", potions === 0);
    const ab = player.abilities;
    if (!ab) return;
    for (const s of ab.skills) {
      const slot = this.slots.get(s.id);
      if (!slot) continue;
      const total = SKILLS[s.id].cooldown;
      const ratio = s.cooldownLeft / total;
      slot.cd.style.height = `${ratio * 100}%`;
      slot.text.textContent = s.cooldownLeft > 0 ? `${Math.ceil(s.cooldownLeft)}` : "";
      slot.el.classList.toggle("ready", s.cooldownLeft <= 0);
      const isBuff = s.id === "warcry" || s.id === "focus";
      const isShield = s.id === "arcaneShield";
      slot.el.classList.toggle("active", (isBuff && ab.damageBuff !== null) || (isShield && ab.shield !== null));
    }
  }
}
