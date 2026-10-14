import type { Entity } from "./components";
import { entityLevel } from "./levels";
import { DUNGEON_REGION_X } from "./terrain";
import type { World } from "./world";

/**
 * Dificuldade do mundo, como no Minecraft Dungeons: o mesmo vale, numa volta mais forte. Cada nível
 * soma um bônus ao nível de todos os inimigos e chefes do mapa; vida, dano, XP e ouro crescem junto, e
 * o loot (que tem o nível de quem o derrubou) fica mais forte. Vencer os três chefes num nível destrava
 * o próximo. A cripta não muda: ela já acompanha o nível do herói.
 */
export interface WorldTierDefinition {
  id: number;
  name: string;
  levelBonus: number;
  description: string;
}

export const WORLD_TIERS: WorldTierDefinition[] = [
  { id: 1, name: "Aventureiro", levelBonus: 0, description: "O vale como ele é. Inimigos do nível 1 ao 12." },
  { id: 2, name: "Veterano", levelBonus: 10, description: "Inimigos 10 níveis acima, com loot à altura. Do nível 11 ao 22." },
  { id: 3, name: "Apocalipse", levelBonus: 20, description: "Inimigos 20 níveis acima. Do nível 21 ao 32." },
  { id: 4, name: "Pesadelo", levelBonus: 30, description: "O teto: inimigos 30 níveis acima. Do nível 31 ao 42." },
];

export const MAX_WORLD_TIER = WORLD_TIERS.length;
/** Os chefes do vale que destravam o próximo nível de dificuldade. */
export const TIER_BOSSES = ["goblinKing", "spiderQueen", "scorpionEmperor"] as const;

export interface WorldTierState {
  /** Nível em que o mundo está agora. */
  current: number;
  /** Maior nível já destravado. */
  unlocked: number;
  /** Chefes vencidos no maior nível destravado (os três destravam o seguinte). */
  defeated: string[];
}

export const newWorldTierState = (): WorldTierState => ({ current: 1, unlocked: 1, defeated: [] });

export function worldTierOf(world: World): WorldTierDefinition {
  const id = world.player?.worldTier?.current ?? 1;
  return WORLD_TIERS[Math.min(MAX_WORLD_TIER, Math.max(1, id)) - 1]!;
}

/** Quanto cada atributo cresce por nível acima do nível de origem da criatura. */
export const GROWTH = { health: 1.13, damage: 1.11, xp: 1.25, gold: 1.12 };

/**
 * Leva um inimigo para um nível, a partir dos números com que ele nasceu (guardados na primeira vez).
 * Escalar de novo para outro nível parte sempre da base, então trocar de dificuldade é reversível.
 */
export function scaleEnemyToLevel(e: Entity, level: number): void {
  e.tierBase ??= {
    level: entityLevel(e),
    maxHealth: e.health.baseMax,
    damage: e.combat.baseDamage,
    xp: e.ai?.xpReward ?? 0,
    gold: e.ai?.goldReward ?? 0,
  };
  const base = e.tierBase;
  const d = Math.max(0, level - base.level);
  const ratio = e.health.max > 0 ? e.health.current / e.health.max : 1;
  e.level = base.level + d;
  e.health.baseMax = e.health.max = Math.round(base.maxHealth * Math.pow(GROWTH.health, d));
  e.health.current = Math.max(e.health.current > 0 ? 1 : 0, Math.round(e.health.max * ratio));
  e.combat.baseDamage = e.combat.damage = Math.round(base.damage * Math.pow(GROWTH.damage, d));
  if (e.ai) {
    e.ai.xpReward = Math.round(base.xp * Math.pow(GROWTH.xp, d));
    e.ai.goldReward = Math.round(base.gold * Math.pow(GROWTH.gold, d));
  }
}

const inValley = (e: Entity) => e.transform.position.x < DUNGEON_REGION_X;

/** Ajusta uma criatura do vale (recém-nascida, como os lacaios de chefe) à dificuldade atual. */
export function scaleToWorldTier(world: World, e: Entity): void {
  if (e.kind !== "enemy" || !inValley(e)) return;
  const base = e.tierBase?.level ?? entityLevel(e);
  scaleEnemyToLevel(e, base + worldTierOf(world).levelBonus);
}

export type TierChange = "ok" | "locked" | "inDungeon" | "same";

/** Muda a dificuldade: só para níveis destravados e fora da cripta. Todo o vale é reescalado. */
export function setWorldTier(world: World, player: Entity, tier: number): TierChange {
  const state = (player.worldTier ??= newWorldTierState());
  if (tier < 1 || tier > state.unlocked) return "locked";
  if (world.dungeon) return "inDungeon";
  if (tier === state.current) return "same";
  state.current = tier;
  applyWorldTier(world);
  world.emit({ type: "worldTierChanged", tier });
  return "ok";
}

/** Reescala todos os inimigos do vale para a dificuldade atual (no boot e ao trocar). */
export function applyWorldTier(world: World): void {
  for (const e of world.entities.values()) scaleToWorldTier(world, e);
}

/** Conta a vitória sobre um chefe do vale; os três no maior nível destravam o próximo. */
export function recordBossKill(world: World, player: Entity, archetype: string): void {
  const state = (player.worldTier ??= newWorldTierState());
  if (!(TIER_BOSSES as readonly string[]).includes(archetype)) return;
  if (state.current !== state.unlocked || state.unlocked >= MAX_WORLD_TIER) return;
  if (state.defeated.includes(archetype)) return;
  state.defeated.push(archetype);
  if (state.defeated.length < TIER_BOSSES.length) return;
  state.unlocked++;
  state.defeated = [];
  world.emit({ type: "worldTierUnlocked", tier: state.unlocked });
}
