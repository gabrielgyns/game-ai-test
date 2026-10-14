import { describe, expect, it } from "vitest";
import { attenuate, CameraShake, traumaFromDamage } from "./shake";

describe("tremor de câmera", () => {
  it("sem trauma, a câmera fica parada", () => {
    const s = new CameraShake();
    expect(s.update(0.016)).toEqual({ x: 0, y: 0, roll: 0 });
  });

  it("trauma soma até 1 e decai sozinho até zero", () => {
    const s = new CameraShake();
    s.add(0.7);
    s.add(0.7);
    expect(s.trauma).toBe(1);
    for (let i = 0; i < 120; i++) s.update(1 / 60);
    expect(s.trauma).toBe(0);
  });

  it("o tremor cresce com o quadrado do trauma e respeita os limites", () => {
    const peak = (trauma: number) => {
      const s = new CameraShake();
      let max = 0;
      for (let i = 0; i < 30; i++) {
        s.trauma = trauma; // mantém o nível para medir a amplitude
        const o = s.update(1 / 60);
        max = Math.max(max, Math.abs(o.x), Math.abs(o.y));
        expect(Math.abs(o.roll)).toBeLessThanOrEqual(CameraShake.MAX_ROLL);
      }
      return max;
    };
    const weak = peak(0.3);
    const strong = peak(0.9);
    expect(strong).toBeGreaterThan(weak * 4);
    expect(strong).toBeLessThanOrEqual(CameraShake.MAX_OFFSET);
  });

  it("o ajuste do jogador em 0 desliga o tremor", () => {
    const s = new CameraShake();
    s.intensity = 0;
    s.add(1);
    expect(s.update(1 / 60)).toEqual({ x: 0, y: 0, roll: 0 });
  });

  it("golpes maiores tremem mais, e impactos longe tremem menos", () => {
    expect(traumaFromDamage(30, 100)).toBeGreaterThan(traumaFromDamage(5, 100));
    expect(traumaFromDamage(999, 100)).toBeLessThanOrEqual(0.65);
    expect(attenuate(0.5, 0)).toBe(0.5);
    expect(attenuate(0.5, 9)).toBeLessThan(0.5);
    expect(attenuate(0.5, 30)).toBe(0);
  });
});
