import { beforeEach, describe, expect, it } from "vitest";
import { recordBossKill, setWorldTier, WORLD_TIERS } from "./worldTier";
import { generateWorld } from "./worldgen";
import { entityLevel } from "./levels";
import { createEquipment, itemPower, resetItemIds } from "./items";
import { applyDamage } from "./systems/combat";
import { restoreGame, serializeGame } from "./save";
import { DUNGEON_ENTRANCE, enterDungeon } from "./dungeon";
import { createSetPiece } from "./sets";
import type { World } from "./world";

beforeEach(() => resetItemIds());

const find = (world: World, archetype: string) => [...world.entities.values()].find((e) => e.archetype === archetype)!;

describe("dificuldade do mundo", () => {
  it("começa no Aventureiro com só ele destravado", () => {
    const world = generateWorld({ seed: 3 });
    expect(world.player!.worldTier).toEqual({ current: 1, unlocked: 1, defeated: [] });
    expect(setWorldTier(world, world.player!, 2)).toBe("locked");
  });

  it("vencer os três chefes destrava o próximo nível", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    recordBossKill(world, p, "goblinKing");
    recordBossKill(world, p, "goblinKing"); // repetido não conta
    recordBossKill(world, p, "spiderQueen");
    expect(p.worldTier!.unlocked).toBe(1);
    recordBossKill(world, p, "scorpionEmperor");
    expect(p.worldTier!.unlocked).toBe(2);
    expect(world.drainEvents().some((e) => e.type === "worldTierUnlocked" && e.tier === 2)).toBe(true);
  });

  it("matar o chefe de verdade conta para o destravamento", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    applyDamage(world, p, find(world, "spiderQueen"), 9e9);
    expect(p.worldTier!.defeated).toEqual(["spiderQueen"]);
  });

  it("subir a dificuldade sobe nível, vida, dano e XP de todo o vale; voltar desfaz", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.worldTier!.unlocked = 3;
    const orc = find(world, "orc");
    const king = find(world, "goblinKing");
    const before = { level: entityLevel(orc), hp: orc.health.max, dmg: orc.combat.damage, xp: orc.ai!.xpReward, king: entityLevel(king) };
    expect(setWorldTier(world, p, 3)).toBe("ok");
    expect(entityLevel(orc)).toBe(before.level + WORLD_TIERS[2]!.levelBonus);
    expect(entityLevel(king)).toBe(before.king + 20);
    expect(orc.health.max).toBeGreaterThan(before.hp * 5);
    expect(orc.combat.damage).toBeGreaterThan(before.dmg * 4);
    expect(orc.ai!.xpReward).toBeGreaterThan(before.xp * 50);
    expect(setWorldTier(world, p, 1)).toBe("ok");
    expect([entityLevel(orc), orc.health.max, orc.combat.damage, orc.ai!.xpReward]).toEqual([before.level, before.hp, before.dmg, before.xp]);
  });

  it("só destrava o próximo vencendo no maior nível; a cripta não muda e não se troca lá dentro", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.worldTier = { current: 1, unlocked: 2, defeated: [] };
    recordBossKill(world, p, "goblinKing");
    expect(p.worldTier.defeated).toEqual([]);
    p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
    p.progression!.level = 5;
    const run = enterDungeon(world, p, 2);
    expect(setWorldTier(world, p, 2)).toBe("inDungeon");
    expect(entityLevel(world.get(run.guardianId!)!)).toBe(6); // guardião: nível da cripta + 1
  });

  it("a dificuldade vai no save e reescala o vale ao carregar", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.worldTier!.unlocked = 2;
    setWorldTier(world, p, 2);
    const restored = restoreGame(serializeGame(world, 3));
    expect(restored.player!.worldTier).toMatchObject({ current: 2, unlocked: 2 });
    expect(entityLevel(find(restored, "slime"))).toBe(11);
  });

  it("loot tem o nível de quem o derrubou e cresce acima do nível 10", () => {
    expect(itemPower(5)).toBe(1);
    expect(itemPower(20)).toBeCloseTo(Math.pow(1.08, 10));
    const low = createEquipment(() => 0.1, 3, "rare", 5);
    const high = createEquipment(() => 0.1, 3, "rare", 25);
    expect(high.level).toBe(25);
    expect(high.stats.damage! + (high.stats.maxHealth ?? 0)).toBeGreaterThan((low.stats.damage! + (low.stats.maxHealth ?? 0)) * 2.5);
    expect(createSetPiece("goblinKing", "armor", "warrior", 22).stats.maxHealth).toBeGreaterThan(createSetPiece("goblinKing", "armor").stats.maxHealth! * 2);
  });

  it("no Veterano, o chefe derruba itens de nível alto", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.worldTier!.unlocked = 2;
    setWorldTier(world, p, 2);
    const king = find(world, "goblinKing");
    p.transform.position = { x: king.transform.position.x + 60, y: 0, z: king.transform.position.z };
    applyDamage(world, p, king, 9e9);
    const levels = [...world.drops.values()].filter((d) => d.item.kind === "equipment").map((d) => d.item.level);
    expect(levels.length).toBeGreaterThan(0);
    for (const l of levels) expect(l).toBe(16);
  });
});
