import { describe, expect, it } from "vitest";
import { restoreGame, serializeGame } from "./save";
import {
  ACTIVE_SLOT_KEY, LEGACY_SAVE_KEY, SLOT_COUNT, SaveSlots, formatPlayTime, sanitizeHeroName, slotKey,
  type KeyValueStore,
} from "./saveSlots";
import { generateWorld } from "./worldgen";

/** localStorage de mentira: um Map com a mesma interface. */
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function saveOf(classId: "warrior" | "archer" | "mage", name: string, level = 1) {
  const world = generateWorld({ seed: 7, classId });
  const p = world.player!;
  p.name = name;
  p.progression!.level = level;
  p.wallet!.gold = 42;
  world.time = 3725;
  return serializeGame(world, 7);
}

describe("slots de save", () => {
  it("começa com todos os slots vazios e sem slot ativo", () => {
    const slots = new SaveSlots(memoryStore());
    expect(slots.list()).toHaveLength(SLOT_COUNT);
    expect(slots.list().every((s) => s.empty)).toBe(true);
    expect(slots.activeSlot).toBeNull();
    expect(slots.firstEmpty()).toBe(1);
  });

  it("cada slot guarda um jogo independente e o resumo mostra herói, classe e progresso", () => {
    const slots = new SaveSlots(memoryStore());
    expect(slots.write(2, saveOf("archer", "Lia", 5))).toBe(true);
    expect(slots.write(4, saveOf("mage", "Orin", 2))).toBe(true);

    const list = slots.list();
    expect(list.map((s) => s.empty)).toEqual([true, false, true, false, true]);
    const two = list[1]!;
    if (two.empty) throw new Error("slot 2 deveria ter save");
    expect(two).toMatchObject({ heroName: "Lia", classId: "archer", className: "Arqueiro", level: 5, gold: 42, playTime: 3725 });
    expect(slots.read(4)!.player.heroName).toBe("Orin");
    expect(slots.firstEmpty()).toBe(1);
  });

  it("apagar um slot libera só ele e esquece o slot ativo se era ele", () => {
    const slots = new SaveSlots(memoryStore());
    slots.write(1, saveOf("warrior", "A"));
    slots.write(2, saveOf("warrior", "B"));
    slots.activeSlot = 2;
    slots.remove(2);
    expect(slots.read(2)).toBeNull();
    expect(slots.read(1)).not.toBeNull();
    expect(slots.activeSlot).toBeNull();
  });

  it("migra o save único antigo para um slot livre e o torna ativo", () => {
    const legacy = JSON.stringify(saveOf("warrior", "Velho", 7));
    const store = memoryStore({ [LEGACY_SAVE_KEY]: legacy });
    const slots = new SaveSlots(store);
    expect(slots.migrateLegacy()).toBe(1);
    expect(store.data.has(LEGACY_SAVE_KEY)).toBe(false);
    expect(slots.activeSlot).toBe(1);
    expect(slots.read(1)!.player.level).toBe(7);
    expect(slots.migrateLegacy()).toBeNull(); // segunda vez não faz nada
  });

  it("migração não sobrescreve slots ocupados nem o slot ativo escolhido", () => {
    const store = memoryStore({ [LEGACY_SAVE_KEY]: JSON.stringify(saveOf("mage", "Velho")) });
    const slots = new SaveSlots(store);
    slots.write(1, saveOf("archer", "Novo"));
    slots.activeSlot = 1;
    expect(slots.migrateLegacy()).toBe(2);
    expect(slots.read(1)!.player.heroName).toBe("Novo");
    expect(slots.activeSlot).toBe(1);
  });

  it("dados corrompidos contam como slot vazio, e slots fora do intervalo são ignorados", () => {
    const store = memoryStore({ [slotKey(3)]: "{não é json", [ACTIVE_SLOT_KEY]: "99" });
    const slots = new SaveSlots(store);
    expect(slots.read(3)).toBeNull();
    expect(slots.list()[2]!.empty).toBe(true);
    expect(slots.activeSlot).toBeNull();
    expect(slots.write(0, saveOf("warrior", "X"))).toBe(false);
    expect(slots.write(SLOT_COUNT + 1, saveOf("warrior", "X"))).toBe(false);
  });

  it("armazenamento que lança erro não derruba o jogo", () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("cota"); },
      removeItem: () => { throw new Error("bloqueado"); },
    };
    const slots = new SaveSlots(broken);
    expect(slots.list().every((s) => s.empty)).toBe(true);
    expect(slots.write(1, saveOf("warrior", "X"))).toBe(false);
    expect(slots.activeSlot).toBeNull();
    expect(() => { slots.activeSlot = 1; slots.remove(1); }).not.toThrow();
  });

  it("o nome do herói faz a viagem pelo save e saves antigos usam o nome da classe", () => {
    const save = saveOf("archer", "Lia");
    expect(restoreGame(save).player!.name).toBe("Lia");
    delete save.player.heroName;
    expect(restoreGame(save).player!.name).toBe("Arqueiro");
    const slots = new SaveSlots(memoryStore());
    slots.write(1, save);
    const s = slots.list()[0]!;
    expect(!s.empty && s.heroName).toBe("Arqueiro");
  });

  it("conta quests concluídas no resumo", () => {
    const save = saveOf("warrior", "Q");
    save.player.quests.slimes = { state: "completed", progress: 5 };
    const slots = new SaveSlots(memoryStore());
    slots.write(1, save);
    const s = slots.list()[0]!;
    expect(!s.empty && s.questsDone).toBe(1);
  });
});

describe("textos de slot", () => {
  it("formata tempo de jogo", () => {
    expect(formatPlayTime(40)).toBe("40s");
    expect(formatPlayTime(720)).toBe("12min");
    expect(formatPlayTime(3725)).toBe("1h 02min");
  });

  it("limpa o nome digitado", () => {
    expect(sanitizeHeroName("   Sir   Gosma  ")).toBe("Sir Gosma");
    expect(sanitizeHeroName("NomeMuitoMuitoComprido")).toHaveLength(16);
  });
});
