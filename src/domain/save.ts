import type { Equipment } from "./inventory";
import { recomputeStats } from "./inventory";
import { resetItemIds, type Item } from "./items";
import type { Vec3 } from "./math";
import type { QuestLog } from "./quests";
import { generateWorld } from "./worldgen";
import { isClassId, type ClassId } from "./classes";
import type { World } from "./world";
import type { ShopState } from "./shop";
import type { TalentRanks } from "./skillTree";

export const SAVE_VERSION = 1;

/** Snapshot serializável do progresso. O mundo é regenerado pela seed; só o que muda é guardado. */
export interface SaveData {
  version: number;
  savedAt: number;
  seed: number;
  time: number;
  player: {
    classId?: ClassId;
    /** Nome escolhido na criação do slot (opcional: saves antigos não têm). */
    heroName?: string;
    position: Vec3;
    yaw: number;
    health: number;
    level: number;
    xp: number;
    xpToNext: number;
    baseMax: number;
    baseDamage: number;
    gold: number;
    kills: number;
    inventory: (Item | null)[];
    equipment: Equipment;
    quests: QuestLog;
    /** Ranks da árvore de habilidades (opcional: saves antigos não têm). */
    talents?: TalentRanks;
  };
  drops: { item: Item; position: Vec3; age: number; requireLeave?: boolean }[];
  /** Estoque do dia e recompra da Mercadora (opcional: saves antigos não têm). */
  shop?: ShopState;
}

export function serializeGame(world: World, seed: number): SaveData {
  const p = world.player;
  if (!p) throw new Error("Sem jogador para salvar");
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    seed,
    time: world.time,
    player: {
      classId: p.classId ?? "warrior",
      heroName: p.name,
      position: { ...p.transform.position },
      yaw: p.transform.yaw,
      health: p.health.current,
      level: p.progression?.level ?? 1,
      xp: p.progression?.xp ?? 0,
      xpToNext: p.progression?.xpToNext ?? 40,
      baseMax: p.health.baseMax,
      baseDamage: p.combat.baseDamage,
      gold: p.wallet?.gold ?? 0,
      kills: p.stats?.kills ?? 0,
      inventory: (p.inventory?.items ?? []).map((i) => (i ? structuredClone(i) : null)),
      equipment: structuredClone(p.equipment ?? { weapon: null, armor: null, accessory: null }),
      quests: structuredClone(p.quests ?? {}),
      talents: { ...(p.talents ?? {}) },
    },
    drops: [...world.drops.values()].map((d) => ({ item: structuredClone(d.item), position: { ...d.position }, age: d.age, requireLeave: d.requireLeave })),
    shop: world.shop ? structuredClone(world.shop) : undefined,
  };
}

/** Valida o formato o suficiente para não quebrar com um arquivo estranho. */
export function isSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SaveData>;
  return v.version === SAVE_VERSION && typeof v.seed === "number" && !!v.player && Array.isArray(v.player.inventory) && Array.isArray(v.drops);
}

/** Reconstrói um mundo a partir do snapshot. Inimigos renascem em casa; o herói volta exatamente onde estava. */
export function restoreGame(save: SaveData): World {
  const world = generateWorld({ seed: save.seed, classId: isClassId(save.player.classId) ? save.player.classId : "warrior" });
  world.time = save.time;
  const p = world.player!;
  const s = save.player;

  if (s.heroName?.trim()) p.name = s.heroName.trim();
  p.transform.position = { ...s.position };
  p.transform.yaw = s.yaw;
  if (p.progression) {
    p.progression.level = s.level;
    p.progression.xp = s.xp;
    p.progression.xpToNext = s.xpToNext;
  }
  p.health.baseMax = s.baseMax;
  p.combat.baseDamage = s.baseDamage;
  if (p.wallet) p.wallet.gold = s.gold;
  p.stats = { kills: s.kills };
  if (p.inventory) {
    p.inventory.items = p.inventory.items.map((_, i) => s.inventory[i] ?? null);
  }
  p.equipment = structuredClone(s.equipment);
  p.quests = structuredClone(s.quests);
  p.talents = { ...(s.talents ?? {}) };
  recomputeStats(p);
  p.health.current = Math.min(p.health.max, Math.max(1, s.health));

  let maxItemId = 0;
  const track = (item: Item | null) => {
    if (item) maxItemId = Math.max(maxItemId, item.id);
  };
  p.inventory?.items.forEach(track);
  Object.values(p.equipment).forEach(track);
  for (const d of save.drops) {
    track(d.item);
    const drop = world.addDrop(structuredClone(d.item), d.position);
    drop.age = d.age;
    drop.requireLeave = d.requireLeave ?? false;
  }
  if (save.shop) {
    world.shop = structuredClone(save.shop);
    world.shop.offers.forEach((o) => track(o.item));
    world.shop.buyback.forEach((b) => track(b.item));
  }
  world.drainEvents(); // os addDrop acima não são "eventos" novos para a apresentação
  resetItemIds(maxItemId + 1);
  return world;
}

/** Texto curto para o menu: nível, ouro e quando foi salvo. */
export function describeSave(save: SaveData): string {
  const when = new Date(save.savedAt);
  const quests = Object.values(save.player.quests).filter((q) => q.state === "completed").length;
  return `Nível ${save.player.level} · ${save.player.gold} ouro · ${quests} quest${quests === 1 ? "" : "s"} · ${when.toLocaleString("pt-BR")}`;
}

