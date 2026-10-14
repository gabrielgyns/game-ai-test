import { CLASS_ORDER, CLASSES, type ClassId } from "../domain/classes";
import {
  formatPlayTime, sanitizeHeroName, suggestHeroName, type SaveSlots, type SlotSummary,
} from "../domain/saveSlots";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

/**
 * Tela de saves: lista os slots, cria um herói num slot vazio (classe + nome), carrega, apaga,
 * exporta e importa. Não carrega nada sozinha: avisa o `main.ts` pelos callbacks.
 */
export class SlotsUI {
  private readonly root = el("slots");
  private readonly list = el("slots-list");
  private readonly back = el<HTMLButtonElement>("slots-back");
  /** Slot do jogo carregado agora (destacado e com "Continuar"). */
  currentSlot: number | null = null;
  /** Slot com o formulário de novo herói aberto. */
  private creating: number | null = null;
  private draftClass: ClassId = "warrior";
  private draftName = "";
  /** O jogador escreveu o próprio nome: trocar de classe não troca mais a sugestão. */
  private nameTouched = false;

  onPlay: (slot: number) => void = () => {};
  onNew: (slot: number, classId: ClassId, heroName: string) => void = () => {};
  onDelete: (slot: number) => void = () => {};
  onExport: (slot: number) => void = () => {};
  onImport: (slot: number) => void = () => {};
  onBack: () => void = () => {};

  constructor(private readonly slots: SaveSlots) {
    this.back.addEventListener("click", () => this.onBack());
    // Teclas digitadas no nome não podem virar comandos do jogo (I, Q, 1-4...).
    this.root.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement && e.key !== "Escape") e.stopPropagation();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  /** `canGoBack`: há para onde voltar (jogo carregado); na primeira tela sem save, não há. */
  open(canGoBack: boolean): void {
    this.back.classList.toggle("hidden", !canGoBack);
    this.creating = null;
    this.root.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  /** Abre direto o formulário de novo herói no primeiro slot vazio (primeira visita). */
  startCreating(slot: number): void {
    this.beginCreate(slot);
  }

  render(): void {
    this.list.replaceChildren(...this.slots.list().map((s) => this.card(s)));
  }

  private beginCreate(slot: number): void {
    this.creating = slot;
    this.draftClass = "warrior";
    this.draftName = suggestHeroName(this.draftClass);
    this.nameTouched = false;
    this.render();
    const input = this.list.querySelector<HTMLInputElement>("input.hero-name");
    input?.focus();
    input?.select();
  }

  private card(s: SlotSummary): HTMLElement {
    const card = h("div", "slot-card");
    card.dataset.slot = String(s.slot);
    if (s.slot === this.currentSlot) card.classList.add("current");
    const head = h("div", "slot-head");
    head.append(h("span", "slot-number", `Slot ${s.slot}`));
    card.append(head);

    if (this.creating === s.slot) {
      card.classList.add("creating");
      card.append(this.createForm(s.slot));
      return card;
    }

    const actions = h("div", "slot-actions");
    if (s.empty) {
      card.classList.add("empty");
      head.append(h("span", "slot-title muted", "Vazio"));
      actions.append(
        this.button("Novo jogo", "primary", () => this.beginCreate(s.slot)),
        this.button("Importar", "", () => this.onImport(s.slot)),
      );
    } else {
      head.append(h("span", "slot-title", `${s.heroName}`), h("span", "slot-class", `${s.className} · Nível ${s.level}`));
      const when = new Date(s.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
      card.append(h("div", "slot-meta", `${s.gold} ouro · ${s.questsDone} quest${s.questsDone === 1 ? "" : "s"} · ${formatPlayTime(s.playTime)} de jogo · salvo ${when}`));
      const current = s.slot === this.currentSlot;
      actions.append(
        this.button(current ? "Continuar" : "Jogar", "primary", () => this.onPlay(s.slot)),
        this.button("Exportar", "", () => this.onExport(s.slot)),
        this.button("Apagar", "danger", () => {
          if (confirm(`Apagar o save do slot ${s.slot} (${s.heroName}, ${s.className} nível ${s.level})? Isso não pode ser desfeito.`)) {
            this.onDelete(s.slot);
          }
        }),
      );
    }
    card.append(actions);
    return card;
  }

  private createForm(slot: number): HTMLElement {
    const form = h("div", "slot-create");
    const classes = h("div", "slot-classes");
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id];
      const btn = h("button", `class-card${id === this.draftClass ? " selected" : ""}`);
      btn.type = "button";
      btn.dataset.class = id;
      btn.innerHTML = `<div class="name">${c.name}</div><div class="tagline">${c.tagline}</div><div class="desc">${c.description}</div><div class="stats"><span>Vida <b>${c.baseMaxHealth}</b></span><span>Dano <b>${c.baseDamage}</b></span><span>${c.attackStyle === "melee" ? "Corpo a corpo" : "À distância"}</span></div>`;
      btn.addEventListener("click", () => {
        // Trocar de classe troca a sugestão de nome, a menos que o jogador já tenha escrito o dele.
        this.draftClass = id;
        if (!this.nameTouched) this.draftName = suggestHeroName(id);
        this.render();
      });
      classes.append(btn);
    }
    const nameRow = h("label", "slot-name-row");
    nameRow.append(h("span", "", "Nome do herói"));
    const input = h("input", "hero-name");
    input.maxLength = 16;
    input.value = this.draftName;
    input.placeholder = CLASSES[this.draftClass].name;
    input.addEventListener("input", () => {
      this.draftName = input.value;
      this.nameTouched = true;
    });
    const start = () => this.onNew(slot, this.draftClass, sanitizeHeroName(input.value) || CLASSES[this.draftClass].name);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") start();
    });
    nameRow.append(input);
    const actions = h("div", "slot-actions");
    actions.append(
      this.button(`Começar como ${CLASSES[this.draftClass].name}`, "primary", start),
      this.button("Cancelar", "", () => {
        this.creating = null;
        this.render();
      }),
    );
    form.append(classes, nameRow, actions);
    return form;
  }

  private button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
    const b = h("button", cls, text);
    b.type = "button";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }
}
