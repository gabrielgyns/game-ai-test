import type { Entity, EntityId } from "./components";
import type { Vec3 } from "./math";

export interface NpcDefinition {
  id: string;
  name: string;
  archetype: string;
  /** Fala quando não há quest para oferecer nem entregar. */
  idle: string[];
  /** Id da loja (abre o painel de compra e venda; cada loja tem estoque próprio, ver `SHOPS`). */
  shop?: string;
}

export const NPC_DEFS: NpcDefinition[] = [
  {
    id: "elder",
    name: "Anciã Mira",
    archetype: "elder",
    idle: [
      "O santuário protege quem descansa nele. Os inimigos não entram no círculo de pedras.",
      "Cada nível que você ganha cura por completo. Às vezes lutar é o melhor remédio.",
    ],
  },
  {
    id: "smith",
    name: "Ferreiro Brom",
    archetype: "smith",
    idle: [
      "Armas de raridade brilham na cor delas. Verde é bom, azul é melhor, roxo... roxo é lenda.",
      "Troca de arma na mochila, com I. A que você veste aparece na sua mão.",
    ],
  },
  {
    id: "guard",
    name: "Guarda Tiago",
    archetype: "guard",
    idle: [
      "Quando a área vermelha aparecer no chão, sai dela ou rola com Espaço. Dentro dela, o golpe acerta.",
      "Gosmas perto, goblins no meio, orcs na borda. O norte é coisa de gente preparada.",
      "Shift corre. Andar de ré com S é mais lento, mas mantém o inimigo na sua frente.",
      "Ao norte, perto do platô do Rei Goblin, a muralha tem uma trilha que sai do vale e entra na Floresta Ancestral. Lá a coisa é séria, nível 12 para cima.",
      "Aquela pedra azul no meio da praça é uma Pedra de Teleporte. Toda vila tem uma: visitou, ativou. Depois é só pagar uns trocados e ela te leva de uma vila para outra.",
    ],
  },
  {
    id: "merchant",
    name: "Mercadora Zuri",
    archetype: "merchant",
    shop: "merchant",
    idle: [
      "Ouro parado não mata gosma. Vendo poções a qualquer hora, e o que chega nas caravanas muda todo dia.",
      "Repare nos nomes: \"da Serpente\" cura sempre, \"da Águia\" acerta crítico, \"do Vampiro\" bebe a vida de quem apanha.",
      "Vendeu sem querer? Eu guardo os últimos itens. Recompra pelo mesmo preço, sem choro.",
    ],
  },
  {
    id: "ranger",
    name: "Guardiã Lyra",
    archetype: "ranger",
    idle: [
      "A floresta é antiga e não gosta de pressa. Os lobos caçam em bando: recue até um tronco e lute de costas para ele.",
      "Os entes batem devagar, mas cada golpe derruba um homem. Leia o aviso e saia do caminho.",
      "A trilha ao sul leva de volta ao Vale. Se cair aqui, acorda no acampamento.",
    ],
  },
  {
    id: "peddler",
    name: "Mascate Faelan",
    archetype: "peddler",
    shop: "peddler",
    idle: [
      "Quem chega até aqui não quer mais espada de goblin. Meu estoque é da floresta: mais caro, mais forte.",
      "A Zuri lá do vale e eu não dividimos freguês nem recompra. Vendeu para ela, recompra com ela.",
    ],
  },
  {
    id: "armorer",
    name: "Armeira Kaia",
    archetype: "armorer",
    idle: [
      "Meu baú é o mesmo do santuário, sabia? Coisa de elfo: o que você guarda lá, tira aqui.",
      "Peça de conjunto só cai de chefe. A do Ente Ancião regenera vida e devolve dor a quem te bate.",
      "Ao norte, depois da clareira do Ancião e um pouco a leste, a mata acaba numa trilha de pedra que sobe para os Picos Gelados. Leve casaco. E poções.",
    ],
  },
  // Picos Gelados: vila de Pedra-Fria.
  {
    id: "jarl",
    name: "Jarl Bjorn",
    archetype: "jarl",
    idle: [
      "Pedra-Fria aguenta o inverno há trezentos anos. Não vai ser um gigante mal-humorado que vai derrubar a gente.",
      "O lago a oeste é gelo puro. Bonito de ver, péssimo de lutar: quem corre em cima não para quando quer.",
      "A Caverna de Gelo fica na encosta leste. Lá dentro o frio tem dona.",
    ],
  },
  {
    id: "trader",
    name: "Mercadora Sigrid",
    archetype: "furTrader",
    shop: "trader",
    idle: [
      "Peles, ferro bom e o que as caravanas trazem antes da neve fechar a trilha. Aqui nada é barato, mas tudo presta.",
      "Estilhaço de gelo deixa a gente lenta. Se o espectro mirar, saia da linha antes, não depois.",
    ],
  },
  {
    id: "hunter",
    name: "Caçadora Eira",
    archetype: "hunter",
    idle: [
      "Lobo da neve caça em silêncio. Quando você ouvir, já são três.",
      "Yeti é lento para levantar o braço. Quando levanta, saia de baixo.",
    ],
  },
];

export function npcById(id: string): NpcDefinition | undefined {
  return NPC_DEFS.find((n) => n.id === id);
}

export function createNpc(id: EntityId, def: NpcDefinition, position: Vec3, yaw = 0): Entity {
  return {
    id,
    kind: "npc",
    name: def.name,
    archetype: def.archetype,
    transform: { position: { ...position }, yaw },
    movement: { speed: 0, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: 1, max: 1, baseMax: 1, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage: 0, baseDamage: 0, range: 0, cooldown: 1, cooldownLeft: 0, wantsAttack: false, windupTime: 0, windupLeft: 0 },
    npc: { id: def.id },
  };
}

/** Distância máxima para conversar. */
export const TALK_RANGE = 2.8;
