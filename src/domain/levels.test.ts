import { describe, expect, it } from "vitest";
import { entityLevel, levelDifficulty } from "./levels";
import { createEnemy, createPlayer, ENEMY_TEMPLATES } from "./factories";
import { createGoblinKing, createScorpionEmperor, createSkeletonLord, createSpiderQueen } from "./boss";
import { DUNGEON_ENTRANCE, enterDungeon } from "./dungeon";
import { generateWorld } from "./worldgen";

const at = { x: 0, y: 0, z: 0 };

describe("nível das criaturas", () => {
  it("o herói usa a progressão; inimigos usam o nível do tipo", () => {
    const hero = createPlayer(1, at);
    hero.progression!.level = 4;
    expect(entityLevel(hero)).toBe(4);
    expect(entityLevel(createEnemy(2, "slime", at))).toBe(1);
    expect(entityLevel(createEnemy(3, "orc", at))).toBe(7);
  });

  it("tipos mais fortes têm nível maior (acompanha a XP que dão)", () => {
    const kinds = Object.values(ENEMY_TEMPLATES).sort((a, b) => a.xpReward - b.xpReward);
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]!.level).toBeGreaterThanOrEqual(kinds[i - 1]!.level - 1);
  });

  it("chefes ficam acima dos mobs da região; o da cripta acompanha o nível dela", () => {
    expect(entityLevel(createGoblinKing(1, at))).toBeGreaterThan(ENEMY_TEMPLATES.goblin.level);
    expect(entityLevel(createSpiderQueen(1, at))).toBeGreaterThan(ENEMY_TEMPLATES.bogZombie.level);
    expect(entityLevel(createScorpionEmperor(1, at))).toBeGreaterThan(ENEMY_TEMPLATES.bandit.level);
    expect(entityLevel(createSkeletonLord(1, at, 9))).toBe(11);
  });

  it("os esqueletos da cripta nascem no nível do herói", () => {
    const world = generateWorld({ seed: 3 });
    const p = world.player!;
    p.progression!.level = 8;
    p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
    const run = enterDungeon(world, p, 5);
    for (const id of Object.values(run.roomEnemies).flat()) {
      const e = world.get(id)!;
      expect(entityLevel(e)).toBe(e.miniboss ? 9 : 8); // o guardião fica um nível acima
    }
  });

  it("dificuldade pela diferença de nível: cinza, verde, amarelo, laranja, vermelho", () => {
    expect(levelDifficulty(10, 4)).toBe("trivial");
    expect(levelDifficulty(10, 7)).toBe("easy");
    expect(levelDifficulty(10, 9)).toBe("even");
    expect(levelDifficulty(10, 11)).toBe("even");
    expect(levelDifficulty(10, 12)).toBe("hard");
    expect(levelDifficulty(10, 14)).toBe("deadly");
  });
});
