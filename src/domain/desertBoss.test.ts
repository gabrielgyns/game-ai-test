import { beforeEach, describe, expect, it } from "vitest";
import { CARAPACE, createScorpionEmperor, SCORPION_EMPEROR_PATTERNS } from "./boss";
import { createEnemy, createPlayer } from "./factories";
import { ACID_POOL } from "./hazards";
import { resetItemIds } from "./items";
import { questById } from "./quests";
import { stepWorld } from "./simulation";
import { applyDamage, startAttack } from "./systems/combat";
import { DESERT_BOSS_HOME } from "./biomes";
import { generateWorld, seededRandom } from "./worldgen";
import { World } from "./world";
import type { GameEvent } from "./events";

beforeEach(() => resetItemIds());

function run(world: World, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

function setup(distance = 2.5) {
  const world = new World();
  world.random = seededRandom(11);
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  player.health.baseMax = player.health.max = player.health.current = 5000; // sobrevive ao teste
  const boss = world.spawn((id) => createScorpionEmperor(id, { x: distance, y: 0, z: 0 }));
  return { world, player, boss };
}

describe("poças no chão", () => {
  it("ferem em pulsos quem fica dentro, poupam quem está fora e somem no fim", () => {
    const { world, player, boss } = setup(30);
    const pool = world.addHazard(boss, ACID_POOL, { x: 0, y: 0, z: 0 });
    const hp0 = player.health.current;
    let events = run(world, 1.01);
    const pulses = events.filter((e) => e.type === "damage" && e.target === player.id);
    expect(pulses.length).toBe(2); // um pulso a cada 0,5 s
    expect(player.health.current).toBe(hp0 - pool.damage * 2);

    player.transform.position.x = 10; // saiu da poça
    const hp1 = player.health.current;
    events = run(world, 2);
    expect(player.health.current).toBe(hp1);

    events = run(world, ACID_POOL.duration);
    expect(events.some((e) => e.type === "hazardEnd" && e.hazardId === pool.id)).toBe(true);
    expect(world.hazards.size).toBe(0);
  });

  it("não ferem aliados do dono (outros inimigos)", () => {
    const { world, boss } = setup(30);
    const scorpion = world.spawn((id) => createEnemy(id, "scorpion", { x: 50, y: 0, z: 50 }));
    world.addHazard(boss, ACID_POOL, { ...scorpion.transform.position });
    run(world, 2);
    expect(scorpion.health.current).toBe(scorpion.health.max);
  });

  it("rolar por cima não gera 'esquivou' a cada pulso", () => {
    const { world, player, boss } = setup(30);
    world.addHazard(boss, ACID_POOL, { x: 0, y: 0, z: 0 });
    player.abilities!.dash = { kind: "roll", timeLeft: 5, duration: 5, direction: { x: 0, z: 0 }, speed: 0, invulnerable: true, damageMultiplier: 0, hitEntityIds: [] };
    const events = run(world, 1.2);
    expect(events.some((e) => e.type === "dodge")).toBe(false);
    expect(player.health.current).toBe(player.health.max);
  });
});

describe("Imperador Escorpião", () => {
  it("vive no tablado do deserto e tem quest do Guarda depois dos salteadores", () => {
    const world = generateWorld();
    const boss = [...world.enemies()].find((e) => e.archetype === "scorpionEmperor")!;
    expect(boss).toBeDefined();
    expect(Math.hypot(boss.transform.position.x - DESERT_BOSS_HOME.x, boss.transform.position.z - DESERT_BOSS_HOME.z)).toBeLessThan(1);
    const quest = questById("emperor")!;
    expect(quest.giver).toBe("guard");
    expect(quest.requires).toEqual(["bandits"]);
  });

  it("ergue a carapaça ao entrar em combate e ignora golpes básicos", () => {
    const { world, player, boss } = setup(2.5);
    const events = run(world, 0.05);
    expect(events.some((e) => e.type === "carapaceUp" && e.entity === boss.id)).toBe(true);
    const hp = boss.health.current;
    world.drainEvents();
    applyDamage(world, player, boss, 50);
    expect(boss.health.current).toBe(hp);
    expect(world.drainEvents().map((e) => e.type)).toContain("immune");
  });

  it("habilidades arrancam camadas com dano reduzido; a última parte a carapaça e atordoa", () => {
    const { world, player, boss } = setup(2.5);
    run(world, 0.05);
    const hp = boss.health.current;
    applyDamage(world, player, boss, 100, "skill");
    expect(boss.boss!.carapace!.layers).toBe(CARAPACE.layers - 1);
    expect(boss.health.current).toBe(hp - Math.round(100 * CARAPACE.skillDamageFraction));
    applyDamage(world, player, boss, 100, "skill");
    world.drainEvents();
    applyDamage(world, player, boss, 100, "skill");
    const events = world.drainEvents();
    expect(events.some((e) => e.type === "carapaceBreak")).toBe(true);
    expect(boss.boss!.carapace!.active).toBe(false);
    expect(boss.combat.windupLeft).toBe(0); // perdeu o golpe que preparava

    // Atordoado: não inicia golpes; vulnerável: golpe básico agora dói 50% a mais.
    const later = run(world, 1);
    expect(later.some((e) => e.type === "windup" && e.source === boss.id)).toBe(false);
    const before = boss.health.current;
    applyDamage(world, player, boss, 40);
    expect(boss.health.current).toBe(before - 60);

    // Passado o atordoamento, volta a lutar.
    const after = run(world, CARAPACE.stun);
    expect(after.some((e) => e.type === "windup" && e.source === boss.id)).toBe(true);
  });

  it("Golpe Giratório do jogador conta como habilidade contra a carapaça", () => {
    const { world, player, boss } = setup(2.5);
    run(world, 0.05);
    player.abilities!.queuedSkill = "whirlwind";
    run(world, 1 / 60);
    expect(boss.boss!.carapace!.layers).toBe(CARAPACE.layers - 1);
  });

  it("a carapaça se refaz na troca de fase", () => {
    const { world, player, boss } = setup(2.5);
    run(world, 0.05);
    for (let i = 0; i < CARAPACE.layers; i++) applyDamage(world, player, boss, 1, "skill");
    expect(boss.boss!.carapace!.active).toBe(false);
    boss.health.current = boss.health.max * 0.6; // abaixo de 65%: fase 2
    const events = run(world, CARAPACE.stun + 0.2);
    expect(events.some((e) => e.type === "bossPhase" && e.phase === 2)).toBe(true);
    expect(boss.boss!.carapace!.active).toBe(true);
    expect(boss.boss!.carapace!.layers).toBe(CARAPACE.layers);
  });

  it("Rajada de Espinhos avisa em cone e solta um leque de projéteis sem ajuda de mira", () => {
    const { world, boss } = setup(8);
    const fan = SCORPION_EMPEROR_PATTERNS.find((p) => p.kind === "fan")!;
    world.drainEvents();
    startAttack(world, boss, fan, fan.windup);
    const windup = world.drainEvents().find((e) => e.type === "windup");
    expect(windup && windup.type === "windup" && windup.shape.kind).toBe("cone");
    run(world, fan.windup + 0.02);
    const shots = [...world.projectiles.values()].filter((p) => p.owner === boss.id);
    expect(shots).toHaveLength(fan.count!);
    // Direções distintas, espalhadas na abertura, todas apontando para o lado do jogador (-X).
    const angles = shots.map((p) => Math.atan2(p.direction.z, p.direction.x));
    expect(new Set(angles.map((a) => a.toFixed(3))).size).toBe(fan.count);
    for (const p of shots) expect(p.direction.x).toBeLessThan(0);
  });

  it("Cuspe Ácido cai onde o jogador estava e deixa uma poça lá", () => {
    const { world, player, boss } = setup(10);
    const acid = SCORPION_EMPEROR_PATTERNS.find((p) => p.kind === "lob")!;
    startAttack(world, boss, acid, acid.windup);
    const target = { ...player.transform.position };
    player.transform.position.z = 8; // foge do ponto avisado
    run(world, acid.windup + 1.5);
    expect(world.hazards.size).toBe(1);
    const pool = [...world.hazards.values()][0]!;
    expect(Math.hypot(pool.position.x - target.x, pool.position.z - target.z)).toBeLessThan(0.6);
    expect(player.health.current).toBe(player.health.max); // fugiu a tempo
  });

  it("nas fases avançadas o cuspe vira vários globos, com aviso extra para cada um", () => {
    const { world, boss } = setup(10);
    boss.boss!.phase = 3;
    const acid = SCORPION_EMPEROR_PATTERNS.find((p) => p.kind === "lob")!;
    world.drainEvents();
    startAttack(world, boss, acid, acid.windup);
    const warnings = world.drainEvents().filter((e) => e.type === "groundWarning");
    expect(warnings).toHaveLength(4);
    run(world, acid.windup + 1.5);
    expect(world.hazards.size).toBe(5);
  });
});

describe("inimigos arqueiros", () => {
  it("atiram flechas avisadas por uma linha, e sair da linha evita", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const archer = world.spawn((id) => createEnemy(id, "banditArcher", { x: 11, y: 0, z: 0 }));
    archer.ai!.state = "chase";
    let events = run(world, 0.2);
    const windup = events.find((e) => e.type === "windup" && e.source === archer.id);
    expect(windup && windup.type === "windup" && windup.shape.kind).toBe("line");
    player.transform.position.z = 3; // passo para o lado
    events = run(world, 1.5);
    expect(events.some((e) => e.type === "projectileSpawn")).toBe(true);
    expect(events.some((e) => e.type === "damage" && e.target === player.id)).toBe(false);
  });

  it("parado na linha, a flecha acerta", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const archer = world.spawn((id) => createEnemy(id, "goblinArcher", { x: 9, y: 0, z: 0 }));
    archer.ai!.state = "chase";
    const events = run(world, 2);
    expect(events.some((e) => e.type === "damage" && e.target === player.id && e.source === archer.id)).toBe(true);
  });

  it("recuam quando o jogador chega perto, entre um tiro e outro", () => {
    const world = new World();
    world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
    const archer = world.spawn((id) => createEnemy(id, "banditArcher", { x: 3, y: 0, z: 0 }));
    archer.ai!.state = "attack";
    archer.combat.cooldownLeft = 2; // acabou de atirar
    run(world, 0.5);
    expect(archer.transform.position.x).toBeGreaterThan(4);
  });
});
