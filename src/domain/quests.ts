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
  if (def.reward.item?.kind === "equipment") rewardItems.push(createEquipment(world.random, def.reward.item.tier, def.reward.item.rarity));
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
