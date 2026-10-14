import { isAlive } from "../components";
import { addItem } from "../inventory";
import { distanceXZ } from "../math";
import type { World } from "../world";

const PICKUP_RADIUS = 1.4;
const DROP_LIFETIME = 180;
const FULL_RETRY_SECONDS = 3;

/** Jogador coleta automaticamente os itens perto dele; drops antigos desaparecem. */
export function pickupSystem(world: World, dt: number): void {
  const player = world.player;
  const canPick = player !== undefined && isAlive(player) && player.inventory !== undefined;

  for (const drop of world.drops.values()) {
    drop.age += dt;
    if (drop.age > DROP_LIFETIME) {
      world.drops.delete(drop.id);
      continue;
    }
    if (!canPick || world.time < drop.blockedUntil) continue;
    if (distanceXZ(drop.position, player.transform.position) > PICKUP_RADIUS) continue;

    if (addItem(player.inventory!, drop.item)) {
      world.drops.delete(drop.id);
      world.emit({ type: "pickup", entity: player.id, itemId: drop.item.id, dropId: drop.id });
    } else {
      drop.blockedUntil = world.time + FULL_RETRY_SECONDS;
      world.emit({ type: "inventoryFull", entity: player.id });
    }
  }
}
