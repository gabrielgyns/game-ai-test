import type { GameEvent } from "./events";
import { abilitySystem } from "./systems/abilities";
import { aiSystem } from "./systems/ai";
import { combatSystem } from "./systems/combat";
import { movementSystem } from "./systems/movement";
import { pickupSystem } from "./systems/pickup";
import { projectileSystem } from "./systems/projectiles";
import { hazardSystem } from "./systems/hazards";
import { respawnSystem } from "./systems/respawn";
import type { World } from "./world";

/** Avança o mundo um passo e devolve os eventos gerados nesse passo. */
export function stepWorld(world: World, dt: number): GameEvent[] {
  world.time += dt;
  respawnSystem(world, dt);
  aiSystem(world, dt);
  abilitySystem(world, dt);
  movementSystem(world, dt);
  combatSystem(world, dt);
  projectileSystem(world, dt);
  hazardSystem(world, dt);
  pickupSystem(world, dt);
  return world.drainEvents();
}
