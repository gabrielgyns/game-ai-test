function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const SENS_KEY = "vale.sensibilidade";

/** Menu de pausa (ESC). Abre sempre que o pointer lock é perdido depois do jogo começar. */
export class PauseMenu {
  private readonly root = el("menu");
  private readonly sens = el<HTMLInputElement>("menu-sens");
  private readonly sensValue = el("menu-sens-value");
  sensitivity = 1;
  onResume: () => void = () => {};
  onSave: () => void = () => {};
  onExport: () => void = () => {};
  onImport: () => void = () => {};
  onNewGame: () => void = () => {};
  onVolume: (music: number, sfx: number) => void = () => {};
  private readonly music = el<HTMLInputElement>("menu-music");
  private readonly sfx = el<HTMLInputElement>("menu-sfx");
  private readonly saveInfo = el("menu-save-info");

  constructor() {
    try {
      const saved = Number(localStorage.getItem(SENS_KEY));
      if (saved > 0) this.sensitivity = saved;
    } catch {
      /* armazenamento indisponível: usa o padrão */
    }
    this.sens.value = String(this.sensitivity);
    this.sensValue.textContent = this.sensitivity.toFixed(1);

    el("menu-resume").addEventListener("click", () => this.onResume());
    const volumeChanged = () => {
      el("menu-music-value").textContent = `${Math.round(Number(this.music.value) * 100)}%`;
      el("menu-sfx-value").textContent = `${Math.round(Number(this.sfx.value) * 100)}%`;
      this.onVolume(Number(this.music.value), Number(this.sfx.value));
    };
    this.music.addEventListener("input", volumeChanged);
    this.sfx.addEventListener("input", volumeChanged);
    el("menu-save").addEventListener("click", () => this.onSave());
    el("menu-export").addEventListener("click", () => this.onExport());
    el("menu-import").addEventListener("click", () => this.onImport());
    el("menu-restart").addEventListener("click", () => this.onNewGame());
    this.sens.addEventListener("input", () => {
      this.sensitivity = Number(this.sens.value);
      this.sensValue.textContent = this.sensitivity.toFixed(1);
      try {
        localStorage.setItem(SENS_KEY, String(this.sensitivity));
      } catch {
        /* ignora */
      }
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(): void {
    this.root.classList.remove("hidden");
  }

  setVolumes(music: number, sfx: number): void {
    this.music.value = String(music);
    this.sfx.value = String(sfx);
    el("menu-music-value").textContent = `${Math.round(music * 100)}%`;
    el("menu-sfx-value").textContent = `${Math.round(sfx * 100)}%`;
  }

  setSaveInfo(text: string): void {
    this.saveInfo.textContent = text;
  }

  close(): void {
    this.root.classList.add("hidden");
  }
}
