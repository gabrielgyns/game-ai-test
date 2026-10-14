import type { Entity } from "../domain/components";
import { countItems } from "../domain/inventory";
import { isAlive } from "../domain/components";
import type { World } from "../domain/world";
import { entityLevel, levelDifficulty, type LevelDifficulty } from "../domain/levels";
import { DIFFICULTY_COLOR } from "./levelBadge";
import { zoneAt } from "../domain/zones";
import { DUNGEON_REGION_X } from "../domain/terrain";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

/** Interface em HTML sobre o canvas. Só lê o domínio, nunca o altera. */
export class Hud {
  private readonly level = el("hud-level");
  private readonly name = el("hud-name");
  private readonly hpFill = el("hud-hp-fill");
  private readonly hpText = el("hud-hp-text");
  private readonly xpFill = el("hud-xp-fill");
  private readonly gold = el("hud-gold");
  private readonly kills = el("hud-kills");
  private readonly potions = el("hud-potions");
  private readonly bag = el("hud-bag");
  private readonly target = el("target");
  private readonly bossBar = el("bossbar");
  private readonly bossName = el("boss-name");
  private readonly bossPhase = el("boss-phase");
  private readonly bossFill = el("boss-hp-fill");
  private readonly bossText = el("boss-hp-text");
  private readonly targetName = el("target-name");
  private readonly targetLevel = el("target-level");
  private readonly bossLevel = el("boss-level");
  private readonly targetHpFill = el("target-hp-fill");
  private readonly targetHpText = el("target-hp-text");
  private readonly log = el("log");
  private readonly overlay = el("overlay");
  private readonly death = el("death");
  private readonly deathTimer = el("death-timer");

  private readonly dungeonEl = el("dungeon-hud");
  private dungeonText = "";

  /** Painel da cripta: nome, nível, salas limpas e vidas. */
  updateDungeon(d: { name: string; level: number; floor: number; floors: number; cleared: number; total: number; lives: number; maxLives: number; boss: boolean } | null): void {
    const text = d
      ? `<b>${d.name}</b> · nível ${d.level} · andar ${d.floor}/${d.floors}<br>Salas ${d.cleared}/${d.total}${d.boss ? " · Lorde vencido!" : ""} · ${"♥".repeat(d.lives)}<span class="lost">${"♥".repeat(d.maxLives - d.lives)}</span>`
      : "";
    if (text === this.dungeonText) return;
    this.dungeonText = text;
    this.dungeonEl.innerHTML = text;
    this.dungeonEl.classList.toggle("hidden", !d);
  }

  private readonly clock = el("hud-clock");
  private readonly areaLabel = el("area-label");
  private clockText = "";

  /** Relógio do mundo no painel de status, com sol ou lua. */
  setClock(text: string, night: boolean): void {
    const full = `${night ? "☾" : "☀"} ${text}`;
    if (full === this.clockText) return;
    this.clockText = full;
    this.clock.textContent = full;
  }

  hideIntro(): void {
    this.overlay.classList.add("hidden");
  }

  pushLog(text: string, cls: string): void {
    const line = document.createElement("div");
    line.className = cls;
    line.textContent = text;
    this.log.appendChild(line);
    while (this.log.childElementCount > 7) this.log.firstElementChild?.remove();
    setTimeout(() => line.remove(), 6000);
  }

  /** Barra grande do chefe engajado; esconde o painel de alvo comum enquanto aparece. */
  updateBoss(world: World): void {
    let boss: Entity | undefined;
    for (const e of world.enemies()) {
      if (e.boss?.engaged && isAlive(e)) {
        boss = e;
        break;
      }
    }
    this.bossBar.classList.toggle("hidden", !boss);
    if (!boss) return;
    this.target.classList.add("hidden");
    this.bossName.textContent = boss.boss!.title;
    if (world.player) showLevel(this.bossLevel, world.player, boss);
    const phases = boss.boss!.phaseThresholds.length + 1;
    this.bossPhase.textContent = `Fase ${boss.boss!.phase} / ${phases}`;
    this.bossFill.style.width = `${(boss.health.current / boss.health.max) * 100}%`;
    this.bossText.textContent = `${Math.ceil(boss.health.current)} / ${boss.health.max}`;
    // Carapaça: camadas restantes, ou o tempo de atordoamento depois de partida.
    const shell = boss.boss!.carapace;
    const showShell = !!shell && (shell.active || shell.stunLeft > 0);
    this.bossShell.classList.toggle("hidden", !showShell);
    if (shell && showShell) {
      this.bossShell.classList.toggle("stunned", !shell.active);
      this.bossShell.textContent = shell.active
        ? `Carapaça de Areia ${"◆".repeat(shell.layers)}${"◇".repeat(shell.maxLayers - shell.layers)} · só habilidades a quebram`
        : `ATORDOADO ${shell.stunLeft.toFixed(1)}s · dano +50%`;
    }
  }
  private readonly bossShell = el("boss-carapace");

  update(player: Entity, target: Entity | undefined): void {
    const prog = player.progression;
    if (this.name.textContent !== player.name) this.name.textContent = player.name;
    this.level.textContent = `Nível ${prog?.level ?? 1}`;
    const { x, z } = player.transform.position;
    const area = x >= DUNGEON_REGION_X ? "" : zoneAt(x, z).name;
    if (this.areaLabel.textContent !== area) this.areaLabel.textContent = area;
    const hp = Math.ceil(player.health.current);
    this.hpFill.style.width = `${(player.health.current / player.health.max) * 100}%`;
    this.hpText.textContent = `${hp} / ${player.health.max}`;
    if (prog) this.xpFill.style.width = `${(prog.xp / prog.xpToNext) * 100}%`;
    this.gold.textContent = `${player.wallet?.gold ?? 0} ouro`;
    this.kills.textContent = `${player.stats?.kills ?? 0} abates`;
    const inv = player.inventory;
    if (inv) {
      this.potions.textContent = `${countItems(inv, (i) => i.kind === "consumable")}`;
      this.bag.textContent = `${inv.items.filter((i) => i !== null).length}/${inv.capacity}`;
    }

    if (target) {
      this.target.classList.remove("hidden");
      this.targetName.textContent = target.name;
      showLevel(this.targetLevel, player, target);
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

/** "Nv 7" ao lado do nome, na cor da dificuldade para o herói. */
function showLevel(node: HTMLElement, hero: Entity, mob: Entity): void {
  const level = entityLevel(mob);
  const difficulty = levelDifficulty(entityLevel(hero), level);
  node.textContent = `Nv ${level}`;
  node.style.color = DIFFICULTY_COLOR[difficulty];
  node.style.borderColor = DIFFICULTY_COLOR[difficulty];
  node.title = DIFFICULTY_LABEL[difficulty];
}

const DIFFICULTY_LABEL: Record<LevelDifficulty, string> = {
  trivial: "Bem abaixo do seu nível",
  easy: "Fácil",
  even: "No seu nível",
  hard: "Difícil",
  deadly: "Perigoso",
};
