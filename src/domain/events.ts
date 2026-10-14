import type { EntityId } from "./components";
import type { EquipSlot } from "./items";
import type { SkillId } from "./skills";

export type GameEvent =
  | { type: "damage"; source: EntityId; target: EntityId; amount: number }
  | { type: "death"; entity: EntityId; killer?: EntityId }
  | { type: "xp"; entity: EntityId; amount: number }
  | { type: "levelUp"; entity: EntityId; level: number }
  | { type: "loot"; entity: EntityId; gold: number }
  | { type: "respawn"; entity: EntityId }
  | { type: "attack"; source: EntityId; target?: EntityId }
  | { type: "windup"; source: EntityId; duration: number }
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
  | { type: "buffEnd"; entity: EntityId };
