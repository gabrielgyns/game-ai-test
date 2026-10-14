import type { Entity } from "../domain/components";
import {
  effectiveCooldown, learnRank, MAX_RANK, pointsAvailable, rankOf, resetCost, resetTalents, SKILL_TREE,
} from "../domain/skillTree";
import { SKILLS, type SkillId } from "../domain/skills";
import type { World } from "../domain/world";
import { iconCanvas } from "./itemIcons";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/**
 * Painel da árvore (K): uma coluna por habilidade da classe, cinco ranks de cima para baixo.
 * Rank aprendido em dourado, o próximo pulsa quando há ponto, talentos (3 e 5) em losango roxo.
 */
export class SkillTreeUI {
  private readonly root = el("tree");
  private readonly cols = el("tree-cols");
  private readonly points = el("tree-points");
  private readonly resetBtn = el<HTMLButtonElement>("tree-reset");
  onAction: () => void = () => {};
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {
    this.resetBtn.addEventListener("click", () => {
      const cost = resetCost(this.player);
      if (!confirm(`Reiniciar a árvore devolve todos os pontos por ${cost} ouro. Continuar?`)) return;
      const r = resetTalents(this.world, this.player);
      if (r === "noGold") this.onMessage(`Precisa de ${cost} ouro para reiniciar.`);
      if (r === "nothing") this.onMessage("Nenhum ponto gasto ainda.");
      this.after();
    });
    el("tree-close").addEventListener("click", () => this.onClose());
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

  private after(): void {
    this.onAction();
    this.render();
  }

  render(): void {
    const available = pointsAvailable(this.player);
    this.points.textContent = available > 0 ? `${available} ponto${available > 1 ? "s" : ""} para gastar` : "Sem pontos: suba de nível para ganhar mais";
    this.points.classList.toggle("has-points", available > 0);
    this.resetBtn.textContent = `Reiniciar árvore (${resetCost(this.player)} ouro)`;
    const skills = this.player.abilities?.skills.map((s) => s.id) ?? [];
    this.cols.replaceChildren(...skills.map((id, i) => this.column(id, i, available)));
  }

  private column(id: SkillId, index: number, available: number): HTMLElement {
    const def = SKILLS[id];
    const rank = rankOf(this.player, id);
    const col = document.createElement("div");
    col.className = "tree-col";
    const head = document.createElement("div");
    head.className = "tree-head";
    const icon = document.createElement("canvas");
    icon.width = icon.height = 12;
    icon.className = "icon";
    icon.getContext("2d")!.drawImage(iconCanvas(def.icon), 0, 0);
    const title = document.createElement("div");
    title.innerHTML = `<div class="tname"><span class="tkey">${index + 1}</span>${def.name}</div><div class="trank">Rank ${rank}/${MAX_RANK} · recarga ${effectiveCooldown(this.player, id).toFixed(1)} s</div>`;
    head.append(icon, title);
    const desc = document.createElement("div");
    desc.className = "tree-desc";
    desc.textContent = def.description;
    col.append(head, desc);

    SKILL_TREE[id].forEach((r, i) => {
      const n = i + 1;
      const node = document.createElement("button");
      node.type = "button";
      const talent = !!r.mods.talent;
      const state = n <= rank ? "learned" : n === rank + 1 && available > 0 ? "next" : "locked";
      node.className = `tree-node ${state}${talent ? " talent" : ""}`;
      node.innerHTML = `<span class="nrank">${talent ? "◆" : n}</span><span class="ntext"><b>${r.name}</b><small>${r.description}</small></span>`;
      node.addEventListener("click", () => {
        if (state !== "next") {
          if (state === "locked") this.onMessage(available <= 0 ? "Sem pontos de habilidade." : "Aprenda os ranks em ordem.");
          return;
        }
        learnRank(this.world, this.player, id);
        this.after();
      });
      col.appendChild(node);
    });
    return col;
  }
}
