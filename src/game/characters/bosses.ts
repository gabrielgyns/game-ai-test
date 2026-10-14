import { PAL, shades, tone, type CharacterModel } from "./common";
import { buildHumanoid } from "./humanoid";
import { createSpider } from "./mobs";

/* ---------- Rei Goblin: gordo, coroado, capa, machado real ---------- */

export function createGoblinKing(): CharacterModel {
  const skin = shades("#6a9c3c", 0.1);
  const armor = shades("#5a2e2e", 0.1);
  const gold = PAL.gold;
  const cape = shades("#7a1f2b", 0.1);
  return buildHumanoid({
    skin,
    legs: { hw: 3, hd: 3, length: 16 },
    arms: { hw: 3, hd: 3, length: 20 },
    head: { hw: 9, h: 16, hd: 9 },
    torso: { hw: 14, h: 24, hd: 8 },
    legX: 6,
    armX: 17,
    pants: shades("#3a2a1a", 0.08),
    boots: shades("#1e1b19", 0.1),
    bootH: 4,
    sleeve: armor,
    sleeveLen: 6,
    face: { eye: "#ffd54a", mouth: "grin", brow: "#2f4a1a" },
    mouthY: 4,
    neck: 1,
    topExtra: 6,
    torsoPaint: (b, y) => {
      b.box(-14, y + 3, -9, 14, y + 7, 9, gold.base).box(-14, y + 6, -9, 14, y + 7, 9, gold.light); // cinturão dourado
      b.box(-3, y + 3, -10, 3, y + 7, -9, "#e5484d").box(-2, y + 4, -11, 2, y + 6, -10, "#ff8a8a"); // rubi da fivela
      b.sphere(0, y + 12, -8, 9, 6, 2, armor.light); // barriga saliente
      b.box(-14, y + 16, -9, 14, y + 19, -8, armor.dark); // faixa do peito
      for (const x of [-10, -5, 0, 5]) b.box(x, y + 16, -10, x + 2, y + 19, -9, PAL.teeth); // troféus de dentes
      // Capa: cai das costas até perto do chão, com dobras.
      b.box(-16, y - 10, 8, 16, y + 24, 11, cape.base);
      for (const x of [-12, -6, 0, 6, 12]) b.box(x, y - 10, 10, x + 1, y + 22, 11, cape.dark);
      b.box(-16, y - 10, 8, 16, y - 8, 11, cape.dark);
      b.box(-16, y + 22, 8, 16, y + 24, 11, gold.base); // gola
      b.box(-15, y - 6, 11, -9, y + 2, 12, cape.light); // dobra solta
      // Ombreiras com espetos.
      for (const s of [-1, 1]) {
        b.box(s > 0 ? 14 : -19, y + 20, -8, s > 0 ? 19 : -14, y + 25, 8, armor.dark);
        b.box(s > 0 ? 14 : -19, y + 24, -8, s > 0 ? 19 : -14, y + 25, 8, gold.base);
        b.box(s > 0 ? 16 : -17, y + 25, -1, s > 0 ? 17 : -16, y + 29, 1, PAL.darkSteel.light);
      }
    },
    headPaint: (b) => {
      // Orelhas enormes, nariz de batata, coroa com rubi.
      for (const s of [-1, 1]) {
        b.box(s > 0 ? 9 : -15, 7, -1, s > 0 ? 15 : -9, 10, 1, skin.base);
        b.box(s > 0 ? 13 : -17, 9, -1, s > 0 ? 17 : -13, 12, 0, skin.base);
      }
      b.sphere(0, 6, -10, 2, 2, 2, skin.dark);
      b.box(-9, 15, -9, 9, 17, 9, gold.base).box(-9, 16, -9, 9, 17, 9, gold.light); // base da coroa
      for (let i = -9; i < 9; i += 3) {
        b.box(i, 17, -9, i + 1, 20, -8, gold.base).box(i, 17, 8, i + 1, 20, 9, gold.base);
        b.box(-9, 17, i, -8, 20, i + 1, gold.base).box(8, 17, i, 9, 20, i + 1, gold.base);
      }
      b.box(-1, 17, -10, 1, 20, -9, "#e5484d").set(0, 19, -10, "#ff8a8a"); // rubi
      b.box(-3, 3, -10, 3, 4, -9, PAL.pupil); // sombra sob o nariz
    },
    weaponPaint: (b) => {
      b.box(-1, -42, -1, 1, -16, 0, PAL.wood.dark); // cabo real
      b.box(-2, -40, -16, 2, -24, 0, PAL.steel.base); // lâmina enorme
      b.box(-2, -39, -18, 2, -25, -16, gold.light); // fio dourado
      b.box(-2, -40, 0, 2, -24, 10, PAL.steel.base).box(-2, -39, 10, 2, -25, 12, gold.light); // lâmina dupla
      b.box(-2, -34, -12, 2, -32, -4, tone("#5a2e2e", -0.1)); // gravura
      b.box(-2, -41, -1, 2, -23, 1, PAL.darkSteel.base);
      b.box(-1, -44, -1, 1, -42, 0, gold.base); // ponteira
    },
  });
}

export function createSpiderQueen(): CharacterModel {
  return createSpider(true);
}
