import type { Entity } from "../domain/components";
import { canTeleport, knownVillages, teleportFee, VILLAGE_LIST, type TeleportResult, type VillageId } from "../domain/villages";
import { ZONES } from "../domain/zones";
import type { World } from "../domain/world";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const FAIL: Record<Exclude<TeleportResult, "ok">, string> = {
  unknown: "Essa pedra ainda não foi ativada. Vá até a vila uma vez.",
  same: "Você já está nesta vila.",
  noGold: "Ouro insuficiente para a viagem.",
  inDungeon: "As pedras não alcançam a cripta.",
};

/**
 * Painel da Pedra de Teleporte: a lista de vilas, com as já ativadas liberadas e o preço da viagem.
 * A regra fica em `domain/villages.ts`; aqui só desenha e repassa a escolha.
 */
export class WaystoneUI {
  private readonly root = el("waystone");
  private readonly list = el("waystone-list");
  private readonly fee = el("waystone-fee");
  /** A vila escolhida (já conferida com `canTeleport`). */
  onTravel: (to: VillageId) => void = () => {};
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};

  constructor(private readonly world: World, private readonly player: Entity) {
    el("waystone-close").addEventListener("click", () => this.onClose());
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  open(): void {
    this.render();
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  render(): void {
    const known = knownVillages(this.player);
    const fee = teleportFee(this.player);
    this.fee.textContent = `Viagem: ${fee} ouro · você tem ${this.player.wallet?.gold ?? 0}`;
    this.list.replaceChildren(
      ...VILLAGE_LIST.map((v) => {
        const zone = ZONES[v.zone];
        const check = canTeleport(this.world, this.player, v.id);
        const row = document.createElement("div");
        const locked = !known.includes(v.id);
        row.className = `village${locked ? " locked" : ""}${check === "same" ? " current" : ""}`;
        const info = document.createElement("div");
        info.className = "info";
        info.innerHTML = `<div class="vname">${locked ? "🔒 " : ""}${v.name}</div><div class="vdesc">${zone.name} · inimigos nível ${zone.levels[0]} a ${zone.levels[1]}${locked ? " · visite a vila para ativar a pedra" : ""}</div>`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = check === "same" ? "Você está aqui" : locked ? "Desconhecida" : "Viajar";
        btn.disabled = check === "same" || locked;
        btn.addEventListener("click", () => {
          const r = canTeleport(this.world, this.player, v.id);
          if (r === "ok") this.onTravel(v.id);
          else this.onMessage(FAIL[r]);
        });
        row.append(info, btn);
        return row;
      }),
    );
  }
}
