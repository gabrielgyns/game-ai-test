import type { Entity } from "../domain/components";
import { npcById } from "../domain/npc";
import { acceptQuest, completeQuest, questsForNpc, type QuestDefinition } from "../domain/quests";
import type { World } from "../domain/world";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/** Painel de conversa com um NPC: fala e opções (aceitar, entregar, fechar). */
export class DialogueUI {
  private readonly root = el("dialogue");
  private readonly name = el("dialogue-name");
  private readonly text = el("dialogue-text");
  private readonly options = el("dialogue-options");
  private npc: Entity | null = null;
  private idleIndex = 0;
  onClose: () => void = () => {};
  /** Chamado após aceitar ou entregar, para o jogo processar os eventos na hora (o mundo está pausado). */
  onAction: () => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {}

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(npc: Entity): void {
    this.npc = npc;
    this.root.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
    this.npc = null;
  }

  private render(): void {
    const npc = this.npc;
    if (!npc?.npc) return;
    const def = npcById(npc.npc.id);
    if (!def) return;
    this.name.textContent = def.name;
    this.options.innerHTML = "";
    const { offer, turnIn, active } = questsForNpc(this.player.quests ?? {}, def.id);

    if (turnIn.length) {
      const q = turnIn[0]!;
      this.text.textContent = q.dialogue.complete;
      this.button(`Entregar: ${q.title}`, "primary", () => {
        if (completeQuest(this.world, this.player, q.id)) {
          this.onAction();
          this.render();
        }
      });
    } else if (offer.length) {
      const q = offer[0]!;
      this.text.textContent = q.dialogue.offer;
      this.button(`Aceitar: ${q.title}`, "primary", () => {
        if (acceptQuest(this.world, this.player, q.id)) {
          this.onAction();
          this.render();
        }
      });
    } else if (active.length) {
      const q = active[0]!;
      this.text.textContent = q.dialogue.progress;
      this.objectiveLine(q);
    } else {
      this.text.textContent = def.idle[this.idleIndex % def.idle.length] ?? "";
      this.idleIndex++;
    }
    this.button("Fechar", "", () => this.onClose());
  }

  private objectiveLine(q: QuestDefinition): void {
    const entry = this.player.quests?.[q.id];
    const line = document.createElement("div");
    line.className = "objective";
    line.textContent = `${q.objective.label}: ${entry?.progress ?? 0} / ${q.objective.count}`;
    this.options.appendChild(line);
  }

  private button(label: string, cls: string, onClick: () => void): void {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    this.options.appendChild(b);
  }
}
