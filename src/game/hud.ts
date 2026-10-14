import type { Entity } from "../domain/components";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/** Interface em HTML sobre o canvas. Só lê o domínio, nunca o altera. */
export class Hud {
  private readonly level = el("hud-level");
  private readonly hpFill = el("hud-hp-fill");
  private readonly hpText = el("hud-hp-text");
  private readonly xpFill = el("hud-xp-fill");
  private readonly gold = el("hud-gold");
  private readonly kills = el("hud-kills");
  private readonly target = el("target");
  private readonly targetName = el("target-name");
  private readonly targetHpFill = el("target-hp-fill");
  private readonly targetHpText = el("target-hp-text");
  private readonly log = el("log");
  private readonly overlay = el("overlay");
  private readonly death = el("death");
  private readonly deathTimer = el("death-timer");
  private killCount = 0;

  hideIntro(): void {
    this.overlay.classList.add("hidden");
  }

  addKill(): void {
    this.killCount += 1;
  }

  pushLog(text: string, cls: string): void {
    const line = document.createElement("div");
    line.className = cls;
    line.textContent = text;
    this.log.appendChild(line);
    while (this.log.childElementCount > 7) this.log.firstElementChild?.remove();
    setTimeout(() => line.remove(), 6000);
  }

  update(player: Entity, target: Entity | undefined): void {
    const prog = player.progression;
    this.level.textContent = `Nível ${prog?.level ?? 1}`;
    const hp = Math.ceil(player.health.current);
    this.hpFill.style.width = `${(player.health.current / player.health.max) * 100}%`;
    this.hpText.textContent = `${hp} / ${player.health.max}`;
    if (prog) this.xpFill.style.width = `${(prog.xp / prog.xpToNext) * 100}%`;
    this.gold.textContent = `${player.wallet?.gold ?? 0} ouro`;
    this.kills.textContent = `${this.killCount} abates`;

    if (target) {
      this.target.classList.remove("hidden");
      this.targetName.textContent = target.name;
      this.targetHpFill.style.width = `${(target.health.current / target.health.max) * 100}%`;
      this.targetHpText.textContent = `${Math.ceil(target.health.current)} / ${target.health.max}`;
    } else {
      this.target.classList.add("hidden");
    }

    if (player.respawn) {
      this.death.classList.remove("hidden");
      this.deathTimer.textContent = Math.ceil(player.respawn.timeLeft).toString();
    } else {
      this.death.classList.add("hidden");
    }
  }
}
