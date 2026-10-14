import * as THREE from "three";
import type { Entity } from "../domain/components";
import type { Item, Rarity } from "../domain/items";
import type { ClassId } from "../domain/classes";
import { CLASSES, CLASS_ORDER } from "../domain/classes";
import { ENEMY_TEMPLATES, createEnemy, createPlayer, type EnemyKind } from "../domain/factories";
import { createGoblinKing, createScorpionEmperor, createSkeletonLord, createSpiderQueen } from "../domain/boss";
import { NPC_DEFS, createNpc } from "../domain/npc";
import { SKILLS, type SkillId } from "../domain/skills";
import { RARITY_LABEL } from "../domain/items";
import { DropView } from "../game/dropViews";
import { createProjectileMesh } from "../game/projectileViews";
import { createBraziers, stallGeometry } from "../game/environment";
import { buildLods, PROP_MODELS, propVoxels, type PropKind, type PropLods } from "../game/props/catalog";
import { LEGACY_PROPS } from "./legacyProps";
import { createSetPiece } from "../domain/sets";
import type { VoxelBuilder } from "../game/voxel";
import { FOLIAGE_BUILDERS } from "../game/foliage";
import { createPortal } from "../game/portal";
import { terrainHeight } from "../domain/terrain";
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
      build: (opts: { lod: LodLevel }) => { object: THREE.Object3D; update?: (time: number) => void };
      size: number;
      /** A versão anterior do modelo, para comparar lado a lado. */
      legacy?: () => THREE.Object3D;
      /** Voxels do modelo (para exportar como .vox) e quantos metros tem cada voxel. */
      voxels?: () => VoxelBuilder;
      voxel?: number;
      /** O modelo tem níveis de detalhe (LOD) para escolher na barra. */
      lods?: boolean;
    };

export type LodLevel = keyof PropLods;

/** Qual adereço antigo corresponde a cada modelo novo (para a comparação). */
const LEGACY_OF: Partial<Record<PropKind, string>> = {
  oak1: "Árvore 1", oak2: "Árvore 2", oakAutumn: "Árvore 3", boulder1: "Pedra 1", boulder2: "Pedra 2",
  deadTree1: "Árvore morta 1", deadTree2: "Árvore morta 2", mushrooms: "Cogumelo", cactus1: "Cacto 1", cactus2: "Cacto 2",
  bones: "Ossada", pillar: "Pilar do santuário", totem: "Totem goblin", cocoon: "Casulo de teia",
  obelisk: "Obelisco do deserto", obeliskBroken: "Obelisco quebrado",
};

const lodCache = new Map<PropKind, PropLods>();
const lodsOf = (kind: PropKind): PropLods => {
  let l = lodCache.get(kind);
  if (!l) lodCache.set(kind, (l = buildLods(kind)));
  return l;
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
  {
    id: "set",
    label: "Armadura do Imperador (conjunto)",
    weapon: (c) => createSetPiece("scorpionEmperor", "weapon", c),
    armor: createSetPiece("scorpionEmperor", "armor"),
    accessory: createSetPiece("scorpionEmperor", "accessory"),
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
  goblinArcher: "Goblin com capuz de folhas, arco curto e aljava. Atira de longe e recua se você chegar perto.",
  skeleton: "Esqueleto da cripta: costelas vazadas, trapo roxo na cintura, olhos azuis nas órbitas e espada enferrujada.",
  skeletonArcher: "Esqueleto com capuz e aljava. Atira de longe na cripta; os olhos verdes entregam a posição.",
  banditArcher: "Salteador de roupa anil, arco longo e aljava. O aviso é uma linha no chão: saia dela de lado.",
};

const PROJECTILE_DESCRIPTIONS: Record<string, string> = {
  arrow: "Flecha do Arqueiro. Ataque básico, 18 m de alcance.",
  piercingArrow: "Tiro Perfurante: atravessa todos os inimigos em linha.",
  bolt: "Raio arcano do Mago. Ataque básico, 16 m.",
  fireball: "Bola de Fogo: lenta, explode em 2,8 m.",
  stinger: "Espinho do Imperador Escorpião, disparado em leque.",
  bone: "Osso girando da Rajada de Ossos do Lorde Esqueleto.",
  acidGlob: "Cuspe Ácido: voa em arco até o ponto avisado e deixa uma poça que queima por 8 s.",
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
    {
      kind: "character",
      id: "boss.scorpionEmperor",
      group: "Chefes",
      label: "Imperador Escorpião",
      description: "Chefe do deserto. Carapaça obsidiana com placas de ouro, coroa com esmeralda, olhos e bulbo de ácido que brilham. Ferroada, Rajada de Espinhos em leque, Cuspe Ácido que deixa poças e uma Carapaça de Areia que só habilidades quebram.",
      size: 5.2,
      spawn: (id) => createScorpionEmperor(id, { x: 0, y: 0, z: 0 }),
    },
    {
      kind: "character",
      id: "boss.skeletonLord",
      group: "Chefes",
      label: "Lorde Esqueleto",
      description: "Chefe da Cripta Esquecida. Armadura negra sobre costelas expostas, capa roxa rasgada, coroa enferrujada e montante de osso com runa. Golpe Sepulcral, Rajada de Ossos em leque, Pisão Sepulcral, Investida Fantasma e esqueletos na fúria. Escala com o nível da cripta.",
      size: 5,
      spawn: (id) => createSkeletonLord(id, { x: 0, y: 0, z: 0 }),
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

  for (const kind of ["arrow", "piercingArrow", "bolt", "fireball", "stinger", "acidGlob", "bone"] as const) {
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

  for (const [label, build] of Object.entries(FOLIAGE_BUILDERS)) {
    out.push({
      kind: "object",
      id: `foliage.${label}`,
      group: "Cenário",
      label,
      description: "Vegetação rasteira em voxels de 6 cm. No jogo são dezenas de milhares, balançando ao vento.",
      size: 0.7,
      build: () => {
        const m = new THREE.Mesh(build(), voxelMaterial());
        m.castShadow = m.receiveShadow = true;
        return { object: m };
      },
    });
  }
  out.push({
    kind: "object",
    id: "prop.portal",
    group: "Cenário",
    label: "Portal da cripta",
    description: "Arco de pedra com runas e véu roxo que gira. Leva à Cripta Esquecida; o verde, dentro dela, traz de volta depois da vitória.",
    size: 3.4,
    build: () => {
      const p = createPortal();
      return { object: p.group, update: (t: number) => p.update(t) };
    },
  });
  out.push({
    kind: "object",
    id: "prop.braseiro",
    group: "Cenário",
    label: "Braseiro do santuário",
    description: "Chama que tremula sobre os pilares; à noite brilha e ilumina a praça.",
    size: 1.2,
    build: () => {
      const b = createBraziers();
      // Mostra só o primeiro braseiro, centrado: o grupo inteiro está no anel do santuário.
      const holder = new THREE.Group();
      b.group.position.set(-8.5, -(terrainHeight(0, 0) + 1.5), -0.5);
      holder.add(b.group);
      return { object: holder, update: (t: number) => b.update(t, 1) };
    },
  });
  for (const [kind, model] of Object.entries(PROP_MODELS) as [PropKind, (typeof PROP_MODELS)[PropKind]][]) {
    const legacyLabel = LEGACY_OF[kind];
    const legacyBuild = legacyLabel ? LEGACY_PROPS[legacyLabel] : undefined;
    out.push({
      kind: "object",
      id: `prop.${model.id}`,
      group: "Cenário",
      label: model.label,
      description: `Esculpido em voxels de 1/${Math.round(1 / model.voxel)} m, com três níveis de detalhe (perto, meio, longe). Para trocar por um desenho seu, salve assets/vox/${model.id}.vox.`,
      get size() {
        const g = lodsOf(kind).hi;
        if (!g.boundingBox) g.computeBoundingBox();
        const box = g.boundingBox!;
        // O lab enquadra pela altura; peças largas e baixas precisam de um pouco mais de recuo.
        return Math.max(box.max.y - box.min.y, (box.max.x - box.min.x) * 0.8, (box.max.z - box.min.z) * 0.8);
      },
      voxels: () => propVoxels(kind),
      voxel: model.voxel,
      lods: true,
      build: ({ lod }) => {
        const m = new THREE.Mesh(lodsOf(kind)[lod], voxelMaterial());
        m.castShadow = m.receiveShadow = true;
        return { object: m };
      },
      legacy: legacyBuild
        ? () => {
            const m = new THREE.Mesh(legacyBuild(), voxelMaterial());
            m.castShadow = m.receiveShadow = true;
            return m;
          }
        : undefined,
    });
  }
  out.push({
    kind: "object",
    id: "prop.barraca",
    group: "Cenário",
    label: "Barraca da Mercadora",
    description: "Balcão, toldo listrado e caixotes, em voxels de 1/8 m.",
    size: 5,
    build: () => {
      const m = new THREE.Mesh(stallGeometry(), voxelMaterial());
      m.castShadow = m.receiveShadow = true;
      return { object: m };
    },
  });

  return out;
}
