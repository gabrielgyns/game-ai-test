import type { Vec3 } from "./math";
import type { Entity } from "./components";
import type { World } from "./world";
import { terrainHeight } from "./terrain";

/**
 * O mundo em zonas, como os mapas do Ragnarok: cada zona é uma região quadrada própria (terreno,
 * biomas, população, chefe, quests), e as zonas se ligam por portões na borda. Todas vivem no mesmo
 * `World`, cada uma num pedaço distante do plano, como a cripta; a apresentação desenha só a zona onde
 * o herói está. O save não precisa saber de zona: a posição do herói já diz onde ele está.
 */
export type ZoneId = "vale" | "floresta";

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  /** Centro da região no plano do mundo. */
  center: { x: number; z: number };
  /** Metade do lado do quadrado (a zona vai de center - half a center + half). */
  half: number;
  /** Faixa de nível dos inimigos (na dificuldade Aventureiro). */
  levels: [number, number];
  /** Onde se renasce ao cair nesta zona. */
  respawn: { x: number; z: number };
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  vale: { id: "vale", name: "Vale das Gosmas", center: { x: 0, z: 0 }, half: 110, levels: [1, 12], respawn: { x: 0, z: 0 } },
  floresta: { id: "floresta", name: "Floresta Ancestral", center: { x: 0, z: -420 }, half: 110, levels: [12, 20], respawn: { x: 0, z: -420 + 84 } },
};

/** Zona que contém o ponto (o vale, se estiver fora de todas: fallback seguro). */
export function zoneAt(x: number, z: number): ZoneDefinition {
  for (const zone of Object.values(ZONES)) {
    if (Math.abs(x - zone.center.x) <= zone.half + 4 && Math.abs(z - zone.center.z) <= zone.half + 4) return zone;
  }
  return ZONES.vale;
}

/** Coordenadas locais da zona (o centro dela vira 0, 0). */
export function toLocal(zone: ZoneDefinition, x: number, z: number): { x: number; z: number } {
  return { x: x - zone.center.x, z: z - zone.center.z };
}

/** Portão de viagem: fica num ponto de uma zona e leva a um ponto de outra. */
export interface ZoneGate {
  id: string;
  from: ZoneId;
  to: ZoneId;
  at: { x: number; z: number };
  /** Onde o herói chega na zona de destino (um pouco à frente do portão de volta). */
  arrive: { x: number; z: number };
  /** Para onde o portão "olha" (rotação do arco). */
  yaw: number;
}

export const GATE_RANGE = 2.8;

export const ZONE_GATES: ZoneGate[] = [
  { id: "vale-floresta", from: "vale", to: "floresta", at: { x: 22, z: -98 }, arrive: { x: 0, z: -420 + 92 }, yaw: 0 },
  { id: "floresta-vale", from: "floresta", to: "vale", at: { x: 0, z: -420 + 98 }, arrive: { x: 22, z: -93 }, yaw: Math.PI },
];

export function gateNear(p: { x: number; z: number }): ZoneGate | undefined {
  return ZONE_GATES.find((g) => Math.hypot(p.x - g.at.x, p.z - g.at.z) <= GATE_RANGE);
}

/** Ponto de chegada do portão, como posição (a altura vem do terreno, quem chama ajusta). */
export function arrivalOf(gate: ZoneGate): Vec3 {
  return { x: gate.arrive.x, y: 0, z: gate.arrive.z };
}

/** Viaja pelo portão perto do herói. Devolve o portão usado (ou undefined, se não houver). */
export function travel(world: World, player: Entity): ZoneGate | undefined {
  const gate = gateNear(player.transform.position);
  if (!gate || world.dungeon) return undefined;
  const to = arrivalOf(gate);
  player.transform.position = { x: to.x, y: terrainHeight(to.x, to.z), z: to.z };
  player.transform.yaw = gate.yaw + Math.PI;
  world.emit({ type: "zoneTravel", from: gate.from, to: gate.to });
  return gate;
}
