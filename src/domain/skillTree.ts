import type { Entity } from "./components";
import { SKILLS, type SkillId } from "./skills";
import type { World } from "./world";

/**
 * Árvore de habilidades: cada uma das 4 habilidades da classe tem 5 ranks, comprados em ordem com
 * pontos ganhos ao subir de nível (1 por nível a partir do 2). Ranks 1, 2 e 4 melhoram números;
 * ranks 3 e 5 são talentos que mudam o jeito de jogar (atordoar, congelar, deixar fogo no chão...).
 *
 * Analogia: cada habilidade é um instrumento. Os ranks numéricos afinam; os talentos ensinam uma
 * música nova.
 */
export type TalentId =
  | "whirlHeal" | "whirlVuln" | "chargeStun" | "chargeBuff" | "warcrySlow" | "warcryHeal" | "ironSkin" | "lastStand"
  | "pierceStun" | "pierceVolley" | "rainSlow" | "rainStorm" | "disengageTrap" | "disengageBuff" | "focusCrit" | "focusReset"
  | "fireballPool" | "fireballTwin" | "novaFreeze" | "novaShatter" | "blinkBlast" | "blinkShield" | "shieldNova" | "shieldRegen";

/** O que um rank soma à habilidade. Números são somados entre os ranks comprados. */
export interface SkillMods {
  /** Dano extra, somado ao multiplicador (0,2 = +20%). */
  damage: number;
  /** Segundos a menos de recarga. */
  cooldown: number;
  /** Metros a mais de raio. */
  radius: number;
  /** Metros a mais de deslocamento. */
  distance: number;
  /** Segundos a mais de duração (buffs, escudos). */
  duration: number;
  /** Bônus somado ao multiplicador de buff (0,15 = +15 pontos). */
  buff: number;
  /** Fração extra de cura ou absorção. */
  heal: number;
  talents: TalentId[];
}

export interface SkillRank {
  name: string;
  description: string;
  mods: Partial<Omit<SkillMods, "talents">> & { talent?: TalentId };
}

export const MAX_RANK = 5;
/** Ouro por nível do herói para reiniciar a árvore. */
export const RESET_COST_PER_LEVEL = 30;

export const SKILL_TREE: Record<SkillId, SkillRank[]> = {
  // ---------- Guerreiro ----------
  whirlwind: [
    { name: "Lâmina Afiada", description: "+20% de dano.", mods: { damage: 0.2 } },
    { name: "Giro Largo", description: "+0,75 m de raio.", mods: { radius: 0.75 } },
    { name: "Sede de Batalha", description: "Cada inimigo atingido cura 3% da sua vida máxima.", mods: { talent: "whirlHeal" } },
    { name: "Fôlego de Giro", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Redemoinho", description: "Inimigos atingidos ficam vulneráveis (+25% de dano recebido) por 4 s.", mods: { talent: "whirlVuln" } },
  ],
  charge: [
    { name: "Ombro de Aço", description: "+25% de dano.", mods: { damage: 0.25 } },
    { name: "Arrancada", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Impacto", description: "Atordoa por 1,2 s quem você atravessar.", mods: { talent: "chargeStun" } },
    { name: "Longo Alcance", description: "+2,5 m de distância.", mods: { distance: 2.5 } },
    { name: "Ímpeto", description: "+30% de dano por 4 s depois da investida.", mods: { talent: "chargeBuff" } },
  ],
  warcry: [
    { name: "Voz Firme", description: "+2 s de duração.", mods: { duration: 2 } },
    { name: "Brado", description: "+15% de bônus de dano.", mods: { buff: 0.15 } },
    { name: "Rugido", description: "Inimigos a até 7 m ficam 40% mais lentos por 5 s.", mods: { talent: "warcrySlow" } },
    { name: "Fôlego Curto", description: "-5 s de recarga.", mods: { cooldown: 5 } },
    { name: "Ânimo", description: "O grito também cura 20% da vida máxima.", mods: { talent: "warcryHeal" } },
  ],
  secondWind: [
    { name: "Respiração", description: "+10% de cura.", mods: { heal: 0.1 } },
    { name: "Recuperação", description: "-6 s de recarga.", mods: { cooldown: 6 } },
    { name: "Pele de Ferro", description: "Depois de curar, -40% de dano recebido por 5 s.", mods: { talent: "ironSkin" } },
    { name: "Vigor", description: "+10% de cura.", mods: { heal: 0.1 } },
    { name: "Último Suspiro", description: "Ativa sozinho quando a vida cai abaixo de 20% (se estiver pronto).", mods: { talent: "lastStand" } },
  ],
  // ---------- Arqueiro ----------
  piercingShot: [
    { name: "Ponta de Aço", description: "+25% de dano.", mods: { damage: 0.25 } },
    { name: "Mão Rápida", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Flecha Pesada", description: "Atordoa por 0,8 s cada inimigo atravessado.", mods: { talent: "pierceStun" } },
    { name: "Tensão Máxima", description: "+25% de dano.", mods: { damage: 0.25 } },
    { name: "Rajada", description: "Dispara três flechas perfurantes em leque.", mods: { talent: "pierceVolley" } },
  ],
  arrowRain: [
    { name: "Nuvem Larga", description: "+0,75 m de raio.", mods: { radius: 0.75 } },
    { name: "Pontas Serrilhadas", description: "+20% de dano.", mods: { damage: 0.2 } },
    { name: "Farpas", description: "Inimigos atingidos ficam 50% mais lentos por 3 s.", mods: { talent: "rainSlow" } },
    { name: "Aljava Cheia", description: "-2 s de recarga.", mods: { cooldown: 2 } },
    { name: "Tempestade", description: "A área continua ferindo por 3 s.", mods: { talent: "rainStorm" } },
  ],
  disengage: [
    { name: "Reflexo", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Salto Longo", description: "+2 m de distância.", mods: { distance: 2 } },
    { name: "Armadilha", description: "Inimigos a até 3,5 m de onde você saltou ficam 60% mais lentos por 3 s.", mods: { talent: "disengageTrap" } },
    { name: "Pernas Leves", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Contra-ataque", description: "+50% de dano por 3 s depois do salto.", mods: { talent: "disengageBuff" } },
  ],
  focus: [
    { name: "Respiração Calma", description: "+3 s de duração.", mods: { duration: 3 } },
    { name: "Mira Fina", description: "+15% de bônus de dano.", mods: { buff: 0.15 } },
    { name: "Olho de Águia", description: "+25% de chance de crítico durante o Foco.", mods: { talent: "focusCrit" } },
    { name: "Concentração", description: "-5 s de recarga.", mods: { cooldown: 5 } },
    { name: "Tiro Certeiro", description: "Ativar o Foco zera a recarga do Tiro Perfurante.", mods: { talent: "focusReset" } },
  ],
  // ---------- Mago ----------
  fireball: [
    { name: "Chama Viva", description: "+25% de dano.", mods: { damage: 0.25 } },
    { name: "Combustão", description: "+0,8 m de raio da explosão.", mods: { radius: 0.8 } },
    { name: "Chão em Chamas", description: "A explosão deixa fogo no chão por 3 s.", mods: { talent: "fireballPool" } },
    { name: "Conjuração Rápida", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Bola Dupla", description: "Lança duas bolas de fogo em leque.", mods: { talent: "fireballTwin" } },
  ],
  frostNova: [
    { name: "Frio Cortante", description: "+20% de dano.", mods: { damage: 0.2 } },
    { name: "Inverno", description: "+1 m de raio.", mods: { radius: 1 } },
    { name: "Congelar", description: "Atordoa por 1,5 s quem for atingido.", mods: { talent: "novaFreeze" } },
    { name: "Gelo Rápido", description: "-2 s de recarga.", mods: { cooldown: 2 } },
    { name: "Estilhaços", description: "Inimigos atingidos ficam vulneráveis (+30% de dano recebido) por 4 s.", mods: { talent: "novaShatter" } },
  ],
  blink: [
    { name: "Piscar", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Passo Longo", description: "+2,5 m de distância.", mods: { distance: 2.5 } },
    { name: "Rastro Arcano", description: "Explode em 2,5 m no ponto de partida (90% do dano).", mods: { talent: "blinkBlast" } },
    { name: "Fase Curta", description: "-1,5 s de recarga.", mods: { cooldown: 1.5 } },
    { name: "Véu", description: "Ganha um escudo de 20% da vida máxima por 4 s ao chegar.", mods: { talent: "blinkShield" } },
  ],
  arcaneShield: [
    { name: "Camada Extra", description: "+15% de absorção.", mods: { heal: 0.15 } },
    { name: "Persistência", description: "+4 s de duração.", mods: { duration: 4 } },
    { name: "Retorno", description: "Quando o escudo acaba, explode em 4 m por 150% do dano.", mods: { talent: "shieldNova" } },
    { name: "Tecelagem", description: "-6 s de recarga.", mods: { cooldown: 6 } },
    { name: "Mana Viva", description: "Regenera 3% da vida máxima por segundo enquanto o escudo dura.", mods: { talent: "shieldRegen" } },
  ],
};

export type TalentRanks = Partial<Record<SkillId, number>>;

export function rankOf(e: Entity, skill: SkillId): number {
  return Math.min(MAX_RANK, Math.max(0, e.talents?.[skill] ?? 0));
}

/** Pontos ganhos até agora: um por nível depois do primeiro. */
export function pointsEarned(e: Entity): number {
  return Math.max(0, (e.progression?.level ?? 1) - 1);
}

export function pointsSpent(e: Entity): number {
  return Object.values(e.talents ?? {}).reduce((n, r) => n + (r ?? 0), 0);
}

export function pointsAvailable(e: Entity): number {
  return Math.max(0, pointsEarned(e) - pointsSpent(e));
}

/** Soma o que os ranks comprados dão a uma habilidade. */
export function skillMods(e: Entity, skill: SkillId): SkillMods {
  const mods: SkillMods = { damage: 0, cooldown: 0, radius: 0, distance: 0, duration: 0, buff: 0, heal: 0, talents: [] };
  const ranks = SKILL_TREE[skill].slice(0, rankOf(e, skill));
  for (const r of ranks) {
    const m = r.mods;
    mods.damage += m.damage ?? 0;
    mods.cooldown += m.cooldown ?? 0;
    mods.radius += m.radius ?? 0;
    mods.distance += m.distance ?? 0;
    mods.duration += m.duration ?? 0;
    mods.buff += m.buff ?? 0;
    mods.heal += m.heal ?? 0;
    if (m.talent) mods.talents.push(m.talent);
  }
  return mods;
}

export function hasTalent(e: Entity, skill: SkillId, talent: TalentId): boolean {
  return skillMods(e, skill).talents.includes(talent);
}

/** Recarga efetiva: base menos ranks, depois a redução percentual do equipamento. */
export function effectiveCooldown(e: Entity, skill: SkillId): number {
  const base = Math.max(1, SKILLS[skill].cooldown - skillMods(e, skill).cooldown);
  return base * (1 - (e.bonuses?.cooldownPercent ?? 0) / 100);
}

export type LearnResult = "ok" | "noPoints" | "maxRank" | "notYours";

/** Compra o próximo rank da habilidade. */
export function learnRank(world: World, e: Entity, skill: SkillId): LearnResult {
  if (!e.abilities?.skills.some((s) => s.id === skill)) return "notYours";
  const rank = rankOf(e, skill);
  if (rank >= MAX_RANK) return "maxRank";
  if (pointsAvailable(e) <= 0) return "noPoints";
  e.talents = { ...(e.talents ?? {}), [skill]: rank + 1 };
  world.emit({ type: "talentLearned", entity: e.id, skill, rank: rank + 1 });
  return "ok";
}

export function resetCost(e: Entity): number {
  return RESET_COST_PER_LEVEL * (e.progression?.level ?? 1);
}

/** Devolve todos os pontos, por ouro. */
export function resetTalents(world: World, e: Entity): "ok" | "noGold" | "nothing" {
  if (pointsSpent(e) === 0) return "nothing";
  const cost = resetCost(e);
  if (!e.wallet || e.wallet.gold < cost) return "noGold";
  e.wallet.gold -= cost;
  e.talents = {};
  world.emit({ type: "talentReset", entity: e.id, gold: cost });
  return "ok";
}
