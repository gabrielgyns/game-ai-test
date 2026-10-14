import type { Item } from "./items";
import type { SkillId } from "./skills";

export type ClassId = "warrior" | "archer" | "mage";

/** Como a classe desfere o ataque básico. */
export type AttackStyle = "melee" | "arrow" | "bolt";

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  /** Resumo em três palavras para a tela de escolha. */
  tagline: string;
  baseMaxHealth: number;
  baseDamage: number;
  speed: number;
  /** Alcance do ataque básico (melee: metros até o alvo; à distância: alcance do projétil). */
  attackRange: number;
  attackCooldown: number;
  attackStyle: AttackStyle;
  regenPerSecond: number;
  skills: SkillId[];
  starterWeapon: () => Item;
}

const starter = (name: string, icon: string, damage: number): Item => ({
  id: 0,
  name,
  kind: "equipment",
  slot: "weapon",
  rarity: "common",
  stats: { damage },
  icon,
  value: 1,
  quantity: 1,
  maxStack: 1,
});

export const CLASSES: Record<ClassId, ClassDefinition> = {
  warrior: {
    id: "warrior",
    name: "Guerreiro",
    tagline: "Aço, placas e coragem",
    description: "Luta de perto com espada e escudo de vida alta. Golpe Giratório contra grupos, Investida para fechar distância, Grito de Guerra e Segundo Fôlego para aguentar.",
    baseMaxHealth: 100,
    baseDamage: 10,
    speed: 7,
    attackRange: 2.4,
    attackCooldown: 0.55,
    attackStyle: "melee",
    regenPerSecond: 4,
    skills: ["whirlwind", "charge", "warcry", "secondWind"],
    starterWeapon: () => starter("Espada Velha", "sword", 4),
  },
  archer: {
    id: "archer",
    name: "Arqueiro",
    tagline: "Distância, precisão e fuga",
    description: "Atira flechas de longe e nunca para de se mover. Tiro Perfurante atravessa fileiras, Chuva de Flechas cobre uma área, Recuo Ágil abre espaço e Foco aumenta o dano.",
    baseMaxHealth: 80,
    baseDamage: 9,
    speed: 7.6,
    attackRange: 18,
    attackCooldown: 0.65,
    attackStyle: "arrow",
    regenPerSecond: 4,
    skills: ["piercingShot", "arrowRain", "disengage", "focus"],
    starterWeapon: () => starter("Arco Velho", "bow", 4),
  },
  mage: {
    id: "mage",
    name: "Mago",
    tagline: "Fogo, gelo e teleporte",
    description: "Frágil, mas devastador. Dispara raios arcanos, lança Bola de Fogo que explode, congela tudo em volta com Nova Gélida, Teleporta para fora do perigo e conjura um Escudo Arcano.",
    baseMaxHealth: 70,
    baseDamage: 13,
    speed: 7,
    attackRange: 16,
    attackCooldown: 0.6,
    attackStyle: "bolt",
    regenPerSecond: 5,
    skills: ["fireball", "frostNova", "blink", "arcaneShield"],
    starterWeapon: () => starter("Cajado Velho", "staff", 4),
  },
};

export const CLASS_ORDER: ClassId[] = ["warrior", "archer", "mage"];

export function isClassId(value: unknown): value is ClassId {
  return value === "warrior" || value === "archer" || value === "mage";
}
