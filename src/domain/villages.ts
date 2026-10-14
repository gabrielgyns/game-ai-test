import type { Entity } from "./components";
import { distanceXZ } from "./math";
import { FOREST_CAMP, PEAKS_VILLAGE, terrainHeight, VOLCANO_FORT } from "./terrain";
import type { World } from "./world";
import { ZONES, zoneAt, type ZoneId } from "./zones";

/**
 * Vilas: o ponto seguro de cada região, como as cidades do Ragnarok. Cada uma tem baú (o mesmo baú
 * compartilhado em todas), quem venda e quem dê quests, e uma Pedra de Teleporte, que faz o papel da
 * Kafra: passar perto dela pela primeira vez a ativa, e de qualquer pedra ativada dá para ir, por um
 * pouco de ouro, a outra vila já visitada.
 */
export type VillageId = "santuario" | "acampamento" | "pedraFria" | "bastiao";

export interface Village {
  id: VillageId;
  name: string;
  zone: ZoneId;
  /** Pedra de Teleporte. */
  stone: { x: number; z: number };
  /** Baú compartilhado. */
  stash: { x: number; z: number };
  /** Onde se chega ao teleportar (ao lado da pedra). */
  arrive: { x: number; z: number };
}

const forest = (lx: number, lz: number) => ({ x: ZONES.floresta.center.x + lx, z: ZONES.floresta.center.z + lz });
const peaks = (lx: number, lz: number) => ({ x: ZONES.picos.center.x + lx, z: ZONES.picos.center.z + lz });
const volcano = (lx: number, lz: number) => ({ x: ZONES.vulcao.center.x + lx, z: ZONES.vulcao.center.z + lz });

export const VILLAGES: Record<VillageId, Village> = {
  santuario: { id: "santuario", name: "Santuário do Vale", zone: "vale", stone: { x: 0, z: -6.2 }, stash: { x: -5.5, z: 3.5 }, arrive: { x: 0, z: -3.4 } },
  acampamento: {
    id: "acampamento",
    name: "Acampamento da Guardiã",
    zone: "floresta",
    stone: forest(FOREST_CAMP.x, FOREST_CAMP.z - 9),
    stash: forest(FOREST_CAMP.x - 6, FOREST_CAMP.z - 6),
    arrive: forest(FOREST_CAMP.x, FOREST_CAMP.z - 6),
  },
  pedraFria: {
    id: "pedraFria",
    name: "Vila de Pedra-Fria",
    zone: "picos",
    stone: peaks(PEAKS_VILLAGE.x, PEAKS_VILLAGE.z - 9),
    stash: peaks(PEAKS_VILLAGE.x - 6, PEAKS_VILLAGE.z - 6),
    arrive: peaks(PEAKS_VILLAGE.x, PEAKS_VILLAGE.z - 5.5),
  },
  bastiao: {
    id: "bastiao",
    name: "Bastião de Brasa",
    zone: "vulcao",
    stone: volcano(VOLCANO_FORT.x, VOLCANO_FORT.z - 9),
    stash: volcano(VOLCANO_FORT.x - 6, VOLCANO_FORT.z - 6),
    arrive: volcano(VOLCANO_FORT.x, VOLCANO_FORT.z - 5.5),
  },
};

export const VILLAGE_LIST = Object.values(VILLAGES);
/** Alcance para usar a pedra ou o baú. */
export const VILLAGE_RANGE = 2.4;
/** A pedra se ativa quando o herói chega a esta distância dela. */
export const ATTUNE_RANGE = 9;

/** Preço de uma viagem: pouco, mas cresce com o nível (o ouro dos inimigos também cresce). */
export function teleportFee(player: Entity): number {
  return 20 + 3 * (player.progression?.level ?? 1);
}

export function knownVillages(player: Entity): VillageId[] {
  return player.villages ?? ["santuario"];
}

export function villageOfZone(zone: ZoneId): Village | undefined {
  return VILLAGE_LIST.find((v) => v.zone === zone);
}

export type VillageSpot = { village: Village; spot: "stone" | "stash" };

/** O que o herói pode usar ali: a pedra ou o baú de uma vila (ou nada). */
export function villageInteraction(player: Entity): VillageSpot | null {
  const p = player.transform.position;
  for (const village of VILLAGE_LIST) {
    if (distanceXZ(p, { x: village.stone.x, y: 0, z: village.stone.z }) < VILLAGE_RANGE) return { village, spot: "stone" };
    if (distanceXZ(p, { x: village.stash.x, y: 0, z: village.stash.z }) < VILLAGE_RANGE) return { village, spot: "stash" };
  }
  return null;
}

/** Ativa a pedra de uma vila perto do herói, na primeira visita. Chamado a cada passo do mundo. */
export function villageSystem(world: World): void {
  const player = world.player;
  if (!player || world.dungeon) return;
  const p = player.transform.position;
  const village = villageOfZone(zoneAt(p.x, p.z).id);
  if (!village || distanceXZ(p, { x: village.stone.x, y: 0, z: village.stone.z }) > ATTUNE_RANGE) return;
  const known = (player.villages ??= ["santuario"]);
  if (known.includes(village.id)) return;
  known.push(village.id);
  world.emit({ type: "villageAttuned", village: village.id });
}

export type TeleportResult = "ok" | "unknown" | "same" | "noGold" | "inDungeon";

/** Se dá para viajar agora (sem mudar nada): a apresentação pergunta antes de escurecer a tela. */
export function canTeleport(world: World, player: Entity, to: VillageId): TeleportResult {
  if (world.dungeon) return "inDungeon";
  if (!knownVillages(player).includes(to)) return "unknown";
  const p = player.transform.position;
  const target = VILLAGES[to];
  if (zoneAt(p.x, p.z).id === target.zone && distanceXZ(p, { x: target.stone.x, y: 0, z: target.stone.z }) < 20) return "same";
  if (!player.wallet || player.wallet.gold < teleportFee(player)) return "noGold";
  return "ok";
}

/** Viaja pela pedra para outra vila já ativada, pagando a taxa. */
export function teleport(world: World, player: Entity, to: VillageId): TeleportResult {
  const check = canTeleport(world, player, to);
  if (check !== "ok") return check;
  const p = player.transform.position;
  const from = zoneAt(p.x, p.z).id;
  const target = VILLAGES[to];
  const fee = teleportFee(player);
  player.wallet!.gold -= fee;
  player.transform.position = { x: target.arrive.x, y: terrainHeight(target.arrive.x, target.arrive.z), z: target.arrive.z };
  player.movement.intent = { x: 0, z: 0 };
  world.emit({ type: "teleport", village: to, gold: fee });
  if (from !== target.zone) world.emit({ type: "zoneTravel", from, to: target.zone });
  return "ok";
}
