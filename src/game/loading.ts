/**
 * Tela de carregamento entre áreas, como no Ragnarok: escurece, mostra o nome da área e a faixa de
 * nível, e some quando a área está montada. Só desenha: quem chama decide o que fazer no escuro.
 */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export class LoadingScreen {
  private readonly root = document.getElementById("loading")!;
  private readonly title = document.getElementById("loading-name")!;
  private readonly subtitle = document.getElementById("loading-sub")!;
  private readonly detail = document.getElementById("loading-detail")!;
  private readonly bar = document.getElementById("loading-bar")!;
  busy = false;

  /**
   * Escurece, roda `work` (que pode ser assíncrono e reportar o progresso de 0 a 1) e clareia.
   * Fica ao menos `minMs` na tela, para dar tempo de ler o nome da área; `beforeReveal` roda logo
   * antes de clarear (para o jogo voltar a andar e o primeiro quadro visível já ser o da área nova).
   */
  async run(
    card: { title: string; subtitle: string; detail?: string },
    work: (progress: (p: number) => void) => Promise<void> | void,
    beforeReveal: () => void = () => {},
    minMs = 1100,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.title.textContent = card.title;
    this.subtitle.textContent = card.subtitle;
    this.detail.textContent = card.detail ?? "";
    this.bar.style.width = "0%";
    this.root.classList.remove("hidden");
    await nextFrame();
    this.root.classList.add("shown");
    const start = performance.now();
    await wait(320); // fim do fade
    await work((p) => (this.bar.style.width = `${Math.round(Math.min(1, p) * 100)}%`));
    this.bar.style.width = "100%";
    await wait(Math.max(0, minMs - (performance.now() - start)));
    beforeReveal();
    await nextFrame();
    this.root.classList.remove("shown");
    await wait(380);
    this.root.classList.add("hidden");
    this.busy = false;
  }
}
