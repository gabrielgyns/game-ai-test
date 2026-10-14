import { beforeEach, describe, expect, it } from "vitest";
import { CLASSES, CLASS_ORDER, type ClassId } from "./classes";
import { createEnemy, createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { grantXp, xpForLevel } from "./progression";
import { restoreGame, serializeGame } from "./save";
import {
  effectiveCooldown, learnRank, MAX_RANK, pointsAvailable, resetCost, resetTalents, SKILL_TREE, skillMods,
} from "./skillTree";
import { SKILLS, type SkillId } from "./skills";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { generateWorld } from "./worldgen";
import { World } from "./world";
import type { GameEvent } from "./events";

beforeEach(() => resetItemIds());

function run(world: World, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

/** Herói da classe com nível suficiente e os ranks pedidos já comprados. */
function hero(classId: ClassId, ranks: Partial<Record<SkillId, number>> = {}) {
  const world = new World();
  const p = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }, classId));
  p.progression!.level = 21;
  for (const [skill, n] of Object.entries(ranks) as [SkillId, number][]) {
    for (let i = 0; i < n; i++) expect(learnRank(world, p, skill)).toBe("ok");
  }
  p.health.baseMax = p.health.max = p.health.current = 5000;
  return { world, p };
}

const use = (world: World, p: ReturnType<typeof createPlayer>, skill: SkillId) => {
  p.abilities!.queuedSkill = skill;
  return run(world, 1 / 60);
};

describe("pontos e ranks", () => {
  it("cada classe tem 5 ranks para cada uma das 4 habilidades, com talentos no 3 e no 5", () => {
    for (const c of CLASS_ORDER) {
      for (const skill of CLASSES[c].skills) {
        const ranks = SKILL_TREE[skill];
        expect(ranks).toHaveLength(MAX_RANK);
        expect(ranks[2]!.mods.talent).toBeDefined();
        expect(ranks[4]!.mods.talent).toBeDefined();
      }
    }
  });

  it("um ponto por nível depois do primeiro, gasto em ordem e até o rank 5", () => {
    const world = generateWorld({ seed: 2 });
    const p = world.player!;
    expect(pointsAvailable(p)).toBe(0);
    expect(learnRank(world, p, "whirlwind")).toBe("noPoints");
    grantXp(world, p, xpForLevel(1) + xpForLevel(2)); // nível 3
    expect(pointsAvailable(p)).toBe(2);
    expect(learnRank(world, p, "whirlwind")).toBe("ok");
    expect(learnRank(world, p, "whirlwind")).toBe("ok");
    expect(learnRank(world, p, "whirlwind")).toBe("noPoints");
    expect(learnRank(world, p, "fireball")).toBe("notYours"); // não é do guerreiro
    p.progression!.level = 20;
    for (let i = 0; i < 3; i++) learnRank(world, p, "whirlwind");
    expect(learnRank(world, p, "whirlwind")).toBe("maxRank");
  });

  it("reiniciar devolve os pontos e custa ouro por nível", () => {
    const { world, p } = hero("warrior", { charge: 3 });
    p.wallet!.gold = 0;
    expect(resetTalents(world, p)).toBe("noGold");
    p.wallet!.gold = resetCost(p) + 5;
    const before = pointsAvailable(p);
    expect(resetTalents(world, p)).toBe("ok");
    expect(p.wallet!.gold).toBe(5);
    expect(pointsAvailable(p)).toBe(before + 3);
    expect(resetTalents(world, p)).toBe("nothing");
  });

  it("ranks somam os modificadores e reduzem a recarga", () => {
    const { p } = hero("warrior", { whirlwind: 4 });
    const m = skillMods(p, "whirlwind");
    expect(m.damage).toBeCloseTo(0.2);
    expect(m.radius).toBeCloseTo(0.75);
    expect(m.talents).toEqual(["whirlHeal"]);
    expect(effectiveCooldown(p, "whirlwind")).toBeCloseTo(SKILLS.whirlwind.cooldown - 1.5);
  });

  it("os ranks fazem a viagem pelo save", () => {
    const world = generateWorld({ seed: 6, classId: "mage" });
    const p = world.player!;
    p.progression!.level = 6;
    learnRank(world, p, "frostNova");
    learnRank(world, p, "frostNova");
    learnRank(world, p, "blink");
    const r = restoreGame(serializeGame(world, 6)).player!;
    expect(r.talents).toEqual({ frostNova: 2, blink: 1 });
    expect(pointsAvailable(r)).toBe(2);
  });
});

describe("talentos do Guerreiro", () => {
  it("Giro Largo e Lâmina Afiada aumentam raio e dano do Golpe Giratório", () => {
    const base = hero("warrior");
    const far = base.world.spawn((id) => createEnemy(id, "orc", { x: 3.9, y: 0, z: 0 }));
    use(base.world, base.p, "whirlwind");
    expect(far.health.current).toBe(far.health.max); // fora do raio base de 3,5 m

    const up = hero("warrior", { whirlwind: 2 });
    const far2 = up.world.spawn((id) => createEnemy(id, "orc", { x: 3.9, y: 0, z: 0 }));
    use(up.world, up.p, "whirlwind");
    expect(far2.health.current).toBeLessThan(far2.health.max);
  });

  it("Sede de Batalha cura por inimigo atingido e Redemoinho deixa vulnerável", () => {
    const { world, p } = hero("warrior", { whirlwind: 5 });
    const a = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    world.spawn((id) => createEnemy(id, "orc", { x: -1, y: 0, z: 0 }));
    p.health.current = 1000;
    use(world, p, "whirlwind");
    expect(p.health.current).toBeGreaterThan(1000 + 5000 * 0.03 * 2 - 1);
    expect(a.status!.vulnerableLeft).toBeGreaterThan(3.5);
    const hp = a.health.current;
    applyDamage(world, p, a, 20);
    expect(a.health.current).toBe(hp - 25);
  });

  it("Impacto atordoa quem a Investida atravessa: ele não ataca nem anda", () => {
    const { world, p } = hero("warrior", { charge: 3 });
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 0, y: 0, z: -3 }));
    p.abilities!.aimDirection = { x: 0, z: -1 };
    use(world, p, "charge");
    run(world, 0.3);
    expect(orc.status!.stunLeft).toBeGreaterThan(0.5);
    const at = { ...orc.transform.position };
    const events = run(world, 0.5);
    expect(events.some((e) => e.type === "windup" && e.source === orc.id)).toBe(false);
    expect(orc.transform.position).toEqual(at);
  });

  it("Rugido deixa os inimigos lentos e Ânimo cura", () => {
    const { world, p } = hero("warrior", { warcry: 5 });
    const goblin = world.spawn((id) => createEnemy(id, "goblin", { x: 5, y: 0, z: 0 }));
    p.health.current = 1000;
    use(world, p, "warcry");
    expect(goblin.status!.slowFactor).toBeCloseTo(0.6);
    expect(p.health.current).toBeCloseTo(2000, 0);
    expect(p.abilities!.damageBuff!.multiplier).toBeCloseTo(1.65);
    expect(p.abilities!.damageBuff!.timeLeft).toBeCloseTo(10, 0);
  });

  it("Pele de Ferro reduz o dano depois do Segundo Fôlego, e Último Suspiro dispara sozinho", () => {
    const { world, p } = hero("warrior", { secondWind: 5 });
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 30, y: 0, z: 0 }));
    p.health.current = 4000;
    use(world, p, "secondWind");
    expect(p.abilities!.guard?.reduction).toBe(0.4);
    const hp = p.health.current;
    applyDamage(world, orc, p, 100);
    expect(p.health.current).toBe(hp - 60);

    // Recarga pronta e vida crítica: dispara sozinho no passo seguinte.
    p.abilities!.skills.find((s) => s.id === "secondWind")!.cooldownLeft = 0;
    p.abilities!.guard = null;
    p.health.current = 1100;
    applyDamage(world, orc, p, 200); // fica abaixo de 20% de 5000
    const events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "skill" && e.skill === "secondWind")).toBe(true);
  });
});

describe("talentos do Arqueiro e do Mago", () => {
  it("Rajada dispara três flechas perfurantes que atordoam", () => {
    const { world, p } = hero("archer", { piercingShot: 5 });
    use(world, p, "piercingShot");
    const arrows = [...world.projectiles.values()].filter((x) => x.kind === "piercingArrow");
    expect(arrows).toHaveLength(3);
    expect(arrows.every((a) => a.stun === 0.8)).toBe(true);
  });

  it("Tempestade deixa a área ferindo, e Farpas deixa lento", () => {
    const { world, p } = hero("archer", { arrowRain: 5 });
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 0, y: 0, z: -7 }));
    orc.health.baseMax = orc.health.max = orc.health.current = 9999;
    p.abilities!.aimDirection = { x: 0, z: -1 };
    use(world, p, "arrowRain");
    expect(orc.status!.slowLeft).toBeGreaterThan(0);
    expect(world.hazards.size).toBe(1);
    const hp = orc.health.current;
    run(world, 1.1);
    expect(orc.health.current).toBeLessThan(hp);
  });

  it("Armadilha deixa lento quem estava perto e Contra-ataque dá dano depois do salto", () => {
    const { world, p } = hero("archer", { disengage: 5 });
    const goblin = world.spawn((id) => createEnemy(id, "goblin", { x: 1, y: 0, z: 0 }));
    use(world, p, "disengage");
    expect(goblin.status!.slowFactor).toBeCloseTo(0.4);
    run(world, 0.4);
    expect(p.abilities!.damageBuff?.multiplier).toBeCloseTo(1.5);
  });

  it("Olho de Águia soma crítico ao Foco e Tiro Certeiro zera a recarga do Tiro Perfurante", () => {
    const { world, p } = hero("archer", { focus: 5 });
    p.abilities!.skills.find((s) => s.id === "piercingShot")!.cooldownLeft = 5;
    use(world, p, "focus");
    expect(p.abilities!.damageBuff!.critBonus).toBe(25);
    expect(p.abilities!.skills.find((s) => s.id === "piercingShot")!.cooldownLeft).toBe(0);
  });

  it("Bola Dupla lança duas bolas que deixam fogo no chão", () => {
    const { world, p } = hero("mage", { fireball: 5 });
    use(world, p, "fireball");
    const balls = [...world.projectiles.values()].filter((x) => x.kind === "fireball");
    expect(balls).toHaveLength(2);
    expect(balls.every((b) => b.pool?.kind === "fire")).toBe(true);
    run(world, 2);
    expect(world.hazards.size).toBe(2);
  });

  it("Congelar atordoa e Estilhaços deixa vulnerável", () => {
    const { world, p } = hero("mage", { frostNova: 5 });
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 2, y: 0, z: 0 }));
    use(world, p, "frostNova");
    expect(orc.status!.stunLeft).toBeGreaterThan(1.3);
    expect(orc.status!.vulnerableBonus).toBe(0.3);
  });

  it("chefes resistem: atordoamento dura metade", () => {
    const world = generateWorld({ seed: 1, classId: "mage" });
    const p = world.player!;
    p.progression!.level = 10;
    for (let i = 0; i < 3; i++) learnRank(world, p, "frostNova");
    const king = [...world.enemies()].find((e) => e.archetype === "goblinKing")!;
    p.transform.position = { ...king.transform.position, x: king.transform.position.x + 2 };
    use(world, p, "frostNova");
    expect(king.status!.stunLeft).toBeCloseTo(0.75, 1);
  });

  it("Rastro Arcano explode na partida e Véu protege na chegada", () => {
    const { world, p } = hero("mage", { blink: 5 });
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    use(world, p, "blink");
    expect(slime.health.current).toBeLessThan(slime.health.max);
    expect(p.abilities!.shield?.amount).toBe(1000);
  });

  it("Retorno explode quando o Escudo Arcano acaba, e Mana Viva cura enquanto dura", () => {
    const { world, p } = hero("mage", { arcaneShield: 5 });
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 2, y: 0, z: 0 }));
    orc.ai!.aggroRange = 0;
    p.health.current = 1000;
    use(world, p, "arcaneShield");
    run(world, 1);
    expect(p.health.current).toBeGreaterThan(1100);
    const hp = orc.health.current;
    const events = run(world, 14);
    expect(events.some((e) => e.type === "shieldEnd")).toBe(true);
    expect(orc.health.current).toBeLessThan(hp);
  });
});
