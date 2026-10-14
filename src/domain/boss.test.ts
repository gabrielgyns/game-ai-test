import { beforeEach, describe, expect, it } from "vitest";
import { createGoblinKing } from "./boss";
import { createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { stepWorld } from "./simulation";
import { seededRandom } from "./worldgen";
import { World } from "./world";

beforeEach(() => resetItemIds());

function setup(distance = 2.5) {
  const world = new World();
  world.random = seededRandom(3);
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }));
  const king = world.spawn((id) => createGoblinKing(id, { x: distance, y: 0, z: 0 }));
  return { world, player, king };
}

function run(world: World, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

describe("Rei Goblin", () => {
  it("engaja ao ver o jogador e telegrafa o Golpe Pesado com forma de círculo", () => {
    const { world, king } = setup();
    const events = run(world, 0.1);
    expect(events.some((e) => e.type === "bossEngage" && e.entity === king.id)).toBe(true);
    const windup = events.find((e) => e.type === "windup" && e.source === king.id);
    expect(windup && windup.type === "windup" ? windup.shape.kind : null).toBe("circle");
    expect(windup && windup.type === "windup" ? windup.patternName : null).toBe("Golpe Pesado");
  });

  it("Pisão acerta o jogador no raio e erra fora dele", () => {
    const { world, player, king } = setup(4.5); // dentro de 80% do raio 6, fora do melee 3,2
    run(world, 0.1);
    expect(king.combat.pending?.pattern.id).toBe("stomp");
    player.transform.position.x = -3; // 7,5 m de distância: fora do raio
    run(world, king.combat.windupLeft + 0.05);
    expect(player.health.current).toBe(player.health.max);

    // Segundo pisão depois do cooldown, agora ficando dentro.
    player.transform.position.x = 2;
    run(world, 7.5);
    expect(player.health.current).toBeLessThan(player.health.max);
  });

  it("muda de fase com a vida, libera a Investida Real e invoca lacaios na fase final", () => {
    const { world, king } = setup(8); // longe do melee: nada disponível na fase 1 além de andar
    run(world, 0.05);
    expect(king.boss!.phase).toBe(1);
    king.health.current = king.health.max * 0.5;
    let events = run(world, 0.05);
    expect(events).toContainEqual({ type: "bossPhase", entity: king.id, phase: 2 });
    expect(king.boss!.windupScale).toBeLessThan(1);

    king.health.current = king.health.max * 0.2;
    events = run(world, 0.05);
    expect(events).toContainEqual({ type: "bossPhase", entity: king.id, phase: 3 });
    const summon = events.find((e) => e.type === "bossSummon");
    expect(summon && summon.type === "bossSummon" ? summon.minions.length : 0).toBe(2);
    expect([...world.enemies()].filter((e) => e.archetype === "goblin")).toHaveLength(2);
    expect(king.combat.damage).toBe(Math.round(king.combat.baseDamage * 1.3));
    // Não invoca de novo.
    run(world, 1);
    expect([...world.enemies()].filter((e) => e.archetype === "goblin")).toHaveLength(2);
  });

  it("Investida Real avança em linha e acerta o jogador no caminho", () => {
    const { world, player, king } = setup(8);
    king.health.current = king.health.max * 0.5; // fase 2 libera a investida
    const events = run(world, 0.1);
    const windup = events.find((e) => e.type === "windup" && e.source === king.id);
    expect(windup && windup.type === "windup" ? windup.shape.kind : null).toBe("line");
    const startX = king.transform.position.x;
    run(world, king.combat.windupLeft + 0.6);
    expect(king.transform.position.x).toBeLessThan(startX - 5);
    expect(player.health.current).toBeLessThan(player.health.max);
  });

  it("ao morrer deixa loot épico garantido e renasce resetado", () => {
    const { world, player, king } = setup(2);
    king.health.current = 1;
    king.boss!.phase = 3;
    player.combat.wantsAttack = true;
    const events = stepWorld(world, 1 / 60);
    expect(events.filter((e) => e.type === "drop")).toHaveLength(3);
    // Parte pode ter sido coletada no mesmo tick (o jogador está colado no chefe).
    const items = [...[...world.drops.values()].map((d) => d.item), ...player.inventory!.items.filter((i) => i !== null)];
    expect(items.filter((i) => i.rarity === "epic").length).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.name === "Poção Grande" && i.quantity === 2)).toBe(true);
    expect(player.wallet!.gold).toBe(160);
    run(world, king.ai!.respawnSeconds + 1);
    expect(king.boss!.phase).toBe(1);
    expect(king.health.current).toBe(king.health.max);
  });
});
