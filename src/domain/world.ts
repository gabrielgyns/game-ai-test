import { isAlive, type Entity, type EntityId } from "./components";
import type { GameEvent } from "./events";
import type { Item } from "./items";
import type { Vec3 } from "./math";
import type { Projectile } from "./projectiles";
import type { Hazard, PoolSpec } from "./hazards";
import type { ShopState } from "./shop";
import type { DungeonRun } from "./dungeon";

/**
 * Agregado raiz do jogo. Guarda o estado completo e a fila de eventos do tick.
 * Não conhece Three.js nem DOM: é o "servidor" lógico, mesmo rodando no cliente.
 */
/** Um item caído no chão, esperando ser coletado. */
export interface Drop {
  id: number;
  item: Item;
  position: Vec3;
  /** Segundos desde que caiu (expira depois de um tempo). */
  age: number;
  /** Até quando (world.time) ignorar tentativas de coleta (inventário cheio). */
  blockedUntil: number;
  /** Item largado pelo jogador: só volta a ser coletável depois que ele se afasta. */
  requireLeave: boolean;
}

export class World {
  private nextId: EntityId = 1;
  private nextDropId = 1;
  readonly entities = new Map<EntityId, Entity>();
  readonly drops = new Map<number, Drop>();
  readonly projectiles = new Map<number, Projectile>();
  private nextProjectileId = 1;
  /** Poças e outros perigos ativos no chão. */
  readonly hazards = new Map<number, Hazard>();
  /** Estoque e recompra de cada loja, pelo id (montado na primeira visita de cada dia). */
  shops: Record<string, ShopState> = {};
  /** Tempo do herói em cima da lava (para os pulsos de queimadura). */
  lavaClock = 0;
  /** Dungeon em andamento (instanciada; não vai para o save). */
  dungeon?: DungeonRun;
  private nextHazardId = 1;
  /** Gerador determinístico usado por loot e outras decisões aleatórias do domínio. */
  random: () => number = Math.random;
  /** Tempo de jogo acumulado em segundos. */
  time = 0;
  /** Eventos gerados desde o último drain. */
  private events: GameEvent[] = [];
  private playerId: EntityId | null = null;

  spawn(build: (id: EntityId) => Entity): Entity {
    const id = this.nextId++;
    const entity = build(id);
    this.entities.set(id, entity);
    if (entity.kind === "player") this.playerId = id;
    return entity;
  }

  /** Remove uma entidade do mundo (usado ao fechar uma dungeon). */
  despawn(id: EntityId): void {
    this.entities.delete(id);
  }

  get(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  get player(): Entity | undefined {
    return this.playerId === null ? undefined : this.entities.get(this.playerId);
  }

  *alive(): IterableIterator<Entity> {
    for (const e of this.entities.values()) if (isAlive(e)) yield e;
  }

  *enemies(): IterableIterator<Entity> {
    for (const e of this.entities.values()) if (e.kind === "enemy") yield e;
  }

  addProjectile(p: Omit<Projectile, "id" | "traveled" | "hitIds">): Projectile {
    const projectile: Projectile = { ...p, id: this.nextProjectileId++, traveled: 0, hitIds: [] };
    this.projectiles.set(projectile.id, projectile);
    this.emit({ type: "projectileSpawn", projectileId: projectile.id });
    return projectile;
  }

  /** Cria uma poça a partir de uma receita; o dano é uma fração do dano do dono. */
  addHazard(owner: Entity, spec: PoolSpec, position: Vec3): Hazard {
    const hazard: Hazard = {
      id: this.nextHazardId++,
      kind: spec.kind,
      owner: owner.id,
      position: { ...position },
      radius: spec.radius,
      damage: Math.max(1, Math.round(owner.combat.damage * spec.damageFraction)),
      tickEvery: spec.tickEvery,
      tickLeft: spec.tickEvery,
      timeLeft: spec.duration,
      duration: spec.duration,
    };
    this.hazards.set(hazard.id, hazard);
    this.emit({ type: "hazardSpawn", hazardId: hazard.id });
    return hazard;
  }

  addDrop(item: Item, position: Vec3): Drop {
    const drop: Drop = { id: this.nextDropId++, item, position: { ...position }, age: 0, blockedUntil: 0, requireLeave: false };
    this.drops.set(drop.id, drop);
    this.emit({ type: "drop", dropId: drop.id });
    return drop;
  }

  *npcs(): IterableIterator<Entity> {
    for (const e of this.entities.values()) if (e.kind === "npc") yield e;
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
