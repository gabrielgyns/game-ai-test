import { beforeEach, describe, expect, it } from "vitest";
import {
  canStand, cellToWorld, closeDungeon, descend, DUNGEON_ENTRANCE, DUNGEON_LIVES, DUNGEON_ORIGIN, dungeonInteraction, enterDungeon, exitDungeon,
  hasLineOfSight, inDungeonSpace, isWalkable, openChest, openSideChest, roomCenterWorld, SHRINE_BLESSING, steerToward, TRAP, trapPhase, useShrine,
  type DungeonRun,
} from "./dungeon";
import { COMBAT_ROOMS_PER_FLOOR, DUNGEON_FLOORS, generateLayout, isFloorTile, reachable, roomCenter, Tile, tileOf } from "./dungeonLayout";
import { buildFlowField } from "./pathfinding";
import { createEnemy } from "./factories";
import { resetItemIds } from "./items";
import { questById } from "./quests";
import { restoreGame, serializeGame } from "./save";
import { stepWorld } from "./simulation";
import { applyDamage } from "./systems/combat";
import { generateWorld } from "./worldgen";
import type { World } from "./world";
import type { GameEvent } from "./events";
import type { Entity } from "./components";

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

/** Vence o guardião e desce para o andar do chefe. */
function toBossFloor(world: World, p: Entity, r: DungeonRun): void {
  applyDamage(world, p, world.get(r.guardianId!)!, 9e9);
  run(world, 1 / 60);
  expect(descend(world, p)).toBe(true);
}

describe("planta da cripta", () => {
  it("andar 1: início, salas de combate, salas laterais e a escada; andar 2 termina no chefe", () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      for (let floor = 1; floor <= DUNGEON_FLOORS; floor++) {
        const layout = generateLayout(seed, floor);
        const kinds = layout.rooms.map((r) => r.kind);
        expect(kinds[0]).toBe("start");
        expect(kinds.filter((k) => k === "combat")).toHaveLength(COMBAT_ROOMS_PER_FLOOR[floor - 1]!);
        expect(kinds.filter((k) => k === (floor < DUNGEON_FLOORS ? "stairs" : "boss"))).toHaveLength(1);
        expect(kinds.filter((k) => k === "treasure" || k === "shrine")).toHaveLength(2);
        const start = roomCenter(layout.rooms[0]!);
        const seen = reachable(layout, { i: Math.floor(start.i), j: Math.floor(start.j) });
        for (const room of layout.rooms) {
          const c = roomCenter(room);
          expect(seen.has(Math.floor(c.j) * layout.width + Math.floor(c.i))).toBe(true);
        }
      }
    }
  });

  it("salas não se sobrepõem e a planta muda com a seed e com o andar", () => {
    const a = generateLayout(5);
    for (const r of a.rooms)
      for (const o of a.rooms) {
        if (r === o) continue;
        expect(r.i0 < o.i1 && r.i1 > o.i0 && r.j0 < o.j1 && r.j1 > o.j0).toBe(false);
      }
    const key = (t: Uint8Array) => Array.from(t).join("");
    expect(key(generateLayout(6).tiles)).not.toBe(key(a.tiles));
    expect(key(generateLayout(5, 2).tiles)).not.toBe(key(a.tiles));
    expect(key(generateLayout(5).tiles)).toBe(key(a.tiles)); // mesma seed, mesma planta
  });

  it("formas variadas, pilares sólidos e armadilhas que se pisam", () => {
    const shapes = new Set<string>();
    const events = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const l = generateLayout(seed);
      l.rooms.forEach((r) => {
        shapes.add(r.shape);
        events.add(r.event);
      });
      expect(l.tiles.some((t) => t === Tile.Pillar)).toBe(true);
    }
    expect([...shapes].sort()).toEqual(["cross", "hall", "rect", "round"]);
    expect([...events].sort()).toEqual(["ambush", "normal", "traps", "waves"]);
    expect(isFloorTile(Tile.Trap)).toBe(true);
    expect(isFloorTile(Tile.Pillar)).toBe(false);
  });
});

describe("caminho (campo de fluxo)", () => {
  it("a distância cresce a partir do alvo e paredes ficam de fora", () => {
    const layout = generateLayout(42);
    const c = roomCenter(layout.rooms[0]!);
    const f = buildFlowField(layout, Math.floor(c.i), Math.floor(c.j));
    expect(f.dist[f.target]).toBe(0);
    expect(f.dist[0]).toBe(Infinity); // canto da grade é vazio
    const far = roomCenter(layout.rooms[layout.rooms.length - 3]!);
    expect(f.dist[Math.floor(far.j) * layout.width + Math.floor(far.i)]).toBeGreaterThan(20);
  });

  it("um esqueleto atrás de parede contorna e chega no herói", () => {
    // Herói na sala inicial; inimigo na sala 1, numa célula sem visão direta.
    for (const seed of [42, 7, 1234]) {
      const { world, p, r } = inside(seed);
      for (const e of [...world.entities.values()]) if (e.kind === "enemy") world.despawn(e.id);
      const room = r.layout.rooms[1]!;
      p.transform.position = roomCenterWorld(r.layout.rooms[0]!);
      const cells: { i: number; j: number }[] = [];
      for (let j = room.j0; j < room.j1; j++) for (let i = room.i0; i < room.i1; i++) if (tileOf(r.layout, i, j) === Tile.Floor) cells.push({ i, j });
      const hidden = cells.find((c) => !hasLineOfSight(world, cellToWorld(c.i, c.j), p.transform.position))!;
      expect(hidden).toBeDefined();
      const e = world.spawn((id) => createEnemy(id, "skeleton", cellToWorld(hidden.i, hidden.j)));
      e.ai!.state = "chase";
      e.ai!.leashRange = 999;
      e.ai!.home = { ...p.transform.position };
      for (const x of [...world.entities.values()]) if (x.kind === "enemy" && x.id !== e.id) world.despawn(x.id);
      run(world, 12);
      expect(Math.hypot(e.transform.position.x - p.transform.position.x, e.transform.position.z - p.transform.position.z)).toBeLessThan(3);
    }
  });

  it("no vale, sem cripta, segue em linha reta", () => {
    const world = generateWorld({ seed: 3 });
    expect(steerToward(world, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })).toEqual({ x: 1, z: 0 });
  });
});

describe("dentro da cripta", () => {
  it("entrar leva ao andar 1, com inimigos nas salas, guardião na escada e escada fechada", () => {
    const { world, p, r } = inside();
    expect(inDungeonSpace(p.transform.position.x)).toBe(true);
    expect(r.floor).toBe(1);
    expect(r.livesLeft).toBe(DUNGEON_LIVES);
    const guardian = world.get(r.guardianId!)!;
    expect(guardian.miniboss).toBe(true);
    expect(guardian.health.max).toBeGreaterThan(400);
    expect(r.bossId).toBeNull();
    expect(r.stairsOpen).toBe(false);
    for (const id of Object.values(r.roomEnemies).flat()) {
      const e = world.get(id)!;
      expect(isWalkable(world, e.transform.position.x, e.transform.position.z)).toBe(true);
    }
    p.transform.position = { ...r.stairs! };
    expect(dungeonInteraction(world, p)).toBe("stairsLocked");
    expect(descend(world, p)).toBe(false);
  });

  it("paredes param o herói: andar contra o vazio não atravessa", () => {
    const { world, p, r } = inside();
    const start = r.layout.rooms[0]!;
    p.transform.position = { ...cellToWorld(start.i0 + 1, Math.floor(roomCenter(start).j)) };
    p.movement.intent = { x: -1, z: 0 };
    run(world, 1);
    expect(p.transform.position.x).toBeGreaterThan(cellToWorld(start.i0, 0).x - 0.5);
    expect(canStand(world, p.transform.position.x, p.transform.position.z)).toBe(true);
  });

  it("inimigos só acordam com linha de visão", () => {
    const { world, p, r } = inside();
    const room = r.layout.rooms.find((x) => x.kind === "combat" && r.roomEnemies[x.id]!.length > 0)!;
    const e = world.get(r.roomEnemies[room.id]![0]!)!;
    expect(hasLineOfSight(world, e.transform.position, roomCenterWorld(r.layout.rooms[0]!))).toBe(false);
    p.transform.position = roomCenterWorld(room);
    run(world, 0.1);
    expect(e.ai!.state).not.toBe("idle");
  });

  it("projéteis param na parede", () => {
    const { world, p, r } = inside();
    p.transform.position = roomCenterWorld(r.layout.rooms[0]!);
    world.addProjectile({ kind: "arrow", owner: p.id, position: { ...p.transform.position, y: 1 }, direction: { x: 0, z: -1 }, speed: 20, maxDistance: 40, damage: 5, explodeRadius: 0, pierce: false });
    run(world, 1);
    expect(world.projectiles.size).toBe(0);
  });

  it("emboscada: a sala começa vazia e os inimigos aparecem quando o herói entra", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => generateLayout(s).rooms.some((r) => r.event === "ambush"))!;
    const { world, p, r } = inside(seed);
    const room = r.layout.rooms.find((x) => x.event === "ambush")!;
    expect(r.roomEnemies[room.id]).toEqual([]);
    run(world, 1 / 60);
    expect(r.clearedRooms).not.toContain(room.id); // vazia, mas não "limpa"
    p.transform.position = roomCenterWorld(room);
    const events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "ambush")).toBe(true);
    expect(r.roomEnemies[room.id]!.length).toBeGreaterThan(2);
    for (const id of r.roomEnemies[room.id]!) {
      const e = world.get(id)!;
      expect(Math.hypot(e.transform.position.x - p.transform.position.x, e.transform.position.z - p.transform.position.z)).toBeGreaterThan(3);
    }
  });

  it("ondas: limpar a primeira traz a segunda; só depois a sala conta como limpa", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => generateLayout(s).rooms.some((r) => r.event === "waves"))!;
    const { world, p, r } = inside(seed);
    const room = r.layout.rooms.find((x) => x.event === "waves")!;
    const first = [...r.roomEnemies[room.id]!];
    for (const id of first) applyDamage(world, p, world.get(id)!, 9e9);
    let events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "wave")).toBe(true);
    expect(r.clearedRooms).not.toContain(room.id);
    for (const id of r.roomEnemies[room.id]!) applyDamage(world, p, world.get(id)!, 9e9);
    events = run(world, 1 / 60);
    expect(r.clearedRooms).toContain(room.id);
  });

  it("armadilhas: avisam, sobem e ferem uma vez por ativação quem está em cima", () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => generateLayout(s).tiles.some((t) => t === Tile.Trap))!;
    const { world, p, r } = inside(seed);
    expect(trapPhase(0.2).warning).toBe(true);
    expect(trapPhase(TRAP.warn + 0.1).active).toBe(true);
    const k = r.layout.tiles.findIndex((t) => t === Tile.Trap);
    const i = k % r.layout.width, j = Math.floor(k / r.layout.width);
    for (const e of [...world.entities.values()]) if (e.kind === "enemy") world.despawn(e.id);
    p.transform.position = cellToWorld(i, j);
    const hp = p.health.current;
    run(world, TRAP.warn + TRAP.active + 0.1);
    expect(hp - p.health.current).toBeCloseTo(Math.round(p.health.max * TRAP.damageFraction), -1);
  });

  it("santuário cura e abençoa; baú lateral dá ouro e um raro; os dois só uma vez", () => {
    const { world, p, r } = inside();
    p.health.current = 10;
    p.transform.position = { ...r.shrines[0]!.position };
    expect(dungeonInteraction(world, p)).toBe("shrine");
    expect(useShrine(world, p)).toBe(true);
    expect(p.health.current).toBe(p.health.max);
    expect(p.abilities!.damageBuff).toMatchObject({ multiplier: SHRINE_BLESSING.multiplier });
    expect(useShrine(world, p)).toBe(false);
    p.transform.position = { ...r.sideChests[0]!.position };
    const gold = p.wallet!.gold;
    expect(openSideChest(world, p)).toBe(true);
    expect(p.wallet!.gold).toBeGreaterThan(gold);
    const loot = [...world.drops.values()].filter((d) => inDungeonSpace(d.position.x) && d.item.kind === "equipment");
    expect(loot.every((d) => d.item.rarity === "rare" || d.item.rarity === "epic")).toBe(true);
    expect(openSideChest(world, p)).toBe(false);
  });

  it("vencer o guardião abre a escada; descer gera o andar do chefe e apaga o de cima", () => {
    const { world, p, r } = inside();
    const guardian = world.get(r.guardianId!)!;
    applyDamage(world, p, guardian, 9e9);
    const events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "stairsOpen")).toBe(true);
    expect([...world.drops.values()].some((d) => d.item.kind === "equipment" && (d.item.rarity === "rare" || d.item.rarity === "epic"))).toBe(true);
    p.transform.position = { ...r.stairs! };
    expect(dungeonInteraction(world, p)).toBe("stairs");
    const oldIds = Object.values(r.roomEnemies).flat();
    expect(descend(world, p)).toBe(true);
    expect(r.floor).toBe(2);
    expect(oldIds.some((id) => world.get(id))).toBe(false);
    expect(world.get(r.bossId!)!.archetype).toBe("skeletonLord");
    expect(dungeonInteraction(world, { ...p, transform: { ...p.transform, position: { ...r.startPortal } } })).toBeNull(); // no andar 2 não há saída na entrada
  });

  it("vencer o chefe abre o baú e o portal de saída; o baú dá ouro e loot garantido", () => {
    const { world, p, r } = inside();
    toBossFloor(world, p, r);
    applyDamage(world, p, world.get(r.bossId!)!, 999999);
    const events = run(world, 1 / 60);
    expect(events.some((e) => e.type === "dungeonComplete")).toBe(true);
    p.transform.position = { ...r.chest!.position };
    expect(dungeonInteraction(world, p)).toBe("chest");
    const gold = p.wallet!.gold;
    expect(openChest(world, p)).toBe(true);
    expect(p.wallet!.gold).toBeGreaterThan(gold);
    expect(openChest(world, p)).toBe(false);
    p.transform.position = { ...r.exitPortal! };
    expect(dungeonInteraction(world, p)).toBe("exit");
  });

  it("sair leva de volta ao portal e apaga tudo que era da cripta", () => {
    const { world, p } = inside();
    exitDungeon(world, p, "leave");
    expect(world.dungeon).toBeUndefined();
    expect(inDungeonSpace(p.transform.position.x)).toBe(false);
    expect([...world.entities.values()].some((e) => inDungeonSpace(e.transform.position.x))).toBe(false);
    expect(dungeonInteraction(world, p)).toBeNull();
    p.transform.position = { x: DUNGEON_ENTRANCE.x, y: 0, z: DUNGEON_ENTRANCE.z + 1 };
    expect(dungeonInteraction(world, p)).toBe("enter");
  });

  it("três vidas para a cripta inteira: renasce no início do andar; sem vidas, volta ao santuário", () => {
    const { world, p, r } = inside();
    toBossFloor(world, p, r);
    const boss = world.get(r.bossId!)!;
    for (let life = DUNGEON_LIVES - 1; life >= 0; life--) {
      applyDamage(world, boss, p, 999999);
      expect(r.livesLeft).toBe(life);
      run(world, 5.2);
      if (life > 0) {
        expect(inDungeonSpace(p.transform.position.x)).toBe(true);
        expect(r.floor).toBe(2);
      }
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

  it("o portal de entrada fica em chão firme do mapa e a cripta fica longe do vale", () => {
    const world = generateWorld();
    expect(tileOf(generateLayout(1), -1, -1)).toBe(Tile.Void);
    expect(isWalkable(world, DUNGEON_ENTRANCE.x, DUNGEON_ENTRANCE.z)).toBe(true);
    expect(DUNGEON_ORIGIN.x).toBeGreaterThanOrEqual(1000);
  });
});
