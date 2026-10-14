import { describe, expect, it } from "vitest";
import { CELL_SIZE, STEP_HEIGHT, terrainHeight, WORLD_HALF } from "./terrain";

describe("terreno em blocos", () => {
  it("é plano no centro, onde o jogador nasce", () => {
    expect(terrainHeight(0, 0)).toBe(0);
    expect(terrainHeight(5, -5)).toBe(0);
  });

  it("é constante dentro de uma célula e quantizado em degraus", () => {
    const samples: [number, number][] = [[40.1, 33.2], [-77.7, 12.4], [60.9, -90.1]];
    for (const [x, z] of samples) {
      const base = terrainHeight(x, z);
      const cellX = Math.floor(x / CELL_SIZE) * CELL_SIZE;
      const cellZ = Math.floor(z / CELL_SIZE) * CELL_SIZE;
      expect(terrainHeight(cellX + 0.01, cellZ + 0.01)).toBe(base);
      expect(terrainHeight(cellX + CELL_SIZE - 0.01, cellZ + CELL_SIZE - 0.01)).toBe(base);
      expect(Math.abs((base / STEP_HEIGHT) % 1)).toBeLessThan(1e-9);
    }
  });

  it("sobe nas bordas do mundo", () => {
    expect(terrainHeight(WORLD_HALF - 1, 0)).toBeGreaterThan(5);
  });
});
