import type { Vec2 } from "./math";

export type SkillId = "whirlwind" | "charge" | "warcry" | "secondWind";

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  cooldown: number;
  icon: string;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  whirlwind: {
    id: "whirlwind",
    name: "Golpe Giratório",
    description: "Gira a arma e acerta todos os inimigos num raio de 3,5 m por 150% do dano.",
    cooldown: 6,
    icon: "whirlwind",
  },
  charge: {
    id: "charge",
    name: "Investida",
    description: "Avança 7 m na direção da câmera, causando 120% do dano a quem atravessar.",
    cooldown: 9,
    icon: "charge",
  },
  warcry: {
    id: "warcry",
    name: "Grito de Guerra",
    description: "+50% de dano por 8 s.",
    cooldown: 20,
    icon: "warcry",
  },
  secondWind: {
    id: "secondWind",
    name: "Segundo Fôlego",
    description: "Recupera 35% da vida máxima na hora.",
    cooldown: 30,
    icon: "secondWind",
  },
};

/** Ordem na barra de habilidades (teclas 1 a 4). */
export const SKILL_BAR: SkillId[] = ["whirlwind", "charge", "warcry", "secondWind"];

export interface SkillState {
  id: SkillId;
  cooldownLeft: number;
}

/** Deslocamento rápido em curso (esquiva ou investida). */
export interface Dash {
  kind: "roll" | "charge";
  timeLeft: number;
  duration: number;
  direction: Vec2;
  /** Metros por segundo. */
  speed: number;
  /** Durante a esquiva o personagem não leva dano. */
  invulnerable: boolean;
  /** Investida: dano aplicado uma vez a cada inimigo atravessado. */
  damageMultiplier: number;
  hitEntityIds: number[];
}

export interface Abilities {
  skills: SkillState[];
  /** Habilidade pedida para este tick (consumida pelo sistema). */
  queuedSkill: SkillId | null;
  /** Esquiva pedida para este tick. */
  wantsRoll: boolean;
  /** Direção desejada para esquiva/investida (câmera ou movimento). */
  aimDirection: Vec2;
  dash: Dash | null;
  rollCooldownLeft: number;
  /** Buff de dano ativo (Grito de Guerra). */
  damageBuff: { multiplier: number; timeLeft: number } | null;
}

export const ROLL = { duration: 0.42, distance: 4.2, cooldown: 1.0 } as const;
export const CHARGE = { duration: 0.32, distance: 7, damageMultiplier: 1.2 } as const;
export const WHIRLWIND = { radius: 3.5, damageMultiplier: 1.5 } as const;
export const WARCRY = { multiplier: 1.5, duration: 8 } as const;
export const SECOND_WIND = { healFraction: 0.35 } as const;

export function createAbilities(): Abilities {
  return {
    skills: SKILL_BAR.map((id) => ({ id, cooldownLeft: 0 })),
    queuedSkill: null,
    wantsRoll: false,
    aimDirection: { x: 0, z: -1 },
    dash: null,
    rollCooldownLeft: 0,
    damageBuff: null,
  };
}

export function getSkill(abilities: Abilities, id: SkillId): SkillState | undefined {
  return abilities.skills.find((s) => s.id === id);
}
