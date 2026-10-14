import type { EntityId } from "./components";
import type { EquipSlot } from "./items";
import type { SkillId } from "./skills";
import type { TelegraphShape } from "./boss";

export type GameEvent =
  | { type: "damage"; source: EntityId; target: EntityId; amount: number }
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
  | { type: "shieldEnd"; entity: EntityId };
