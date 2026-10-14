import { isAlive, type Entity, type EntityId } from "./components";
import { DUNGEON_ENTRANCE } from "./dungeon";
import { VILLAGE_LIST } from "./villages";
import { questsForNpc } from "./quests";
import { DUNGEON_REGION_X } from "./terrain";
import { ZONE_PASSAGES, ZONES, zoneAt } from "./zones";
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
  /** Baú compartilhado e Pedra de Teleporte, nas vilas. */
  | "stash"
  | "waystone"
  /** Na cripta: escada para o próximo andar e santuário ainda não usado. */
  | "stairs"
  | "shrine"
  /** Passagem para outra zona, na borda do mapa. */
  | "gate"
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

/** O mapa só mostra o "lugar" onde o herói está: a zona (vale, floresta) ou a cripta. */
const placeOf = (x: number, z: number) => (x >= DUNGEON_REGION_X ? "cripta" : zoneAt(x, z).id);

export function mapMarkers(world: World, player: Entity): MapMarker[] {
  const out: MapMarker[] = [];
  const place = placeOf(player.transform.position.x, player.transform.position.z);
  const at = (x: number, z: number) => placeOf(x, z) === place;

  for (const e of world.enemies()) {
    const { x, z } = e.transform.position;
    if (!isAlive(e) || !at(x, z)) continue;
    out.push({ kind: e.boss ? "boss" : "enemy", x, z, id: e.id, label: e.boss ? e.boss.title : e.name });
  }
  for (const n of world.npcs()) {
    const { x, z } = n.transform.position;
    if (!at(x, z) || !n.npc) continue;
    const q = player.quests ? questsForNpc(player.quests, n.npc.id) : { offer: [], turnIn: [] };
    const kind: MarkerKind = q.turnIn.length ? "questTurnIn" : q.offer.length ? "questOffer" : "npc";
    out.push({ kind, x, z, id: n.id, label: n.name });
  }
  for (const d of world.drops.values()) {
    if ((d.item.rarity === "rare" || d.item.rarity === "epic") && at(d.position.x, d.position.z)) out.push({ kind: "loot", x: d.position.x, z: d.position.z, label: d.item.name });
  }

  for (const g of ZONE_PASSAGES) if (at(g.at.x, g.at.z)) out.push({ kind: "gate", x: g.at.x, z: g.at.z, label: ZONES[g.to].name });
  for (const v of VILLAGE_LIST) {
    if (!at(v.stone.x, v.stone.z)) continue;
    out.push({ kind: "stash", x: v.stash.x, z: v.stash.z, label: "Baú" });
    out.push({ kind: "waystone", x: v.stone.x, z: v.stone.z, label: "Pedra de Teleporte" });
  }
  const run = world.dungeon;
  if (at(DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z)) {
    out.push({ kind: "portal", x: DUNGEON_ENTRANCE.x, z: DUNGEON_ENTRANCE.z, label: "Cripta Esquecida" });
  }
  if (run && place === "cripta") {
    // A saída da entrada só existe no primeiro andar; no último, o portal aparece depois do chefe.
    if (run.floor === 1) out.push({ kind: "exit", x: run.startPortal.x, z: run.startPortal.z, label: "Saída" });
    if (run.exitPortal) out.push({ kind: "exit", x: run.exitPortal.x, z: run.exitPortal.z, label: "Saída" });
    if (run.chest && !run.chest.opened) out.push({ kind: "chest", x: run.chest.position.x, z: run.chest.position.z, label: "Baú" });
    for (const c of run.sideChests) if (!c.opened) out.push({ kind: "chest", x: c.position.x, z: c.position.z, label: "Tesouro" });
    for (const s of run.shrines) if (!s.used) out.push({ kind: "shrine", x: s.position.x, z: s.position.z, label: "Santuário" });
    if (run.stairs) out.push({ kind: "stairs", x: run.stairs.x, z: run.stairs.z, label: run.stairsOpen ? "Escada" : "Escada (selada)" });
  }
  return out;
}
