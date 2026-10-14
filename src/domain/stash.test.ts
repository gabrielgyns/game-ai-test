import { beforeEach, describe, expect, it } from "vitest";
import { createStash, deposit, restoreStash, STASH_TAB_SIZE, stashCount, withdraw } from "./stash";
import { createInventory } from "./inventory";
import { createEquipment, createPotion, resetItemIds } from "./items";

beforeEach(() => resetItemIds());

describe("baú do santuário", () => {
  it("guardar tira da mochila e põe na aba; tirar faz o caminho de volta", () => {
    const stash = createStash();
    const inv = createInventory(4);
    const sword = createEquipment(() => 0.3, 2, "rare");
    inv.items[1] = sword;
    expect(deposit(stash, inv, 1, 2)).toBe(true);
    expect(inv.items[1]).toBeNull();
    expect(stash.tabs[2]![0]).toBe(sword);
    expect(withdraw(stash, inv, 2, 0)).toBe(true);
    expect(inv.items[0]).toBe(sword);
    expect(stashCount(stash)).toBe(0);
  });

  it("poções empilham no baú", () => {
    const stash = createStash();
    const inv = createInventory(4);
    inv.items[0] = createPotion("small", 3);
    inv.items[1] = createPotion("small", 2);
    deposit(stash, inv, 0, 0);
    deposit(stash, inv, 1, 0);
    expect(stash.tabs[0]![0]!.quantity).toBe(5);
    expect(stashCount(stash)).toBe(1);
  });

  it("aba cheia ou mochila cheia: nada se perde", () => {
    const stash = createStash();
    const inv = createInventory(1);
    stash.tabs[0] = Array.from({ length: STASH_TAB_SIZE }, () => createEquipment(() => 0.5, 1, "common"));
    inv.items[0] = createEquipment(() => 0.5, 1, "common");
    expect(deposit(stash, inv, 0, 0)).toBe(false);
    expect(inv.items[0]).not.toBeNull();
    expect(withdraw(stash, inv, 0, 3)).toBe(false);
    expect(stash.tabs[0]![3]).not.toBeNull();
  });

  it("restaura de JSON com ids novos e ignora lixo", () => {
    const stash = createStash();
    stash.tabs[1]![4] = createEquipment(() => 0.5, 1, "rare");
    resetItemIds(500);
    const back = restoreStash(JSON.parse(JSON.stringify(stash)));
    expect(back.tabs[1]![4]!.name).toBe(stash.tabs[1]![4]!.name);
    expect(back.tabs[1]![4]!.id).toBe(500);
    expect(stashCount(restoreStash({ tabs: [[1, "x", null]] }))).toBe(0);
    expect(stashCount(restoreStash(null))).toBe(0);
  });
});
