import type { Vec2 } from "./math";

export type SkillId =
  | "whirlwind" | "charge" | "warcry" | "secondWind"
  | "piercingShot" | "arrowRain" | "disengage" | "focus"
  | "fireball" | "frostNova" | "blink" | "arcaneShield";

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
  // Arqueiro
  piercingShot: {
    id: "piercingShot",
    name: "Tiro Perfurante",
    description: "Flecha que atravessa todos os inimigos em linha por 200% do dano.",
    cooldown: 7,
    icon: "piercingShot",
  },
  arrowRain: {
    id: "arrowRain",
    name: "Chuva de Flechas",
    description: "Flechas caem numa área de 3,5 m a 7 m à frente, causando 130% do dano a cada inimigo.",
    cooldown: 9,
    icon: "arrowRain",
  },
  disengage: {
    id: "disengage",
    name: "Recuo Ágil",
    description: "Salta 5 m para trás, invulnerável durante o salto.",
    cooldown: 6,
    icon: "disengage",
  },
  focus: {
    id: "focus",
    name: "Foco",
    description: "+40% de dano por 8 s.",
    cooldown: 18,
    icon: "focus",
  },
  // Mago
  fireball: {
    id: "fireball",
    name: "Bola de Fogo",
    description: "Projétil lento que explode num raio de 2,8 m por 220% do dano.",
    cooldown: 6,
    icon: "fireball",
  },
  frostNova: {
    id: "frostNova",
    name: "Nova Gélida",
    description: "Explosão de gelo num raio de 4 m em volta de você por 140% do dano.",
    cooldown: 8,
    icon: "frostNova",
  },
  blink: {
    id: "blink",
    name: "Teleporte",
    description: "Salta 7 m na direção da câmera num piscar de olhos.",
    cooldown: 7,
    icon: "blink",
  },
  arcaneShield: {
    id: "arcaneShield",
    name: "Escudo Arcano",
    description: "Absorve até 60% da vida máxima em dano por 10 s.",
    cooldown: 22,
    icon: "arcaneShield",
  },
};

/** Barra padrão (guerreiro). As classes definem a própria em classes.ts. */
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
  /** Buff de dano ativo (Grito de Guerra, Foco). */
  damageBuff: { multiplier: number; timeLeft: number } | null;
  /** Escudo que absorve dano antes da vida (Escudo Arcano). */
  shield: { amount: number; timeLeft: number } | null;
}

export const ROLL = { duration: 0.42, distance: 4.2, cooldown: 1.0 } as const;
export const CHARGE = { duration: 0.32, distance: 7, damageMultiplier: 1.2 } as const;
export const WHIRLWIND = { radius: 3.5, damageMultiplier: 1.5 } as const;
export const WARCRY = { multiplier: 1.5, duration: 8 } as const;
export const SECOND_WIND = { healFraction: 0.35 } as const;
export const PIERCING = { damageMultiplier: 2.0, range: 20 } as const;
export const ARROW_RAIN = { distance: 7, radius: 3.5, damageMultiplier: 1.3 } as const;
export const DISENGAGE = { duration: 0.3, distance: 5 } as const;
export const FOCUS = { multiplier: 1.4, duration: 8 } as const;
export const FIREBALL = { damageMultiplier: 2.2, radius: 2.8, range: 16 } as const;
export const FROST_NOVA = { radius: 4, damageMultiplier: 1.4 } as const;
export const BLINK = { duration: 0.12, distance: 7 } as const;
export const ARCANE_SHIELD = { fraction: 0.6, duration: 10 } as const;

export function createAbilities(skillIds: SkillId[] = SKILL_BAR): Abilities {
  return {
    skills: skillIds.map((id) => ({ id, cooldownLeft: 0 })),
    queuedSkill: null,
    wantsRoll: false,
    aimDirection: { x: 0, z: -1 },
    dash: null,
    rollCooldownLeft: 0,
    damageBuff: null,
    shield: null,
  };
}

export function getSkill(abilities: Abilities, id: SkillId): SkillState | undefined {
  return abilities.skills.find((s) => s.id === id);
}
