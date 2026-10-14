/** Captura teclado e mouse e expõe um estado simples lido a cada frame. */
export class Input {
  private keys = new Set<string>();
  lookDeltaX = 0;
  lookDeltaY = 0;
  zoomDelta = 0;
  attackQueued = false;
  pointerLocked = false;
  onFirstInteraction: (() => void) | null = null;
  /** Chamado quando o pointer lock é perdido (ESC) ou obtido. */
  onPointerLockChange: ((locked: boolean) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Space") {
        this.attackQueued = true;
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
        this.onFirstInteraction?.();
        this.onFirstInteraction = null;
        return;
      }
      this.attackQueued = true;
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked) this.keys.clear();
      this.onPointerLockChange?.(this.pointerLocked);
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.lookDeltaX += e.movementX;
      this.lookDeltaY += e.movementY;
    });
    window.addEventListener("wheel", (e) => {
      this.zoomDelta += Math.sign(e.deltaY);
    }, { passive: true });
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Eixos de movimento brutos: x (-1 esquerda, +1 direita), z (-1 frente, +1 trás). */
  moveAxes(): { x: number; z: number } {
    const x = (this.isDown("KeyD") || this.isDown("ArrowRight") ? 1 : 0) - (this.isDown("KeyA") || this.isDown("ArrowLeft") ? 1 : 0);
    const z = (this.isDown("KeyS") || this.isDown("ArrowDown") ? 1 : 0) - (this.isDown("KeyW") || this.isDown("ArrowUp") ? 1 : 0);
    return { x, z };
  }

  get running(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  /** Consome os acumuladores de frame. */
  flush(): { lookX: number; lookY: number; zoom: number; attack: boolean } {
    const out = { lookX: this.lookDeltaX, lookY: this.lookDeltaY, zoom: this.zoomDelta, attack: this.attackQueued };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.zoomDelta = 0;
    this.attackQueued = false;
    return out;
  }
}
