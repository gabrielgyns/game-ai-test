import { isAlive, type Entity, type EntityId } from "./components";
import { DUNGEON_ENTRANCE } from "./dungeon";
import { ALTAR_SPOT, STASH_SPOT } from "./sanctuary";
import { questsForNpc } from "./quests";
import { DUNGEON_REGION_X } from "./terrain";
import type { World } from "./world";

/**
 * O que aparece no mapa. O domínio decide *o que* marcar (e com que significado); a apresentação só
 * escolhe o desenho. Assim o mapa nunca mostra algo que as regras não reconhecem, e dá para testar.
 */
export type MarkerKind =
  | "enemy"
  | "boss"
  | "npc"
  /** NPC com quest nova (!) ou para entregar (?). */
  | "questOffer"
  | "questTurnIn"
  | "portal"
  /** Baú compartilhado e Altar das Eras, no santuário. */
  | "stash"
  | "altar"
  | "chest"
  | "exit"
  /** Item raro ou épico no chão. */
  | "loot";

export interface MapMarker {
  kind: MarkerKind;
  x: number;
  z: number;
  id?: EntityId;
  label?: string;
}

/** O mapa só mostra o "lugar" onde o herói está: o vale ou a cripta (que fica longe, em x ≥ 1000). */
const sameSpace = (a: number, b: number) => (a >= DUNGEON_REGION_X) === (b >= DUNGEON_REGION_X);

export function mapMarkers(world: World, player: Entity): MapMarker[] {
  const out: MapMarker[] = [];
  const px = player.transform.position.x;
  const here = (x: number) => sameSpace(x, px);

  for (const e of world.enemies()) {
    const { x, z } = e.transform.position;
    if (!isAlive(e) || !here(x)) continue;
    out.push({ kind: e.boss ? "boss" : "enemy", x, z, id: e.id, label: e.boss ? e.boss.title : e.name });
  }
  for (const n of world.npcs()) {
    const { x, z } = n.transform.position;
    if (!here(x) || !n.npc) continue;
    const q = player.quests ? questsForNpc(player.quests, n.npc.id) : { offer: [], turnIn: [] };
    const kind: MarkerKind = q.turnIn.length ? "questTurnIn" : q.offer.length ? "questOffer" : "npc";
    out.push({ kind, x, z, id: n.id, label: n.name });
  }
  for (const d of world.drops.values()) {
    if ((d.item.rarity === "rare" || d.item.rarity === "epic") && here(d.position.x)) out.push({ kind: "loot", x: d.position.x, z: d.position.z, label: d.item.name });
  }

  const run = world.dungeon;
  if (here(DUNGEON_ENTRANCE.x)) {
    out.push({ kind: "portal", x: DUNGEON_ENTRANCE.x, z: DUNGEON_ENTRANCE.z, label: "Cripta Esquecida" });
    out.push({ kind: "stash", x: STASH_SPOT.x, z: STASH_SPOT.z, label: "Baú" });
    out.push({ kind: "altar", x: ALTAR_SPOT.x, z: ALTAR_SPOT.z, label: "Altar das Eras" });
  }
  if (run && here(run.startPortal.x)) {
    out.push({ kind: "exit", x: run.startPortal.x, z: run.startPortal.z, label: "Saída" });
    if (run.exitPortal) out.push({ kind: "exit", x: run.exitPortal.x, z: run.exitPortal.z, label: "Saída" });
    if (run.chest && !run.chest.opened) out.push({ kind: "chest", x: run.chest.position.x, z: run.chest.position.z, label: "Baú" });
  }
  return out;
}
