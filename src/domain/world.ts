import { isAlive, type Entity, type EntityId } from "./components";
import type { GameEvent } from "./events";
import type { Item } from "./items";
import type { Vec3 } from "./math";

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
}

export class World {
  private nextId: EntityId = 1;
  private nextDropId = 1;
  readonly entities = new Map<EntityId, Entity>();
  readonly drops = new Map<number, Drop>();
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

  addDrop(item: Item, position: Vec3): Drop {
    const drop: Drop = { id: this.nextDropId++, item, position: { ...position }, age: 0, blockedUntil: 0 };
    this.drops.set(drop.id, drop);
    this.emit({ type: "drop", dropId: drop.id });
    return drop;
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
