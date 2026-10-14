import { beforeEach, describe, expect, it } from "vitest";
import {
  canStand, cellToWorld, closeDungeon, DUNGEON_ENTRANCE, DUNGEON_LIVES, dungeonInteraction, enterDungeon, exitDungeon, hasLineOfSight,
  inDungeonSpace, isWalkable, openChest, roomCenterWorld,
} from "./dungeon";
import { COMBAT_ROOMS, generateLayout, reachable, roomCenter, Tile, tileOf } from "./dungeonLayout";
import { resetItemIds } from "./items";
import { questById } from "./quests";
import { restoreGame, serializeGame } from "./save";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { generateWorld } from "./worldgen";
import type { World } from "./world";
import type { GameEvent } from "./events";

beforeEach(() => resetItemIds());

function run(world: World, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) events.push(...stepWorld(world, 1 / 60));
  return events;
}

function inside(seed = 42, level = 5) {
  const world = generateWorld({ seed: 3 });
  const p = world.player!;
  p.progression!.level = level;
  p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z };
  const r = enterDungeon(world, p, seed);
  return { world, p, r };
}

describe("planta da cripta", () => {
  it("encadeia sala inicial, cinco salas de combate e o chefe, tudo conectado", () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const layout = generateLayout(seed);
      expect(layout.rooms.map((r) => r.kind)).toEqual(["start", ...Array(COMBAT_ROOMS).fill("combat"), "boss"]);
      const start = roomCenter(layout.rooms[0]!);
      const seen = reachable(layout, { i: Math.floor(start.i), j: Math.floor(start.j) });
      for (const room of layout.rooms) {
        const c = roomCenter(room);
        // O centro de toda sala é alcançável a partir da sala inicial (pilares nunca ficam no centro).
        expect(seen.has(Math.floor(c.j) * layout.width + Math.floor(c.i))).toBe(true);
      }
    }
  });

  it("salas não se sobrepõem e a planta muda com a seed", () => {
    const a = generateLayout(5);
    for (const r of a.rooms)
      for (const o of a.rooms) {
        if (r === o) continue;
        const overlap = r.i0 < o.i1 && r.i1 > o.i0 && r.j0 < o.j1 && r.j1 > o.j0;
        expect(overlap).toBe(false);
      }
    const b = generateLayout(6);
    const key = (t: Uint8Array) => Array.from(t).join("");
    expect(key(a.tiles)).not.toBe(key(b.tiles));
    expect(key(generateLayout(5).tiles)).toBe(key(a.tiles)); // mesma seed, mesma planta
  });

  it("salas grandes têm pilares, que são sólidos", () => {
    const layout = generateLayout(42);
    expect(layout.tiles.some((t) => t === Tile.Pillar)).toBe(true);
  });
});

describe("dentro da cripta", () => {
  it("entrar leva o herói para a sala inicial, com inimigos nas salas e o chefe no fim", () => {
    const { world, p, r } = inside();
    expect(inDungeonSpace(p.transform.position.x)).toBe(true);
    expect(r.livesLeft).toBe(DUNGEON_LIVES);
    const enemies = Object.values(r.roomEnemies).flat();
    expect(Object.keys(r.roomEnemies)).toHaveLength(COMBAT_ROOMS);
    expect(enemies.length).toBeGreaterThanOrEqual(COMBAT_ROOMS * 3);
    expect(world.get(r.bossId)!.archetype).toBe("skeletonLord");
    for (const id of enemies) expect(isWalkable(world, world.get(id)!.transform.position.x, world.get(id)!.transform.position.z)).toBe(true);
  });

  it("paredes param o herói: andar contra o vazio não atravessa", () => {
    const { world, p, r } = inside();
    const start = r.layout.rooms[0]!;
    p.transform.position = { ...cellToWorld(start.i0 + 1, Math.floor(roomCenter(start).j)) };
    p.movement.intent = { x: -1, z: 0 }; // parede oeste da sala inicial
    run(world, 1);
    expect(p.transform.position.x).toBeGreaterThan(cellToWorld(start.i0, 0).x - 0.5);
    expect(canStand(world, p.transform.position.x, p.transform.position.z)).toBe(true);
  });

  it("inimigos só acordam com linha de visão", () => {
    const { world, p, r } = inside();
    const id = r.roomEnemies[r.layout.rooms[1]!.id]![0]!;
    const e = world.get(id)!;
    // Atrás de uma parede, perto: não acorda. Na mesma sala: acorda.
    const wallSide = { x: e.transform.position.x, y: 0, z: e.transform.position.z };
    expect(hasLineOfSight(world, wallSide, roomCenterWorld(r.layout.rooms[0]!))).toBe(false);
    p.transform.position = roomCenterWorld(r.layout.rooms[1]!);
    run(world, 0.1);
    expect(e.ai!.state).not.toBe("idle");
  });

  it("projéteis param na parede", () => {
    const { world, p, r } = inside();
    const start = r.layout.rooms[0]!;
    p.transform.position = roomCenterWorld(start);
    p.abilities!.aimDirection = { x: 0, z: -1 }; // reto para a parede norte da sala inicial
    world.addProjectile({ kind: "arrow", owner: p.id, position: { ...p.transform.position, y: 1 }, direction: { x: 0, z: -1 }, speed: 20, maxDistance: 40, damage: 5, explodeRadius: 0, pierce: false });
    run(world, 1);
    expect(world.projectiles.size).toBe(0);
  });

  it("limpar uma sala avisa o progresso", () => {
    const { world, p, r } = inside();
    const room = r.layout.rooms[1]!;
    for (const id of r.roomEnemies[room.id]!) applyDamage(world, p, world.get(id)!, 99999);
    const events = run(world, 1 / 60);
    const ev = events.find((e) => e.type === "roomCleared");
    expect(ev && ev.type === "roomCleared" && ev.total).toBe(COMBAT_ROOMS);
  });

  it("vencer o chefe abre o baú e o portal de saída; o baú dá ouro e loot garantido", () => {
    const { world, p, r } = inside();
    applyDamage(world, p, world.get(r.bossId)!, 999999);
    const events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "dungeonComplete")).toBe(true);
    expect(r.chest).not.toBeNull();
    p.transform.position = { ...r.chest!.position };
    expect(dungeonInteraction(world, p)).toBe("chest");
    const gold = p.wallet!.gold;
    expect(openChest(world, p)).toBe(true);
    expect(p.wallet!.gold).toBeGreaterThan(gold);
    const loot = [...world.drops.values()].filter((d) => inDungeonSpace(d.position.x)).map((d) => d.item);
    expect(loot.filter((i) => i.kind === "equipment").every((i) => i.rarity === "rare" || i.rarity === "epic")).toBe(true);
    expect(openChest(world, p)).toBe(false); // só uma vez
    p.transform.position = { ...r.exitPortal! };
    expect(dungeonInteraction(world, p)).toBe("exit");
  });

  it("sair leva de volta ao portal e apaga tudo que era da cripta", () => {
    const { world, p } = inside();
    exitDungeon(world, p, "leave");
    expect(world.dungeon).toBeUndefined();
    expect(inDungeonSpace(p.transform.position.x)).toBe(false);
    expect([...world.entities.values()].some((e) => inDungeonSpace(e.transform.position.x))).toBe(false);
    // Volta um pouco à frente do portal (fora do alcance, para não reabrir sem querer).
    expect(dungeonInteraction(world, p)).toBeNull();
    p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z + 1 };
    expect(dungeonInteraction(world, p)).toBe("enter");
  });

  it("três vidas: renasce na sala inicial; sem vidas, volta ao santuário e a cripta fecha", () => {
    const { world, p, r } = inside();
    const boss = world.get(r.bossId)!;
    for (let life = DUNGEON_LIVES - 1; life >= 0; life--) {
      applyDamage(world, boss, p, 999999);
      expect(r.livesLeft).toBe(life);
      run(world, 5.2);
      if (life > 0) expect(inDungeonSpace(p.transform.position.x)).toBe(true);
    }
    expect(world.dungeon).toBeUndefined();
    expect(Math.hypot(p.transform.position.x, p.transform.position.z)).toBeLessThan(2);
  });

  it("salvar dentro da cripta guarda o herói na porta, sem nada da cripta", () => {
    const { world } = inside();
    const save = serializeGame(world, 3);
    expect(inDungeonSpace(save.player.position.x)).toBe(false);
    const restored = restoreGame(save);
    expect(restored.dungeon).toBeUndefined();
    expect(Math.hypot(restored.player!.transform.position.x - DUNGEON_ENTRANCE.x, restored.player!.transform.position.z - DUNGEON_ENTRANCE.z)).toBeLessThan(4);
  });

  it("inimigos escalam com o nível e cada entrada é uma cripta nova", () => {
    const low = inside(10, 2);
    const high = inside(10, 12);
    const hp = (w: World, ids: number[]) => ids.reduce((n, id) => n + w.get(id)!.health.max, 0);
    const lowIds = Object.values(low.r.roomEnemies).flat();
    const highIds = Object.values(high.r.roomEnemies).flat();
    expect(hp(high.world, highIds) / highIds.length).toBeGreaterThan(hp(low.world, lowIds) / lowIds.length);
    const again = inside(11, 2);
    expect(again.r.seed).not.toBe(low.r.seed);
    closeDungeon(again.world);
  });

  it("quest da cripta é da Anciã e pede o Lorde Esqueleto", () => {
    const q = questById("crypt")!;
    expect(q.giver).toBe("elder");
    expect(q.objective.archetype).toBe("skeletonLord");
  });

  it("o portal de entrada fica em chão firme do mapa", () => {
    const world = generateWorld();
    expect(tileOf(generateLayout(1), -1, -1)).toBe(Tile.Void);
    expect(isWalkable(world, DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z)).toBe(true);
  });
});
