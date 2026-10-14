import * as THREE from "three";
import type { Entity } from "../domain/components";
import type { Item, Rarity } from "../domain/items";
import type { ClassId } from "../domain/classes";
import { CLASSES, CLASS_ORDER } from "../domain/classes";
import { ENEMY_TEMPLATES, createEnemy, createPlayer, type EnemyKind } from "../domain/factories";
import { createGoblinKing, createSpiderQueen } from "../domain/boss";
import { NPC_DEFS, createNpc } from "../domain/npc";
import { SKILLS, type SkillId } from "../domain/skills";
import { RARITY_LABEL } from "../domain/items";
import { DropView } from "../game/dropViews";
import { createProjectileMesh } from "../game/projectileViews";
import { PROP_BUILDERS } from "../game/environment";
import { voxelMaterial } from "../game/voxel";

/** Um item da vitrine: um personagem vivo (passa pelas views do jogo) ou um objeto parado. */
export type Exhibit =
  | {
      kind: "character";
      id: string;
      group: string;
      label: string;
      description: string;
      /** Monta a entidade do domínio que a view vai desenhar. */
      spawn: (id: number) => Entity;
      /** Raio aproximado para enquadrar a câmera, em metros. */
      size: number;
    }
  | {
      kind: "object";
      id: string;
      group: string;
      label: string;
      description: string;
      build: () => { object: THREE.Object3D; update?: (time: number) => void };
      size: number;
    };

let itemId = 9000;

function item(name: string, slot: "weapon" | "armor" | "accessory", icon: string, rarity: Rarity, stats: Item["stats"], visual?: string): Item {
  return { id: itemId++, name, kind: "equipment", slot, rarity, stats, icon, visual, value: 0, quantity: 1, maxStack: 1 };
}

const STARTER: Record<ClassId, string> = { warrior: "sword", archer: "bow", mage: "staff" };

interface GearSet {
  id: string;
  label: string;
  weapon: (classId: ClassId) => Item | null;
  armor: Item | null;
  accessory: Item | null;
}

const GEAR_SETS: GearSet[] = [
  { id: "start", label: "inicial", weapon: (c) => item("Arma velha", "weapon", STARTER[c], "common", { damage: 4 }), armor: null, accessory: null },
  {
    id: "leather",
    label: "couro (Incomum)",
    weapon: (c) => item("Arma", "weapon", c === "warrior" ? "dagger" : STARTER[c], "uncommon", { damage: 5 }),
    armor: item("Túnica de Couro", "armor", "armor", "uncommon", { maxHealth: 15 }, "tunic"),
    accessory: item("Botas Ligeiras", "accessory", "boots", "uncommon", { speedPercent: 8 }),
  },
  {
    id: "chain",
    label: "malha (Raro)",
    weapon: (c) => item("Arma", "weapon", c === "warrior" ? "axe" : STARTER[c], "rare", { damage: 9 }),
    armor: item("Cota de Malha", "armor", "armor", "rare", { maxHealth: 35 }, "chain"),
    accessory: item("Amuleto de Força", "accessory", "amulet", "rare", { damage: 4 }),
  },
  {
    id: "plate",
    label: "placas (Épico)",
    weapon: (c) => item("Arma", "weapon", c === "warrior" ? "sword" : STARTER[c], "epic", { damage: 16 }),
    armor: item("Armadura de Placas", "armor", "armor", "epic", { maxHealth: 70 }, "plate"),
    accessory: item("Anel do Titã", "accessory", "ring", "epic", { maxHealth: 40 }),
  },
];

const ENEMY_DESCRIPTIONS: Record<EnemyKind, string> = {
  slime: "O primeiro inimigo da campina. Pula para atacar e se comprime antes do golpe.",
  goblin: "Magro e orelhudo, bate com um porrete cheio de pregos.",
  orc: "Brutamontes com elmo chifrudo e machado de lâmina larga. Dói.",
  spider: "Aranha do pântano: baixa, rápida, patas em arco.",
  bogZombie: "Zumbi do lodo: braço esticado, pele com musgo e cogumelo na cintura.",
  scorpion: "Escorpião do deserto: carapaça segmentada, pinças e cauda com ferrão que levanta no aviso.",
  bandit: "Salteador do deserto: lenço, turbante, cimitarra curva e uma adaga de reserva no peito.",
};

const PROJECTILE_DESCRIPTIONS: Record<string, string> = {
  arrow: "Flecha do Arqueiro. Ataque básico, 18 m de alcance.",
  piercingArrow: "Tiro Perfurante: atravessa todos os inimigos em linha.",
  bolt: "Raio arcano do Mago. Ataque básico, 16 m.",
  fireball: "Bola de Fogo: lenta, explode em 2,8 m.",
};

export function buildCatalog(): Exhibit[] {
  const out: Exhibit[] = [];

  for (const classId of CLASS_ORDER) {
    for (const set of GEAR_SETS) {
      out.push({
        kind: "character",
        id: `hero.${classId}.${set.id}`,
        group: "Heróis",
        label: `${CLASSES[classId].name} · ${set.label}`,
        description: `${CLASSES[classId].description} Conjunto ${set.label}: a arma, a armadura e o acessório aparecem no corpo, com aura na cor da raridade.`,
        size: 2.6,
        spawn: (id) => {
          const e = createPlayer(id, { x: 0, y: 0, z: 0 }, classId);
          e.equipment!.weapon = set.weapon(classId);
          e.equipment!.armor = set.armor;
          e.equipment!.accessory = set.accessory;
          return e;
        },
      });
    }
  }

  for (const kind of Object.keys(ENEMY_TEMPLATES) as EnemyKind[]) {
    const t = ENEMY_TEMPLATES[kind];
    out.push({
      kind: "character",
      id: `mob.${kind}`,
      group: "Mobs",
      label: t.name,
      description: `${ENEMY_DESCRIPTIONS[kind]} Vida ${t.maxHealth}, dano ${t.damage}, aviso de ${t.windup}s.`,
      size: kind === "orc" ? 3.4 : 2.4,
      spawn: (id) => createEnemy(id, kind, { x: 0, y: 0, z: 0 }),
    });
  }

  out.push(
    {
      kind: "character",
      id: "boss.goblinKing",
      group: "Chefes",
      label: "Rei Goblin",
      description: "Chefe da arena ao norte. Coroa, capa, cinturão com rubi e machado de duas lâminas. Golpe Pesado, Pisão e Investida Real.",
      size: 4.6,
      spawn: (id) => createGoblinKing(id, { x: 0, y: 0, z: 0 }),
    },
    {
      kind: "character",
      id: "boss.spiderQueen",
      group: "Chefes",
      label: "Rainha Aranha",
      description: "Chefe do pântano. Marca no abdômen, coroa, Teia Venenosa mirada e Bote.",
      size: 4.2,
      spawn: (id) => createSpiderQueen(id, { x: 0, y: 0, z: 0 }),
    },
  );

  for (const def of NPC_DEFS) {
    out.push({
      kind: "character",
      id: `npc.${def.id}`,
      group: "NPCs",
      label: def.name,
      description: def.idle[0] ?? "",
      size: 2.6,
      spawn: (id) => createNpc(id, def, { x: 0, y: 0, z: 0 }),
    });
  }

  const ICONS: { icon: string; label: string; rarities: Rarity[] }[] = [
    { icon: "sword", label: "Espadas", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "dagger", label: "Adagas", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "axe", label: "Machados", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "bow", label: "Arcos", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "staff", label: "Cajados", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "armor", label: "Armaduras", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "ring", label: "Anéis", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "boots", label: "Botas", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "amulet", label: "Amuletos", rarities: ["common", "uncommon", "rare", "epic"] },
    { icon: "potion", label: "Poção Pequena", rarities: ["common"] },
    { icon: "potionLarge", label: "Poção Grande", rarities: ["uncommon"] },
  ];
  for (const def of ICONS) {
    out.push({
      kind: "object",
      id: `item.${def.icon}`,
      group: "Itens",
      label: def.label,
      description: `Drop no chão, da esquerda para a direita: ${def.rarities.map((r) => RARITY_LABEL[r]).join(", ")}. A cor do anel, o feixe de luz e o glow seguem a raridade.`,
      size: 2.2,
      build: () => {
        const group = new THREE.Group();
        const views = def.rarities.map((r, i) => {
          const v = new DropView(def.icon, r);
          v.group.position.x = (i - (def.rarities.length - 1) / 2) * 1.4;
          group.add(v.group);
          return v;
        });
        return { object: group, update: (t) => views.forEach((v) => v.update(t)) };
      },
    });
  }

  for (const id of Object.keys(SKILLS) as SkillId[]) {
    const s = SKILLS[id];
    out.push({
      kind: "object",
      id: `skill.${id}`,
      group: "Habilidades",
      label: s.name,
      description: `${s.description} Recarga ${s.cooldown}s. Para ver a animação no herói, escolha um herói e a animação correspondente.`,
      size: 1.6,
      build: () => {
        const v = new DropView(id, "rare");
        v.group.scale.setScalar(1.6);
        return { object: v.group, update: (t) => v.update(t) };
      },
    });
  }

  for (const kind of ["arrow", "piercingArrow", "bolt", "fireball"] as const) {
    out.push({
      kind: "object",
      id: `projectile.${kind}`,
      group: "Projéteis",
      label: kind === "arrow" ? "Flecha" : kind === "piercingArrow" ? "Flecha perfurante" : kind === "bolt" ? "Raio arcano" : "Bola de fogo",
      description: PROJECTILE_DESCRIPTIONS[kind] ?? "",
      size: 1.2,
      build: () => {
        const m = createProjectileMesh(kind);
        m.position.y = 0.9;
        return { object: m, update: (t) => { if (kind === "fireball" || kind === "bolt") m.rotation.z = t * 6; } };
      },
    });
  }

  for (const [label, build] of Object.entries(PROP_BUILDERS)) {
    out.push({
      kind: "object",
      id: `prop.${label}`,
      group: "Cenário",
      label,
      description: "Adereço instanciado pelo cenário, em voxels de 25 cm.",
      size: label.startsWith("Árvore") ? 3.4 : 1.8,
      build: () => {
        const m = new THREE.Mesh(build(), voxelMaterial());
        m.castShadow = m.receiveShadow = true;
        return { object: m };
      },
    });
  }

  return out;
}
