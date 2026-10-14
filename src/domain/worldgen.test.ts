import { describe, expect, it } from "vitest";
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
    for (const e of enemies) {
      expect(Math.abs(e.transform.position.x)).toBeLessThan(WORLD_HALF);
      expect(Math.abs(e.transform.position.z)).toBeLessThan(WORLD_HALF);
    }
  });
});
