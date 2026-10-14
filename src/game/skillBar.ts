import type { Entity } from "../domain/components";
import { SKILL_BAR, SKILLS, type SkillId } from "../domain/skills";
import { iconCanvas } from "./itemIcons";

/** Barra de habilidades (1 a 4) com cooldown e destaque do buff ativo. */
export class SkillBar {
  private readonly root = document.getElementById("skillbar")!;
  private readonly slots = new Map<SkillId, { el: HTMLDivElement; cd: HTMLDivElement; text: HTMLDivElement }>();

  constructor() {
    SKILL_BAR.forEach((id, i) => {
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
  }

  update(player: Entity): void {
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
      slot.el.classList.toggle("active", s.id === "warcry" && ab.damageBuff !== null);
    }
  }
}
