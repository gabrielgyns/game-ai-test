import type { EntityId } from "./components";

export type GameEvent =
  | { type: "damage"; source: EntityId; target: EntityId; amount: number }
  | { type: "death"; entity: EntityId; killer?: EntityId }
  | { type: "xp"; entity: EntityId; amount: number }
  | { type: "levelUp"; entity: EntityId; level: number }
  | { type: "loot"; entity: EntityId; gold: number }
  | { type: "respawn"; entity: EntityId }
  | { type: "attack"; source: EntityId; target?: EntityId };
