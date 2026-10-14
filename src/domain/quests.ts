import type { Entity } from "./components";
import { addItem } from "./inventory";
import { createEquipment, createPotion, type Item, type Rarity } from "./items";
import { grantXp } from "./progression";
import type { World } from "./world";

export type QuestObjective = { kind: "kill"; archetype: string; count: number; label: string };

export interface QuestReward {
  xp: number;
  gold: number;
  /** Equipamento garantido (tier e raridade) ou poções. */
  item?: { kind: "equipment"; tier: 1 | 2 | 3; rarity: Rarity } | { kind: "potion"; size: "small" | "large"; quantity: number };
}

export interface QuestDefinition {
  id: string;
  title: string;
  /** NPC que oferece e recebe a quest. */
  giver: string;
  description: string;
  objective: QuestObjective;
  reward: QuestReward;
  /** Quests que precisam estar concluídas antes. */
  requires: string[];
  dialogue: { offer: string; progress: string; complete: string };
}

export type QuestState = "active" | "completed";

export interface QuestProgress {
  state: QuestState;
  progress: number;
}

/** Diário de quests do jogador. */
export type QuestLog = Record<string, QuestProgress>;

export const QUESTS: QuestDefinition[] = [
  {
    id: "slimes",
    title: "Limpeza do Vale",
    giver: "elder",
    description: "As gosmas tomaram as campinas em volta do santuário. Derrote 5 delas.",
    objective: { kind: "kill", archetype: "slime", count: 5, label: "Gosmas derrotadas" },
    reward: { xp: 60, gold: 25 },
    requires: [],
    dialogue: {
      offer: "Que bom ver alguém de pé por aqui. As gosmas se espalharam pelas campinas e ninguém mais consegue colher. Pode nos livrar de algumas?",
      progress: "As gosmas ainda estão por aí. Elas são lentas: dê um passo para trás depois de cada golpe.",
      complete: "As campinas respiram de novo. Aceite isto como agradecimento, e volte quando puder: há coisa pior na mata.",
    },
  },
  {
    id: "goblins",
    title: "Goblins na Mata",
    giver: "elder",
    description: "Goblins batedores rondam a mata além das campinas. Derrote 5 deles.",
    objective: { kind: "kill", archetype: "goblin", count: 5, label: "Goblins derrotados" },
    reward: { xp: 160, gold: 60, item: { kind: "potion", size: "large", quantity: 2 } },
    requires: ["slimes"],
    dialogue: {
      offer: "Goblins batedores andam marcando nossas árvores. Isso significa que alguém os comanda. Afaste cinco deles e descubra o que puder.",
      progress: "Os goblins são rápidos. Use a esquiva quando a área vermelha aparecer no chão.",
      complete: "Então é verdade... os batedores respondem a um rei. Tome estas poções, você vai precisar delas no norte.",
    },
  },
  {
    id: "king",
    title: "O Rei Goblin",
    giver: "elder",
    description: "O Rei Goblin reina num platô ao norte, cercado de totens. Derrote-o.",
    objective: { kind: "kill", archetype: "goblinKing", count: 1, label: "Rei Goblin derrotado" },
    reward: { xp: 700, gold: 250, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["goblins"],
    dialogue: {
      offer: "O Rei Goblin vive no platô ao norte, entre os totens. Ele muda de postura conforme se fere: observe os avisos no chão e respeite o Pisão. Vá quando estiver forte.",
      progress: "Ele ainda reina. Leve poções grandes, e lembre: a investida dele segue uma linha reta. Saia dela.",
      complete: "O vale inteiro está em dívida com você. Este tesouro foi guardado para quem conseguisse. É seu.",
    },
  },
  {
    id: "spiderQueen",
    title: "A Rainha do Pântano",
    giver: "elder",
    description: "No pântano a oeste, uma Rainha Aranha cria ninhos. Derrote-a.",
    objective: { kind: "kill", archetype: "spiderQueen", count: 1, label: "Rainha Aranha derrotada" },
    reward: { xp: 1200, gold: 400, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["king"],
    dialogue: {
      offer: "Com o rei caído, os goblins se dispersaram... e o pântano a oeste ficou sem quem o contivesse. Uma Rainha Aranha faz ninho lá. As teias dela ficam onde você está: ande.",
      progress: "A Teia Venenosa cai onde você estava quando ela começou a tecer. Nunca fique parado no pântano.",
      complete: "O pântano vai secar aos poucos agora. Você se tornou a lenda que este vale precisava.",
    },
  },
  {
    id: "scorpions",
    title: "Escorpiões do Deserto",
    giver: "smith",
    description: "Escorpiões do deserto a leste envenenam as caravanas. Derrote 5.",
    objective: { kind: "kill", archetype: "scorpion", count: 5, label: "Escorpiões derrotados" },
    reward: { xp: 500, gold: 140, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["orcs"],
    dialogue: {
      offer: "As caravanas do leste pararam de vir: escorpiões no deserto. O ferrão deles é rápido, quase sem aviso. Cinco a menos e eu te pago com aço de verdade.",
      progress: "O aviso do escorpião é curto. Ataque e saia antes de ele erguer a cauda.",
      complete: "As caravanas voltam a andar. Toma: forjei com o melhor que tinha.",
    },
  },
  {
    id: "bandits",
    title: "Salteadores da Rota",
    giver: "guard",
    description: "Salteadores emboscam viajantes no deserto. Derrote 4.",
    objective: { kind: "kill", archetype: "bandit", count: 4, label: "Salteadores derrotados" },
    reward: { xp: 450, gold: 180, item: { kind: "potion", size: "large", quantity: 3 } },
    requires: ["goblins"],
    dialogue: {
      offer: "Não é só bicho que ameaça o vale. Salteadores atacam na rota do deserto. Eles são rápidos e golpeiam em sequência: use o Golpe Giratório quando cercarem.",
      progress: "Salteador bom é salteador no chão. Quatro deles, e a rota volta a ser nossa.",
      complete: "A rota está segura. Guarde estas poções: a Guarda agradece.",
    },
  },
  {
    id: "emperor",
    title: "O Imperador das Areias",
    giver: "guard",
    description: "No tablado de areia a leste reina o Imperador Escorpião, protegido por uma carapaça. Derrote-o.",
    objective: { kind: "kill", archetype: "scorpionEmperor", count: 1, label: "Imperador Escorpião derrotado" },
    reward: { xp: 1400, gold: 450, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["bandits"],
    dialogue: {
      offer: "Os salteadores falavam de um senhor no extremo leste: o Imperador Escorpião. A carapaça de areia dele não sente espada nem flecha comum. Só as suas técnicas a racham. Quebre a casca e bata enquanto ele estiver tonto.",
      progress: "Ataque básico não passa da carapaça: use as habilidades. E cuidado com o ácido: o chão fica queimando onde o cuspe cai.",
      complete: "O leste está livre! Nunca pensei que veria alguém voltar daquele tablado. Isto é seu, com a gratidão da Guarda.",
    },
  },
  {
    id: "crypt",
    title: "A Cripta Esquecida",
    giver: "elder",
    description: "Um portal antigo se abriu a nordeste do santuário. Desça à cripta e derrote o Lorde Esqueleto.",
    objective: { kind: "kill", archetype: "skeletonLord", count: 1, label: "Lorde Esqueleto derrotado" },
    reward: { xp: 900, gold: 300, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["goblins"],
    dialogue: {
      offer: "Um portal de pedra acordou a nordeste daqui. Leva a uma cripta que muda de forma toda vez que alguém entra. Lá dentro, você tem três chances: caia três vezes e a cripta te expulsa. No fundo dorme um Lorde Esqueleto, e um baú que ninguém nunca abriu.",
      progress: "A cripta fica a nordeste do santuário: procure o arco de pedra com a luz roxa. Limpe as salas, ache o Lorde, e não esqueça do baú.",
      complete: "Você voltou da cripta! Leve isto. E volte lá quando quiser: ela nunca é a mesma, e o baú sempre se enche de novo.",
    },
  },
  {
    id: "orcs",
    title: "Orcs da Borda",
    giver: "smith",
    description: "Orcs da borda do mapa roubaram o ferro do ferreiro. Derrote 3 deles.",
    objective: { kind: "kill", archetype: "orc", count: 3, label: "Orcs derrotados" },
    reward: { xp: 300, gold: 90, item: { kind: "equipment", tier: 2, rarity: "rare" } },
    requires: ["slimes"],
    dialogue: {
      offer: "Orcs da borda levaram meu ferro. Sem ele não forjo nada. Derrube três e eu forjo algo digno para você com o que sobrar.",
      progress: "Os orcs batem devagar e forte. O aviso deles é longo: dá tempo de rolar.",
      complete: "Isso é ferro de orc, do bom. Forjei o que prometi. Use bem.",
    },
  },
  // Floresta Ancestral: Guardiã Lyra, no acampamento ao sul.
  {
    id: "wolves",
    title: "Matilha Faminta",
    giver: "ranger",
    description: "Lobos cinzentos cercam o acampamento da floresta. Derrote 8 deles.",
    objective: { kind: "kill", archetype: "wolf", count: 8, label: "Lobos derrotados" },
    reward: { xp: 2500, gold: 400, item: { kind: "potion", size: "large", quantity: 3 } },
    requires: [],
    dialogue: {
      offer: "Você veio pela trilha do vale? Então sabe lutar. A matilha cinzenta cerca o acampamento faz três noites. Eles atacam juntos e rodeiam: oito lobos a menos e a gente dorme em paz.",
      progress: "Lobo não ataca sozinho. Quando um avançar, os outros já estão te cercando. Use o terreno.",
      complete: "A mata ficou em silêncio. Bom sinal. Tome, poções de quem vive aqui.",
    },
  },
  {
    id: "ents",
    title: "Cerne de Ente",
    giver: "armorer",
    description: "Entes jovens acordaram com raiva e derrubam quem entra na mata. Derrote 5 deles.",
    objective: { kind: "kill", archetype: "ent", count: 5, label: "Entes derrotados" },
    reward: { xp: 4000, gold: 600, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["wolves"],
    dialogue: {
      offer: "Ferro aqui enferruja em uma semana. O que presta é cerne de ente: duro como aço, leve como pinho. Os entes acordaram com raiva e não dão nada de graça. Derrube cinco e eu te faço uma peça que o Brom lá do vale nem sonha.",
      progress: "O aviso deles é longo. Saia da área e bata pelas costas.",
      complete: "Cerne bom, sem nó. Prometi e cumpri: tome, saiu da bigorna hoje cedo.",
    },
  },
  {
    id: "spirits",
    title: "Ecos de Elar",
    giver: "ranger",
    description: "Espíritos élficos assombram as ruínas a leste e atiram em quem se aproxima. Derrote 6 deles.",
    objective: { kind: "kill", archetype: "elvenSpirit", count: 6, label: "Espíritos derrotados" },
    reward: { xp: 4000, gold: 600, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["wolves"],
    dialogue: {
      offer: "A leste ficam as ruínas de Elar, uma cidade élfica. Os espíritos dos arqueiros ainda guardam os muros e atiram de longe. Seis deles, e a gente volta a passar por lá.",
      progress: "Eles fogem para atirar de novo. Feche a distância rápido ou saia da linha do tiro.",
      complete: "Os ecos se calaram. Isto estava num altar das ruínas; é seu por direito.",
    },
  },
  {
    id: "treant",
    title: "O Ente Ancião",
    giver: "ranger",
    description: "Na clareira ao norte desperta o Ente Ancião, coração doente da floresta. Derrote-o.",
    objective: { kind: "kill", archetype: "ancientTreant", count: 1, label: "Ente Ancião derrotado" },
    reward: { xp: 9000, gold: 1500, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["ents", "spirits"],
    dialogue: {
      offer: "Lobos, entes, espíritos: tudo vem de um lugar. Na clareira ao norte, depois do rio, o Ente Ancião acordou doente. Ele cospe esporos que envenenam o chão e chama a matilha quando sangra. Derrube o velho e a floresta volta a dormir.",
      progress: "Atravesse o rio rumo ao norte. Cuidado com as nuvens de esporos: o chão fica tóxico por um bom tempo.",
      complete: "A floresta adormeceu de novo. Você fez o que nenhum de nós conseguiu. Isto é seu, e as peças da casca dele também.",
    },
  },
  {
    id: "sanctum",
    title: "O Santuário de Elar",
    giver: "ranger",
    description: "Sob as ruínas de Elar, no Santuário Élfico, o Oráculo enlouqueceu e chama os ecos. Derrote-o.",
    objective: { kind: "kill", archetype: "elvenOracle", count: 1, label: "Oráculo de Elar derrotado" },
    reward: { xp: 12000, gold: 1600, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["spirits"],
    dialogue: {
      offer: "Os ecos das ruínas não vêm do nada. No pátio de Elar há uma porta para o Santuário, onde o Oráculo guardava a cidade. Dizem que ele ainda está lá, e que não reconhece mais amigo de inimigo. Desça os dois andares e dê descanso a ele.",
      progress: "A porta fica no pátio das ruínas, a leste. Lá dentro você tem três vidas; use os santuários.",
      complete: "Os ecos pararam de vez. Você libertou o Oráculo. Isto estava no altar dele; agora é seu.",
    },
  },
  {
    id: "heartwood",
    title: "Madeira Viva",
    giver: "armorer",
    description: "Com o Ente Ancião dormindo, os entes ficaram mansos e o cerne, mais puro. Derrote 10 entes para a Armeira Kaia.",
    objective: { kind: "kill", archetype: "ent", count: 10, label: "Entes derrotados" },
    reward: { xp: 8000, gold: 1200, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["treant", "ents"],
    dialogue: {
      offer: "Sentiu? A floresta dormiu e o cerne dos entes mudou de cor. Com dez troncos desses eu faço a melhor peça da minha vida. Topa?",
      progress: "Os entes ainda batem forte. Não é porque a floresta dormiu que eles gostam de machado.",
      complete: "Olha esse veio... Isto é para você. Quando a próxima trilha abrir, vai precisar.",
    },
  },
  // Picos Gelados: vila de Pedra-Fria.
  {
    id: "snowWolves",
    title: "Uivos na Nevasca",
    giver: "hunter",
    description: "Lobos das neves rondam a trilha que sobe da floresta. Derrote 10 deles.",
    objective: { kind: "kill", archetype: "snowWolf", count: 10, label: "Lobos das neves derrotados" },
    reward: { xp: 16000, gold: 1000, item: { kind: "potion", size: "large", quantity: 4 } },
    requires: [],
    dialogue: {
      offer: "Subiu a trilha inteira e ainda está de pé? Bom. Os lobos das neves estão chegando cada noite mais perto das casas. Dez deles e eu volto a dormir.",
      progress: "Eles somem na neve. Fique de costas para uma pedra e conte as sombras.",
      complete: "Dez peles brancas. Fica com as poções; aqui em cima elas valem mais que ouro.",
    },
  },
  {
    id: "wraiths",
    title: "Vozes no Gelo",
    giver: "hunter",
    description: "Espectros gélidos assombram o lago congelado a oeste e atiram estilhaços que deixam lento. Derrote 8 deles.",
    objective: { kind: "kill", archetype: "iceWraith", count: 8, label: "Espectros derrotados" },
    reward: { xp: 22000, gold: 1400, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["snowWolves"],
    dialogue: {
      offer: "Tem gente que se afogou naquele lago, antes de ele congelar de vez. Agora eles cantam e atiram gelo em quem passa. Oito espectros. Cuidado com o chão: gelo escorrega.",
      progress: "Os estilhaços deixam lento. Lento no gelo é pedir para apanhar. Mude de direção cedo.",
      complete: "O lago ficou quieto. Este arco era do meu pai, mas você vai usar melhor do que eu.",
    },
  },
  {
    id: "yetis",
    title: "Pegadas Gigantes",
    giver: "jarl",
    description: "Yetis desceram das cristas e atacam os caçadores. Derrote 6 deles.",
    objective: { kind: "kill", archetype: "yeti", count: 6, label: "Yetis derrotados" },
    reward: { xp: 30000, gold: 1800, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["snowWolves"],
    dialogue: {
      offer: "Yeti nunca desce até a vila. Agora desce. Alguma coisa lá em cima está espantando eles. Seis, para começar, e depois a gente conversa sobre o que está lá em cima.",
      progress: "O soco do yeti tem aviso longo. Quem fica para ver, não vê mais nada.",
      complete: "Seis. A vila te deve. E eu te devo a verdade: quem espanta os yetis é o Gigante de Gelo.",
    },
  },
  {
    id: "iceCave",
    title: "A Dona do Frio",
    giver: "jarl",
    description: "Na Caverna de Gelo, na encosta leste, a Rainha Gélida guarda o coração do inverno. Derrote-a.",
    objective: { kind: "kill", archetype: "iceQueen", count: 1, label: "Rainha Gélida derrotada" },
    reward: { xp: 40000, gold: 2500, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["yetis"],
    dialogue: {
      offer: "A caverna da encosta leste nunca teve fundo. Agora tem dona: uma rainha feita de gelo, e o frio todo sai de lá. Entre, desça os dois andares e acabe com ela.",
      progress: "Dentro da caverna você tem três vidas. Use os santuários antes da porta dela.",
      complete: "O vento mudou. Pela primeira vez em anos, a lareira esquentou a sala inteira. Toma, é seu.",
    },
  },
  {
    id: "frostGiant",
    title: "O Gigante da Montanha",
    giver: "jarl",
    description: "No platô ao norte acordou o Gigante de Gelo, que arremessa avalanches e congela o chão. Derrote-o.",
    objective: { kind: "kill", archetype: "frostGiant", count: 1, label: "Gigante de Gelo derrotado" },
    reward: { xp: 60000, gold: 4000, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["yetis", "wraiths"],
    dialogue: {
      offer: "Está na hora. O Gigante dorme no platô ao norte, depois das cristas. Ele joga blocos de gelo que congelam o chão: não fique em cima. Quando sangra, uiva e os lobos vêm. Derrube o gigante e os Picos voltam a ser nossos.",
      progress: "Chão azul é chão congelado: fere e prende. Lute fora dele.",
      complete: "Trezentos anos e ninguém tinha feito isso. Pedra-Fria nunca vai esquecer seu nome. E as peças da armadura dele são suas.",
    },
  },
  // Terras Vulcânicas: Bastião de Brasa.
  {
    id: "hounds",
    title: "Cães da Caldeira",
    giver: "scout",
    description: "Cães de lava cercam o Bastião. Derrote 12 deles.",
    objective: { kind: "kill", archetype: "lavaHound", count: 12, label: "Cães de lava derrotados" },
    reward: { xp: 150000, gold: 3000, item: { kind: "potion", size: "large", quantity: 5 } },
    requires: [],
    dialogue: {
      offer: "Você desceu dos Picos? Então ainda tem fôlego. Os cães de lava rondam a muralha toda noite. Doze deles e a gente respira.",
      progress: "Eles correm em bando e mordem rápido. Lute perto da muralha, longe da lava.",
      complete: "A muralha ficou quieta. Toma, poções; aqui em cima elas evaporam rápido.",
    },
  },
  {
    id: "pyromancers",
    title: "Culto da Brasa",
    giver: "scout",
    description: "Piromantes adoram a caldeira e atiram bolas de fogo em quem passa. Derrote 10 deles.",
    objective: { kind: "kill", archetype: "flameCaster", count: 10, label: "Piromantes derrotados" },
    reward: { xp: 200000, gold: 3800, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["hounds"],
    dialogue: {
      offer: "Tem gente que olha para o vulcão e vê um deus. Os piromantes acham que o Senhor das Chamas vai salvá-los. Dez deles, antes que convençam mais alguém.",
      progress: "A bola de fogo segue a linha avisada no chão. Saia dela de lado.",
      complete: "O culto rachou. Isto estava com o líder deles; é seu.",
    },
  },
  {
    id: "golems",
    title: "Pedra que Anda",
    giver: "commander",
    description: "Golens de magma sobem dos rios de lava e esmagam as patrulhas. Derrote 6 deles.",
    objective: { kind: "kill", archetype: "magmaGolem", count: 6, label: "Golens derrotados" },
    reward: { xp: 260000, gold: 4500, item: { kind: "equipment", tier: 3, rarity: "rare" } },
    requires: ["hounds"],
    dialogue: {
      offer: "Os golens nasceram da lava e voltam para ela. Enquanto isso, esmagam minhas patrulhas. Seis, soldado. Depois a gente fala da Forja.",
      progress: "O golpe do golem tem aviso longo e acerta como um desabamento. Não fique para ver.",
      complete: "Seis montes de pedra fria. O Bastião agradece, e eu tenho mais um serviço.",
    },
  },
  {
    id: "forge",
    title: "O Mestre da Forja",
    giver: "commander",
    description: "Na Forja Vulcânica, a oeste, o Mestre da Forja arma o exército da caldeira. Derrote-o.",
    objective: { kind: "kill", archetype: "forgeMaster", count: 1, label: "Mestre da Forja derrotado" },
    reward: { xp: 400000, gold: 7000, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["golems"],
    dialogue: {
      offer: "Os golens, as lâminas dos piromantes, tudo sai da Forja Vulcânica, a oeste. Lá dentro um ferreiro que não é mais gente bate na bigorna dia e noite. Desça os dois andares e apague a forja.",
      progress: "Na Forja você tem três vidas. As grades no chão soltam fogo em ciclo: leia o aviso.",
      complete: "A bigorna parou. Pela primeira vez em anos não se ouve o martelo daqui. É seu.",
    },
  },
  {
    id: "fireLord",
    title: "O Senhor das Chamas",
    giver: "commander",
    description: "Na caldeira, ao norte, desperta o Senhor das Chamas, que chove magma e chama os cães de lava. Derrote-o.",
    objective: { kind: "kill", archetype: "fireLord", count: 1, label: "Senhor das Chamas derrotado" },
    reward: { xp: 600000, gold: 12000, item: { kind: "equipment", tier: 3, rarity: "epic" } },
    requires: ["golems", "pyromancers"],
    dialogue: {
      offer: "Chegou a hora. Suba o cone ao norte e entre na caldeira pelo sul, onde o fosso de lava se abre. O Senhor das Chamas chove magma: o chão em chamas fica um bom tempo. Derrube o demônio e o fogo volta a dormir.",
      progress: "A entrada da caldeira é ao sul. O resto da borda é fosso de lava.",
      complete: "O vulcão silenciou. O Bastião, os Picos, a Floresta, o Vale: todos te devem. E as peças da coroa dele são suas.",
    },
  },
];

export function questById(id: string): QuestDefinition | undefined {
  return QUESTS.find((q) => q.id === id);
}

export function questState(log: QuestLog, id: string): QuestState | "available" | "locked" {
  const entry = log[id];
  if (entry) return entry.state;
  const def = questById(id);
  if (!def) return "locked";
  return def.requires.every((r) => log[r]?.state === "completed") ? "available" : "locked";
}

export function isObjectiveDone(log: QuestLog, def: QuestDefinition): boolean {
  const entry = log[def.id];
  return entry?.state === "active" && entry.progress >= def.objective.count;
}

/** Quests que um NPC tem para oferecer ou receber agora. */
export function questsForNpc(log: QuestLog, npcId: string): { offer: QuestDefinition[]; turnIn: QuestDefinition[]; active: QuestDefinition[] } {
  const mine = QUESTS.filter((q) => q.giver === npcId);
  return {
    offer: mine.filter((q) => questState(log, q.id) === "available"),
    turnIn: mine.filter((q) => isObjectiveDone(log, q)),
    active: mine.filter((q) => log[q.id]?.state === "active" && !isObjectiveDone(log, q)),
  };
}

export function acceptQuest(world: World, player: Entity, id: string): boolean {
  const log = player.quests;
  if (!log || questState(log, id) !== "available") return false;
  log[id] = { state: "active", progress: 0 };
  world.emit({ type: "questAccepted", entity: player.id, questId: id });
  return true;
}

/** Avança as quests de abate do jogador quando um inimigo do arquétipo morre. */
export function advanceKillQuests(world: World, player: Entity, archetype: string): void {
  const log = player.quests;
  if (!log) return;
  for (const def of QUESTS) {
    const entry = log[def.id];
    if (!entry || entry.state !== "active" || def.objective.archetype !== archetype) continue;
    if (entry.progress >= def.objective.count) continue;
    entry.progress++;
    world.emit({ type: "questProgress", entity: player.id, questId: def.id, progress: entry.progress, count: def.objective.count });
    if (entry.progress >= def.objective.count) world.emit({ type: "questReady", entity: player.id, questId: def.id });
  }
}

/** Entrega a quest: dá as recompensas. Itens vão para a mochila ou, se cheia, para o chão. */
export function completeQuest(world: World, player: Entity, id: string): boolean {
  const log = player.quests;
  const def = questById(id);
  if (!log || !def || !isObjectiveDone(log, def)) return false;
  log[id] = { state: "completed", progress: def.objective.count };

  const rewardItems: Item[] = [];
  // O equipamento de recompensa vem no nível do herói (acima de 10, mais forte).
  if (def.reward.item?.kind === "equipment") rewardItems.push(createEquipment(world.random, def.reward.item.tier, def.reward.item.rarity, player.progression?.level ?? 1));
  if (def.reward.item?.kind === "potion") rewardItems.push(createPotion(def.reward.item.size, def.reward.item.quantity));
  for (const item of rewardItems) {
    if (player.inventory && addItem(player.inventory, item)) continue;
    world.addDrop(item, { ...player.transform.position });
  }
  if (player.wallet) player.wallet.gold += def.reward.gold;
  grantXp(world, player, def.reward.xp);
  world.emit({ type: "questCompleted", entity: player.id, questId: id, gold: def.reward.gold, xp: def.reward.xp, itemNames: rewardItems.map((i) => i.name) });
  return true;
}
