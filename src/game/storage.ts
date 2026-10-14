import { isSaveData, type SaveData } from "../domain/save";
import { heroNameOf, isValidSlot, SaveSlots, type KeyValueStore } from "../domain/saveSlots";
import { isClassId, type ClassId } from "../domain/classes";

/** localStorage como porta do domínio; se o navegador bloquear, vira um armazenamento só da sessão. */
function browserStore(): KeyValueStore {
  try {
    const probe = "vale.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

export const saveSlots = new SaveSlots(browserStore());

/**
 * Pedido de "novo jogo" num slot, guardado na sessão enquanto a página recarrega com a classe
 * escolhida. Só some quando o jogo começa de fato (o primeiro save ocupa o slot).
 */
export interface NewGameIntent {
  slot: number;
  classId: ClassId;
  heroName: string;
}

const NEW_GAME_KEY = "vale.newGame";

export function readNewGameIntent(): NewGameIntent | null {
  try {
    const raw = sessionStorage.getItem(NEW_GAME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<NewGameIntent>;
    if (!isValidSlot(v.slot) || !isClassId(v.classId) || typeof v.heroName !== "string") return null;
    return { slot: v.slot, classId: v.classId, heroName: v.heroName };
  } catch {
    return null;
  }
}

export function writeNewGameIntent(intent: NewGameIntent | null): void {
  try {
    if (intent) sessionStorage.setItem(NEW_GAME_KEY, JSON.stringify(intent));
    else sessionStorage.removeItem(NEW_GAME_KEY);
  } catch {
    /* ignora */
  }
}

/** Baixa o save como arquivo .json. */
export function exportSave(save: SaveData): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date(save.savedAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const name = heroNameOf(save).normalize("NFD").replace(/[^\w-]+/g, "").toLowerCase() || "heroi";
  a.href = url;
  a.download = `vale-das-gosmas-${name}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre o seletor de arquivo e devolve o save válido escolhido (ou null). */
export function importSave(): Promise<SaveData | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const parsed: unknown = JSON.parse(await file.text());
        resolve(isSaveData(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    });
    input.click();
  });
}
