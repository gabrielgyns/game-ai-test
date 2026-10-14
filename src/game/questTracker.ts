import type { Entity } from "../domain/components";
import { npcById } from "../domain/npc";
import { isObjectiveDone, QUESTS } from "../domain/quests";

/** Lista de quests ativas no canto superior direito. */
export class QuestTracker {
  private readonly root = document.getElementById("quests")!;
  private lastKey = "";

  update(player: Entity): void {
    const log = player.quests ?? {};
    const active = QUESTS.filter((q) => log[q.id]?.state === "active");
    const key = active.map((q) => `${q.id}:${log[q.id]!.progress}`).join("|");
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.root.classList.toggle("hidden", active.length === 0);
    this.root.innerHTML = "<h3>Quests</h3>";
    for (const q of active) {
      const entry = log[q.id]!;
      const done = isObjectiveDone(log, q);
      const item = document.createElement("div");
      item.className = `quest${done ? " done" : ""}`;
      const giver = npcById(q.giver)?.name ?? q.giver;
      item.innerHTML = `<div class="title">${q.title}</div><div class="obj">${done ? `Volte para ${giver}` : `${q.objective.label}: ${entry.progress} / ${q.objective.count}`}</div>`;
      this.root.appendChild(item);
    }
  }
}
