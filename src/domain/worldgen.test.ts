import { describe, expect, it } from "vitest";
import { zoneAt } from "./zones";
import { generateWorld } from "./worldgen";
import { WORLD_HALF } from "./terrain";

describe("geração de mundo", () => {
  it("é determinística para a mesma seed", () => {
    const a = [...generateWorld({ seed: 7 }).enemies()].map((e) => e.transform.position);
    const b = [...generateWorld({ seed: 7 }).enemies()].map((e) => e.transform.position);
    expect(a).toEqual(b);
  });

  it("cria jogador e inimigos dentro dos limites do mundo", () => {
    const world = generateWorld();
    expect(world.player).toBeDefined();
    const enemies = [...world.enemies()];
    expect(enemies.length).toBeGreaterThan(20);
    // Cada inimigo fica dentro do quadrado da zona onde nasceu (vale ou floresta).
    for (const e of enemies) {
      const zone = zoneAt(e.transform.position.x, e.transform.position.z);
      expect(Math.abs(e.transform.position.x - zone.center.x)).toBeLessThan(WORLD_HALF);
      expect(Math.abs(e.transform.position.z - zone.center.z)).toBeLessThan(WORLD_HALF);
    }
  });
});
