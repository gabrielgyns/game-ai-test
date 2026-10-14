import type { Entity, EntityId } from "./components";
import type { Vec3 } from "./math";

export interface NpcDefinition {
  id: string;
  name: string;
  archetype: string;
  /** Fala quando não há quest para oferecer nem entregar. */
  idle: string[];
}

export const NPC_DEFS: NpcDefinition[] = [
  {
    id: "elder",
    name: "Anciã Mira",
    archetype: "elder",
    idle: [
      "O santuário protege quem descansa nele. Os inimigos não entram no círculo de pedras.",
      "Cada nível que você ganha cura por completo. Às vezes lutar é o melhor remédio.",
    ],
  },
  {
    id: "smith",
    name: "Ferreiro Brom",
    archetype: "smith",
    idle: [
      "Armas de raridade brilham na cor delas. Verde é bom, azul é melhor, roxo... roxo é lenda.",
      "Troca de arma na mochila, com I. A que você veste aparece na sua mão.",
    ],
  },
  {
    id: "guard",
    name: "Guarda Tiago",
    archetype: "guard",
    idle: [
      "Quando a área vermelha aparecer no chão, sai dela ou rola com Espaço. Dentro dela, o golpe acerta.",
      "Gosmas perto, goblins no meio, orcs na borda. O norte é coisa de gente preparada.",
      "Shift corre. Andar de ré com S é mais lento, mas mantém o inimigo na sua frente.",
    ],
  },
];

export function npcById(id: string): NpcDefinition | undefined {
  return NPC_DEFS.find((n) => n.id === id);
}

export function createNpc(id: EntityId, def: NpcDefinition, position: Vec3, yaw = 0): Entity {
  return {
    id,
    kind: "npc",
    name: def.name,
    archetype: def.archetype,
    transform: { position: { ...position }, yaw },
    movement: { speed: 0, speedMultiplier: 1, intent: { x: 0, z: 0 } },
    health: { current: 1, max: 1, baseMax: 1, regenPerSecond: 0, lastDamagedAt: -Infinity },
    combat: { damage: 0, baseDamage: 0, range: 0, cooldown: 1, cooldownLeft: 0, wantsAttack: false, windupTime: 0, windupLeft: 0 },
    npc: { id: def.id },
  };
}

/** Distância máxima para conversar. */
export const TALK_RANGE = 2.8;
