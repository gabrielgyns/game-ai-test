import { isSaveData, type SaveData } from "../domain/save";

const KEY = "vale.save";

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSaveData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
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
  a.href = url;
  a.download = `vale-das-gosmas-${stamp}.json`;
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
