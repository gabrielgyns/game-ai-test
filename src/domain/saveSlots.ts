import { CLASSES, isClassId, type ClassId } from "./classes";
import { isSaveData, type SaveData } from "./save";

/**
 * Vários saves locais, como os "arquivos" de um console: cada slot guarda um jogo inteiro.
 * O domínio não sabe o que é localStorage; recebe uma porta chave-valor (o navegador passa o
 * localStorage, os testes passam um Map).
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SLOT_COUNT = 5;
/** Chave do save único de antes dos slots; migra para o slot 1. */
export const LEGACY_SAVE_KEY = "vale.save";
export const ACTIVE_SLOT_KEY = "vale.activeSlot";
export const slotKey = (slot: number): string => `vale.save.${slot}`;

export type SlotSummary =
  | { slot: number; empty: true }
  | {
      slot: number;
      empty: false;
      heroName: string;
      classId: ClassId;
      className: string;
      level: number;
      gold: number;
      questsDone: number;
      /** Segundos de jogo (tempo do mundo, sem pausas). */
      playTime: number;
      savedAt: number;
    };

export function isValidSlot(slot: unknown): slot is number {
  return typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT;
}

/** Nome do herói, com o nome da classe como padrão para saves antigos. */
export function heroNameOf(save: SaveData): string {
  const classId = isClassId(save.player.classId) ? save.player.classId : "warrior";
  return save.player.heroName?.trim() || CLASSES[classId].name;
}

export function summarize(slot: number, save: SaveData | null): SlotSummary {
  if (!save) return { slot, empty: true };
  const classId = isClassId(save.player.classId) ? save.player.classId : "warrior";
  return {
    slot,
    empty: false,
    heroName: heroNameOf(save),
    classId,
    className: CLASSES[classId].name,
    level: save.player.level,
    gold: save.player.gold,
    questsDone: Object.values(save.player.quests).filter((q) => q.state === "completed").length,
    playTime: save.time,
    savedAt: save.savedAt,
  };
}

/** "1h 05min", "12min", "40s". */
export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** Limpa o nome digitado: sem espaços nas pontas, no máximo 16 caracteres. */
export function sanitizeHeroName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 16);
}

export class SaveSlots {
  constructor(private readonly store: KeyValueStore) {}

  /** Lê um slot; dados corrompidos ou de outro formato contam como vazio. */
  read(slot: number): SaveData | null {
    if (!isValidSlot(slot)) return null;
    const raw = this.safeGet(slotKey(slot));
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isSaveData(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  write(slot: number, save: SaveData): boolean {
    if (!isValidSlot(slot)) return false;
    try {
      this.store.setItem(slotKey(slot), JSON.stringify(save));
      return true;
    } catch {
      return false; // cota cheia ou armazenamento bloqueado
    }
  }

  remove(slot: number): void {
    if (!isValidSlot(slot)) return;
    this.safeRemove(slotKey(slot));
    if (this.activeSlot === slot) this.safeRemove(ACTIVE_SLOT_KEY);
  }

  list(): SlotSummary[] {
    const out: SlotSummary[] = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) out.push(summarize(slot, this.read(slot)));
    return out;
  }

  firstEmpty(): number | null {
    for (let slot = 1; slot <= SLOT_COUNT; slot++) if (!this.read(slot)) return slot;
    return null;
  }

  /** O slot em que o jogo atual salva; lembrado entre sessões para "continuar" com um clique. */
  get activeSlot(): number | null {
    const n = Number(this.safeGet(ACTIVE_SLOT_KEY));
    return isValidSlot(n) ? n : null;
  }

  set activeSlot(slot: number | null) {
    if (slot === null) this.safeRemove(ACTIVE_SLOT_KEY);
    else if (isValidSlot(slot)) {
      try {
        this.store.setItem(ACTIVE_SLOT_KEY, String(slot));
      } catch {
        /* sem armazenamento: o slot vale só nesta sessão */
      }
    }
  }

  /**
   * Move o save único antigo para o primeiro slot livre e o torna ativo.
   * Devolve o slot de destino, ou null se não havia nada para migrar.
   */
  migrateLegacy(): number | null {
    const raw = this.safeGet(LEGACY_SAVE_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!isSaveData(parsed)) {
      this.safeRemove(LEGACY_SAVE_KEY);
      return null;
    }
    const slot = this.firstEmpty();
    if (slot === null || !this.write(slot, parsed)) return null; // mantém o antigo até haver espaço
    this.safeRemove(LEGACY_SAVE_KEY);
    if (this.activeSlot === null) this.activeSlot = slot;
    return slot;
  }

  private safeGet(key: string): string | null {
    try {
      return this.store.getItem(key);
    } catch {
      return null;
    }
  }

  private safeRemove(key: string): void {
    try {
      this.store.removeItem(key);
    } catch {
      /* ignora */
    }
  }
}

const NAME_IDEAS: Record<ClassId, string[]> = {
  warrior: ["Bruna", "Taurin", "Gael", "Ivar", "Rhoda", "Dario"],
  archer: ["Lia", "Fennel", "Sira", "Tobias", "Wren", "Iara"],
  mage: ["Orin", "Selene", "Caio", "Mirela", "Zefir", "Alba"],
};

/** Nome inicial sugerido na criação do herói (o jogador pode trocar). */
export function suggestHeroName(classId: ClassId, random: () => number = Math.random): string {
  const list = NAME_IDEAS[classId];
  return list[Math.floor(random() * list.length) % list.length] ?? CLASSES[classId].name;
}
