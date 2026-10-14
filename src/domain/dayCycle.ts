import { clamp } from "./math";

/**
 * Relógio do mundo. Um dia inteiro dura `DAY_LENGTH` segundos de jogo (o tempo do mundo, que
 * para nas pausas e é salvo), então o horário volta junto com o save. O jogo começa de manhã.
 *
 * Analogia: um relógio de sol que gira 30 vezes mais rápido que o de verdade, e cuja sombra a
 * apresentação usa para pintar o céu e posicionar o sol e a lua.
 */
export const DAY_LENGTH = 720; // 12 min por dia: 1 hora do jogo = 30 s
export const START_HOUR = 8;

export interface Clock {
  /** Dia atual, começando em 1. */
  day: number;
  /** Hora fracionária, 0 ≤ hour < 24. */
  hour: number;
  /** Fração do dia, 0 = meia-noite, 0,5 = meio-dia. */
  phase: number;
}

export function clockAt(worldTime: number): Clock {
  const total = Math.max(0, worldTime) / DAY_LENGTH + START_HOUR / 24;
  const day = Math.floor(total) + 1;
  const phase = total - Math.floor(total);
  return { day, hour: phase * 24, phase };
}

/**
 * Altura do sol no céu, de -1 (meia-noite) a 1 (meio-dia); nasce às 6h e se põe às 18h.
 * A lua é o oposto (`-sunElevation`).
 */
export function sunElevation(hour: number): number {
  return Math.sin(((hour - 6) / 24) * Math.PI * 2);
}

/** Quanto de "dia" há no céu: 1 em pleno dia, 0 em plena noite, com transição no nascer e no pôr. */
export function daylight(hour: number): number {
  const e = sunElevation(hour);
  const t = clamp((e + 0.15) / 0.35, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Quanto o céu está alaranjado (nascer e pôr do sol): pico com o sol no horizonte. */
export function twilight(hour: number): number {
  const e = Math.abs(sunElevation(hour));
  return clamp(1 - e / 0.3, 0, 1);
}

export type DayPeriod = "madrugada" | "manhã" | "tarde" | "noite";

export function dayPeriod(hour: number): DayPeriod {
  if (hour < 5) return "madrugada";
  if (hour < 12) return "manhã";
  if (hour < 19) return "tarde";
  return "noite";
}

/** "Dia 3 · 14:30". */
export function formatClock(clock: Clock): string {
  const h = Math.floor(clock.hour);
  const m = Math.floor((clock.hour - h) * 60);
  return `Dia ${clock.day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
