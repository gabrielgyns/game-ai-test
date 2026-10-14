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
    el("menu-restart").addEventListener("click", () => window.location.reload());
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

  close(): void {
    this.root.classList.add("hidden");
  }
}
