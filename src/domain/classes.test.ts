import { beforeEach, describe, expect, it } from "vitest";
import { CLASSES } from "./classes";
import { createEnemy, createPlayer } from "./factories";
import { resetItemIds } from "./items";
import { restoreGame, serializeGame } from "./save";
import { stepWorld } from "./simulation";
import { FIREBALL, PIERCING } from "./skills";
import { generateWorld, seededRandom } from "./worldgen";
import { World } from "./world";

beforeEach(() => resetItemIds());

function setup(classId: "warrior" | "archer" | "mage") {
  const world = new World();
  world.random = seededRandom(5);
  const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }, classId));
  player.abilities!.aimDirection = { x: 1, z: 0 }; // mira para +X
  return { world, player };
}

function run(world: World, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

describe("classes", () => {
  it("cada classe tem atributos, arma inicial e quatro habilidades próprias", () => {
    for (const c of Object.values(CLASSES)) {
      const { player } = setup(c.id);
      expect(player.health.max).toBe(c.baseMaxHealth);
      expect(player.combat.damage).toBe(c.baseDamage + 4);
      expect(player.equipment!.weapon?.name).toBe(c.starterWeapon().name);
      expect(player.abilities!.skills.map((s) => s.id)).toEqual(c.skills);
      expect(new Set(c.skills).size).toBe(4);
    }
  });

  it("arqueiro atira uma flecha que acerta um inimigo a 10 m; guerreiro não alcança", () => {
    const { world, player } = setup("archer");
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 10, y: 0, z: 0 }));
    orc.movement.speed = 0;
    player.combat.wantsAttack = true;
    const events = run(world, 0.6);
    expect(events.some((e) => e.type === "projectileSpawn")).toBe(true);
    expect(orc.health.current).toBe(orc.health.max - player.combat.damage);
    expect(world.projectiles.size).toBe(0);

    const w = setup("warrior");
    const far = w.world.spawn((id) => createEnemy(id, "orc", { x: 10, y: 0, z: 0 }));
    far.movement.speed = 0;
    w.player.combat.wantsAttack = true;
    run(w.world, 0.6);
    expect(far.health.current).toBe(far.health.max);
  });

  it("a ajuda de mira corrige a flecha para um inimigo dentro do cone", () => {
    const { world, player } = setup("archer");
    const target = world.spawn((id) => createEnemy(id, "orc", { x: 9, y: 0, z: 2.5 })); // ~15° fora da mira
    target.movement.speed = 0;
    player.combat.wantsAttack = true;
    run(world, 0.6);
    expect(target.health.current).toBeLessThan(target.health.max);
  });

  it("flecha some ao exceder o alcance sem acertar nada", () => {
    const { world, player } = setup("archer");
    player.combat.wantsAttack = true;
    stepWorld(world, 1 / 60);
    expect(world.projectiles.size).toBe(1);
    run(world, 1.2);
    expect(world.projectiles.size).toBe(0);
  });

  it("Tiro Perfurante atravessa dois inimigos em linha", () => {
    const { world, player } = setup("archer");
    const a = world.spawn((id) => createEnemy(id, "orc", { x: 5, y: 0, z: 0 }));
    const b = world.spawn((id) => createEnemy(id, "orc", { x: 9, y: 0, z: 0 }));
    a.movement.speed = b.movement.speed = 0;
    player.abilities!.queuedSkill = "piercingShot";
    run(world, 0.8);
    const dmg = Math.round(player.combat.damage * PIERCING.damageMultiplier);
    expect(a.health.current).toBe(a.health.max - dmg);
    expect(b.health.current).toBe(b.health.max - dmg);
  });

  it("Bola de Fogo explode e acerta todos no raio; Nova Gélida acerta em volta do mago", () => {
    const { world, player } = setup("mage");
    const a = world.spawn((id) => createEnemy(id, "orc", { x: 8, y: 0, z: 0 }));
    const b = world.spawn((id) => createEnemy(id, "orc", { x: 8, y: 0, z: 2 }));
    const far = world.spawn((id) => createEnemy(id, "orc", { x: 8, y: 0, z: 6 }));
    for (const e of [a, b, far]) e.movement.speed = 0;
    player.abilities!.queuedSkill = "fireball";
    const events = run(world, 1.0);
    const dmg = Math.round(player.combat.damage * FIREBALL.damageMultiplier);
    expect(a.health.current).toBe(a.health.max - dmg);
    expect(b.health.current).toBe(b.health.max - dmg);
    expect(far.health.current).toBe(far.health.max);
    expect(events.some((e) => e.type === "projectileHit" && e.explodeRadius > 0)).toBe(true);

    const near = world.spawn((id) => createEnemy(id, "slime", { x: 2, y: 0, z: 1 }));
    player.abilities!.queuedSkill = "frostNova";
    stepWorld(world, 1 / 60);
    expect(near.health.current).toBeLessThan(near.health.max);
  });

  it("Escudo Arcano absorve dano antes da vida e expira", () => {
    const { world, player } = setup("mage");
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1.5, y: 0, z: 0 }));
    player.abilities!.queuedSkill = "arcaneShield";
    stepWorld(world, 1 / 60);
    expect(player.abilities!.shield?.amount).toBe(Math.round(player.health.max * 0.6));
    const events = run(world, orc.combat.windupTime + 0.3);
    expect(events.some((e) => e.type === "shieldAbsorb")).toBe(true);
    expect(player.health.current).toBe(player.health.max);
    run(world, 10);
    expect(player.abilities!.shield).toBeNull();
  });

  it("Teleporte e Recuo Ágil deslocam o herói sem causar dano", () => {
    const m = setup("mage");
    const bystander = m.world.spawn((id) => createEnemy(id, "slime", { x: 3, y: 0, z: 0 }));
    m.player.abilities!.queuedSkill = "blink";
    run(m.world, 0.3);
    expect(m.player.transform.position.x).toBeGreaterThan(6);
    expect(bystander.health.current).toBe(bystander.health.max);

    const a = setup("archer");
    a.player.abilities!.queuedSkill = "disengage";
    run(a.world, 0.4);
    expect(a.player.transform.position.x).toBeLessThan(-4);
  });

  it("a classe sobrevive ao save e a saves antigos sem classe", () => {
    const world = generateWorld({ seed: 3, classId: "mage" });
    const save = serializeGame(world, 3);
    expect(save.player.classId).toBe("mage");
    const restored = restoreGame(save);
    expect(restored.player!.classId).toBe("mage");
    expect(restored.player!.abilities!.skills.map((s) => s.id)).toEqual(CLASSES.mage.skills);
    delete save.player.classId;
    expect(restoreGame(save).player!.classId).toBe("warrior");
  });
});
