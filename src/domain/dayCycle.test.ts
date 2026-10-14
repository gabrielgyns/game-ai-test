import { describe, expect, it } from "vitest";
import { clockAt, DAY_LENGTH, daylight, dayPeriod, formatClock, START_HOUR, sunElevation, twilight } from "./dayCycle";

describe("ciclo de dia e noite", () => {
  it("o jogo começa de manhã, no dia 1", () => {
    const c = clockAt(0);
    expect(c.day).toBe(1);
    expect(c.hour).toBeCloseTo(START_HOUR);
    expect(dayPeriod(c.hour)).toBe("manhã");
  });

  it("um dia inteiro dura DAY_LENGTH segundos e o relógio dá a volta", () => {
    const later = clockAt(DAY_LENGTH);
    expect(later.day).toBe(2);
    expect(later.hour).toBeCloseTo(START_HOUR);
    // Uma hora do jogo = DAY_LENGTH / 24 segundos.
    expect(clockAt(DAY_LENGTH / 24).hour).toBeCloseTo(START_HOUR + 1);
    // Meia-noite do dia 1 para o dia 2.
    const toMidnight = ((24 - START_HOUR) / 24) * DAY_LENGTH;
    expect(clockAt(toMidnight - 1).day).toBe(1);
    expect(clockAt(toMidnight + 1).day).toBe(2);
  });

  it("o sol nasce às 6h, culmina ao meio-dia e se põe às 18h", () => {
    expect(sunElevation(6)).toBeCloseTo(0);
    expect(sunElevation(12)).toBeCloseTo(1);
    expect(sunElevation(18)).toBeCloseTo(0);
    expect(sunElevation(0)).toBeCloseTo(-1);
  });

  it("luz do dia é cheia à tarde, nula à meia-noite e intermediária no crepúsculo", () => {
    expect(daylight(13)).toBe(1);
    expect(daylight(0)).toBe(0);
    const dusk = daylight(18);
    expect(dusk).toBeGreaterThan(0.1);
    expect(dusk).toBeLessThan(0.9);
    // Monótona da madrugada ao meio-dia.
    let prev = -1;
    for (let h = 0; h <= 12; h += 0.5) {
      expect(daylight(h)).toBeGreaterThanOrEqual(prev);
      prev = daylight(h);
    }
  });

  it("o céu fica alaranjado só perto do nascer e do pôr do sol", () => {
    expect(twilight(6)).toBeCloseTo(1);
    expect(twilight(18)).toBeCloseTo(1);
    expect(twilight(12)).toBe(0);
    expect(twilight(0)).toBe(0);
  });

  it("formata o relógio para o HUD", () => {
    expect(formatClock(clockAt(0))).toBe("Dia 1 · 08:00");
    expect(formatClock(clockAt(DAY_LENGTH / 48))).toBe("Dia 1 · 08:30");
  });
});
