import { beforeEach, describe, expect, it } from "vitest";
import { activeSetBonuses, createSetPiece, equippedSetCounts, pickSetSlot, SETS, setForBoss, type SetId } from "./sets";
import { createEnemy, createPlayer } from "./factories";
import { recomputeStats } from "./inventory";
import { resetItemIds } from "./items";
import { World } from "./world";
import { applyDamage, SET_POWERS } from "./systems/combat";
import { createGoblinKing } from "./boss";
import { speedFactor } from "./status";
import { restoreGame, serializeGame } from "./save";
import { generateWorld } from "./worldgen";

beforeEach(() => resetItemIds());

const at = { x: 0, y: 0, z: 0 };

function hero(setId?: SetId, pieces = 3) {
  const world = new World();
  const p = world.spawn((id) => createPlayer(id, at, "warrior"));
  if (setId) {
    const slots = (["weapon", "armor", "accessory"] as const).slice(0, pieces);
    for (const slot of slots) p.equipment![slot] = createSetPiece(setId, slot, "warrior");
    recomputeStats(p);
  }
  return { world, p };
}

describe("peças de conjunto", () => {
  it("cada chefe guarda um conjunto de três peças; a arma acompanha a classe", () => {
    expect(setForBoss("goblinKing")?.id).toBe("goblinKing");
    expect(setForBoss("skeletonLord")?.id).toBe("skeletonLord");
    expect(setForBoss("orc")).toBeUndefined();
    expect(createSetPiece("spiderQueen", "weapon", "archer").icon).toBe("bow");
    expect(createSetPiece("spiderQueen", "weapon", "mage").icon).toBe("staff");
    const armor = createSetPiece("scorpionEmperor", "armor");
    expect(armor).toMatchObject({ slot: "armor", rarity: "epic", set: "scorpionEmperor" });
  });

  it("duas peças dão o bônus de atributo; três liberam o poder", () => {
    const one = hero("goblinKing", 1).p;
    expect(one.bonuses!.critChance).toBe(0);
    const two = hero("goblinKing", 2).p;
    expect(two.bonuses!.critChance).toBe(SETS.goblinKing.two.value);
    expect(two.bonuses!.powers).toEqual([]);
    const three = hero("goblinKing", 3).p;
    expect(three.bonuses!.powers).toEqual(["royalFury"]);
    expect(equippedSetCounts(three.equipment!).get("goblinKing")).toBe(3);
  });

  it("o bônus de vida do Imperador entra na vida máxima", () => {
    const base = hero().p;
    const p = hero("scorpionEmperor", 2).p; // arma + armadura
    const pieces = (SETS.scorpionEmperor.armor.stats.maxHealth ?? 0);
    expect(p.health.max).toBe(base.health.max + pieces + SETS.scorpionEmperor.two.value);
  });

  it("peças de conjuntos diferentes não somam entre si", () => {
    const { p } = hero();
    p.equipment!.weapon = createSetPiece("goblinKing", "weapon");
    p.equipment!.armor = createSetPiece("spiderQueen", "armor");
    expect(activeSetBonuses(p.equipment!)).toEqual({ stats: {}, powers: [] });
  });
});

describe("poderes de três peças", () => {
  it("Fúria Real: ferido, o herói bate 30% mais forte", () => {
    const { world, p } = hero("goblinKing");
    p.bonuses!.critChance = 0;
    const dummy = () => world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    const a = dummy();
    applyDamage(world, p, a, 100);
    const healthy = a.health.max - a.health.current;
    p.health.current = p.health.max * 0.4;
    const b = dummy();
    applyDamage(world, p, b, 100);
    expect(b.health.max - b.health.current).toBe(Math.round(healthy * (1 + SET_POWERS.royalFuryBonus)));
  });

  it("Casca de Areia: recebe 20% menos dano", () => {
    const { world, p } = hero("scorpionEmperor");
    const orc = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    const before = p.health.current;
    applyDamage(world, orc, p, 100);
    expect(before - p.health.current).toBe(80);
  });

  it("Veneno: golpe básico deixa lento; habilidade não", () => {
    const { world, p } = hero("spiderQueen");
    const a = world.spawn((id) => createEnemy(id, "orc", { x: 1, y: 0, z: 0 }));
    applyDamage(world, p, a, 5, "skill");
    expect(speedFactor(a)).toBe(1);
    applyDamage(world, p, a, 5, "basic");
    expect(speedFactor(a)).toBeCloseTo(SET_POWERS.venomSlow);
  });

  it("Colheita de Almas: abater cura e adianta as habilidades", () => {
    const { world, p } = hero("skeletonLord");
    p.health.current = p.health.max * 0.5;
    const skill = p.abilities!.skills[0]!;
    skill.cooldownLeft = 5;
    const slime = world.spawn((id) => createEnemy(id, "slime", { x: 1, y: 0, z: 0 }));
    applyDamage(world, p, slime, 9999);
    expect(p.health.current).toBeCloseTo(p.health.max * (0.5 + SET_POWERS.soulHarvestHeal), 0);
    expect(skill.cooldownLeft).toBe(5 - SET_POWERS.soulHarvestCooldown);
  });
});

describe("drop do conjunto", () => {
  it("o chefe deixa cair uma peça do conjunto dele, de preferência uma que falta", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.equipment!.weapon = createSetPiece("goblinKing", "weapon");
    p.equipment!.armor = createSetPiece("goblinKing", "armor");
    const king = [...world.entities.values()].find((e) => e.archetype === "goblinKing")!;
    p.transform.position = { ...king.transform.position, x: king.transform.position.x + 60 }; // longe: não coleta sozinho
    applyDamage(world, p, king, 999999);
    const pieces = [...world.drops.values()].map((d) => d.item).filter((i) => i.set);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ set: "goblinKing", slot: "accessory" });
  });

  it("com o conjunto completo, qualquer peça pode cair", () => {
    const { p } = hero("goblinKing");
    const seen = new Set<string>();
    let r = 0;
    for (let i = 0; i < 30; i++) seen.add(pickSetSlot("goblinKing", p, () => (r = (r + 0.37) % 1)));
    expect(seen.size).toBe(3);
  });

  it("peças e poderes sobrevivem ao save", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    for (const slot of ["weapon", "armor", "accessory"] as const) p.equipment![slot] = createSetPiece("spiderQueen", slot, p.classId);
    recomputeStats(p);
    const restored = restoreGame(serializeGame(world, 0)).player!;
    expect(restored.equipment!.armor!.set).toBe("spiderQueen");
    expect(restored.bonuses!.powers).toEqual(["venom"]);
  });

  it("o Rei Goblin continua com loot garantido", () => {
    const world = new World();
    const p = world.spawn((id) => createPlayer(id, { x: 100, y: 0, z: 0 }));
    const king = world.spawn((id) => createGoblinKing(id, at));
    applyDamage(world, p, king, 999999);
    expect([...world.drops.values()].filter((d) => d.item.kind === "equipment")).toHaveLength(2);
  });
});
