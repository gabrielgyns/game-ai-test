import type { EntityId } from "./components";
import type { EquipSlot } from "./items";
import type { SkillId } from "./skills";
import type { TelegraphShape } from "./boss";

export type GameEvent =
  | { type: "damage"; source: EntityId; target: EntityId; amount: number; crit?: boolean }
  | { type: "death"; entity: EntityId; killer?: EntityId }
  | { type: "xp"; entity: EntityId; amount: number }
  | { type: "levelUp"; entity: EntityId; level: number }
  | { type: "loot"; entity: EntityId; gold: number }
  | { type: "respawn"; entity: EntityId }
  | { type: "attack"; source: EntityId; target?: EntityId }
  | { type: "windup"; source: EntityId; duration: number; shape: TelegraphShape; patternName?: string }
  | { type: "bossEngage"; entity: EntityId }
  | { type: "bossPhase"; entity: EntityId; phase: number }
  | { type: "bossSummon"; entity: EntityId; minions: EntityId[] }
  | { type: "questAccepted"; entity: EntityId; questId: string }
  | { type: "questProgress"; entity: EntityId; questId: string; progress: number; count: number }
  | { type: "questReady"; entity: EntityId; questId: string }
  | { type: "questCompleted"; entity: EntityId; questId: string; gold: number; xp: number; itemNames: string[] }
  | { type: "drop"; dropId: number }
  | { type: "pickup"; entity: EntityId; itemId: number; dropId: number }
  | { type: "inventoryFull"; entity: EntityId }
  | { type: "equip"; entity: EntityId; itemId: number; slot: EquipSlot }
  | { type: "unequip"; entity: EntityId; itemId: number; slot: EquipSlot }
  | { type: "consume"; entity: EntityId; itemId: number }
  | { type: "heal"; entity: EntityId; amount: number }
  | { type: "skill"; entity: EntityId; skill: SkillId; hits: number }
  | { type: "roll"; entity: EntityId }
  | { type: "dodge"; entity: EntityId; source: EntityId }
  | { type: "buffEnd"; entity: EntityId }
  | { type: "projectileSpawn"; projectileId: number }
  | { type: "projectileHit"; projectileId: number; target?: EntityId; position: { x: number; y: number; z: number }; explodeRadius: number }
  | { type: "shieldAbsorb"; entity: EntityId; amount: number }
  | { type: "shieldEnd"; entity: EntityId }
  /** Golpe comum contra a Carapaça de Areia: não faz nada. */
  | { type: "immune"; entity: EntityId; source: EntityId }
  | { type: "carapaceHit"; entity: EntityId; layersLeft: number }
  | { type: "carapaceBreak"; entity: EntityId; stun: number }
  | { type: "carapaceUp"; entity: EntityId; layers: number }
  | { type: "status"; entity: EntityId; effect: "stun" | "slow" | "vulnerable"; seconds: number }
  | { type: "talentLearned"; entity: EntityId; skill: SkillId; rank: number }
  | { type: "talentReset"; entity: EntityId; gold: number }
  | { type: "dungeonEnter"; level: number; rooms: number }
  | { type: "dungeonExit"; reason: "complete" | "leave" | "failed" }
  | { type: "dungeonLifeLost"; livesLeft: number }
  | { type: "roomCleared"; cleared: number; total: number }
  | { type: "dungeonComplete"; level: number }
  | { type: "worldTierChanged"; tier: number }
  | { type: "worldTierUnlocked"; tier: number }
  | { type: "chestOpened"; gold: number; items: string[] }
  | { type: "sell"; entity: EntityId; itemName: string; gold: number }
  | { type: "buy"; entity: EntityId; itemName: string; gold: number }
  | { type: "hazardSpawn"; hazardId: number }
  | { type: "hazardEnd"; hazardId: number }
  /** Aviso extra no chão (ex.: onde cada globo ácido vai cair). */
  | { type: "groundWarning"; at: { x: number; y: number; z: number }; radius: number; duration: number };
