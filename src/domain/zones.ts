import type { Entity } from "./components";
import type { World } from "./world";
import { terrainHeight } from "./terrain";

/**
 * O mundo em zonas, como os mapas do Ragnarok: cada zona é uma região quadrada própria (terreno,
 * biomas, população, chefe, quests), e as zonas se ligam por passagens na borda. Todas vivem no mesmo
 * `World`, cada uma num pedaço distante do plano, como a cripta; a apresentação desenha só a zona onde
 * o herói está. O save não precisa saber de zona: a posição do herói já diz onde ele está.
 */
export type ZoneId = "vale" | "floresta" | "picos";

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  /** Centro da região no plano do mundo. */
  center: { x: number; z: number };
  /** Metade do lado do quadrado (a zona vai de center - half a center + half). */
  half: number;
  /** Faixa de nível dos inimigos (aparece na tela de carregamento). */
  levels: [number, number];
  /** Uma linha sobre a zona, para a tela de carregamento. */
  subtitle: string;
  /** Onde se renasce ao cair nesta zona. */
  respawn: { x: number; z: number };
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  vale: { id: "vale", name: "Vale das Gosmas", center: { x: 0, z: 0 }, half: 110, levels: [1, 12], subtitle: "Gosmas, goblins e orcs; o pântano a oeste, o deserto a leste e três chefes.", respawn: { x: 0, z: 0 } },
  picos: {
    id: "picos",
    name: "Picos Gelados",
    center: { x: 0, z: -840 },
    half: 110,
    levels: [20, 28],
    subtitle: "Lobos das neves, yetis e espectros no gelo; a Caverna de Gelo na encosta e o Gigante de Gelo no alto.",
    respawn: { x: 0, z: -840 + 71 },
  },
  floresta: { id: "floresta", name: "Floresta Ancestral", center: { x: 0, z: -420 }, half: 110, levels: [12, 20], subtitle: "Lobos em matilha, entes despertos, ecos élficos nas ruínas e o Ente Ancião ao norte.", respawn: { x: 0, z: -420 + 89 } },
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

/**
 * Passagem na borda de uma zona, como as saídas de mapa do Ragnarok: uma trilha que sai pela beira do
 * mapa. Quem atravessa a linha da boca (`at`, na direção `out`) vai para a outra zona, depois da tela
 * de carregamento, e chega um pouco para dentro da passagem de volta (fora da boca, para não voltar).
 */
export interface ZonePassage {
  id: string;
  from: ZoneId;
  to: ZoneId;
  /** Centro da boca da passagem. */
  at: { x: number; z: number };
  /** Direção "para fora" da zona, num dos eixos. */
  out: { x: number; z: number };
  /** Meia largura da boca. */
  width: number;
  /** Onde o herói chega na zona de destino. */
  arrive: { x: number; z: number };
  /** Para onde ele olha ao chegar. */
  arriveYaw: number;
}

export const ZONE_PASSAGES: ZonePassage[] = [
  { id: "vale-floresta", from: "vale", to: "floresta", at: { x: 22, z: -101 }, out: { x: 0, z: -1 }, width: 5, arrive: { x: 0, z: -420 + 92 }, arriveYaw: 0 },
  { id: "floresta-picos", from: "floresta", to: "picos", at: { x: 50, z: -420 - 101 }, out: { x: 0, z: -1 }, width: 5, arrive: { x: 0, z: -840 + 92 }, arriveYaw: 0 },
  { id: "picos-floresta", from: "picos", to: "floresta", at: { x: 0, z: -840 + 101 }, out: { x: 0, z: 1 }, width: 5, arrive: { x: 50, z: -420 - 92 }, arriveYaw: Math.PI },
  { id: "floresta-vale", from: "floresta", to: "vale", at: { x: 0, z: -420 + 101 }, out: { x: 0, z: 1 }, width: 5, arrive: { x: 22, z: -92 }, arriveYaw: Math.PI },
];

/** Passagem cuja boca o ponto atravessou (ou undefined). */
export function passageAt(p: { x: number; z: number }): ZonePassage | undefined {
  return ZONE_PASSAGES.find((g) => {
    const dx = p.x - g.at.x, dz = p.z - g.at.z;
    const along = dx * g.out.x + dz * g.out.z; // quanto passou da boca
    const side = Math.abs(dx * g.out.z - dz * g.out.x); // distância do eixo da trilha
    return along >= 0 && along < 12 && side <= g.width;
  });
}

/** Leva o herói pela passagem para a zona vizinha. */
export function travel(world: World, player: Entity, passage: ZonePassage): void {
  const to = passage.arrive;
  player.transform.position = { x: to.x, y: terrainHeight(to.x, to.z), z: to.z };
  player.transform.yaw = passage.arriveYaw;
  player.movement.intent = { x: 0, z: 0 };
  world.emit({ type: "zoneTravel", from: passage.from, to: passage.to });
}
