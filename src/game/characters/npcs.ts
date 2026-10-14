import { PAL, shades, type CharacterModel } from "./common";
import { buildHumanoid } from "./humanoid";

/** Aldeões do santuário: mesma silhueta do herói, roupas e adereços próprios. */
export function createVillager(variant: "elder" | "smith" | "guard" | "merchant"): CharacterModel {
  const skin = shades(variant === "smith" ? "#c98a5e" : variant === "merchant" ? "#a8704a" : "#e8b893", 0.09);
  const hair = shades(variant === "elder" ? "#e9e4d8" : variant === "smith" ? "#2b2b2b" : variant === "merchant" ? "#1e1a18" : "#5a3a1a", 0.08);
  const cloth = shades(variant === "elder" ? "#5a3f8f" : variant === "smith" ? "#6b4a2b" : variant === "merchant" ? "#2f8a7a" : "#7a8290", 0.1);
  const wide = variant === "smith";
  return buildHumanoid({
    skin,
    legs: { hw: 2, hd: 2, length: 12 },
    arms: { hw: wide ? 3 : 2, hd: wide ? 3 : 2, length: 12 },
    head: { hw: 6, h: 12, hd: 6 },
    torso: { hw: wide ? 8 : 7, h: 14, hd: 4 },
    legX: 3,
    armX: wide ? 11 : 9,
    pants: shades(variant === "elder" ? "#3b2a66" : variant === "merchant" ? "#8a2f4a" : "#4a3a2a", 0.08),
    boots: shades("#2b2b2b", 0.1),
    bootH: 3,
    sleeve: cloth,
    sleeveLen: variant === "smith" ? 0 : variant === "elder" || variant === "merchant" ? 10 : 6,
    face: { mouth: variant === "guard" ? "flat" : "smile" },
    mouthY: 3,
    topExtra: variant === "guard" ? 4 : variant === "merchant" ? 3 : 0,
    torsoPaint: (b, y) => {
      if (variant === "elder") {
        b.box(-8, y - 3, -5, 8, y + 2, 5, cloth.dark); // manto até os joelhos
        b.box(-8, y - 3, -5, 8, y - 2, 5, PAL.gold.dark);
        b.box(-1, y + 4, -5, 1, y + 13, -4, PAL.gold.base); // faixa central
        b.box(-7, y + 5, -5, 7, y + 6, 5, PAL.gold.base);
      }
      if (variant === "smith") {
        const apron = shades("#3a3a3a", 0.1);
        b.box(-6, y - 2, -5, 6, y + 12, -4, apron.base); // avental de couro
        b.box(-6, y + 9, -5, 6, y + 12, -4, apron.light);
        b.box(-1, y - 2, -5, 1, y + 9, -4, apron.dark);
        b.box(-8, y + 1, -5, 8, y + 3, 5, PAL.leather.base); // cinto
        b.box(-3, y + 12, -5, -1, y + 14, 5, apron.base).box(1, y + 12, -5, 3, y + 14, 5, apron.base); // alças
      }
      if (variant === "merchant") {
        // Saia longa em vinho, faixa dourada, colete turquesa com bordado e bolsa de moedas.
        const skirt = shades("#8a2f4a", 0.1);
        b.box(-8, y - 6, -5, 8, y + 3, 5, skirt.base).box(-8, y - 6, -5, 8, y - 5, 5, skirt.dark);
        for (const x of [-6, -2, 2, 6]) b.box(x, y - 6, -6, x + 1, y + 2, -5, skirt.light); // pregas
        b.box(-8, y + 2, -5, 8, y + 4, 5, PAL.gold.base).box(-8, y + 3, -5, 8, y + 4, 5, PAL.gold.light);
        b.box(-7, y + 4, -5, -3, y + 13, -4, cloth.dark).box(3, y + 4, -5, 7, y + 13, -4, cloth.dark); // abas do colete
        for (let yy = y + 5; yy < y + 13; yy += 2) b.set(-5, yy, -5, PAL.gold.light).set(4, yy, -5, PAL.gold.light); // bordado
        b.box(5, y - 2, -6, 9, y + 3, -3, PAL.leather.base).box(6, y + 2, -6, 8, y + 4, -4, PAL.leather.dark); // bolsa
        b.set(7, y, -7, PAL.gold.light).set(6, y + 1, -7, PAL.gold.base); // moedas espiando
      }
      if (variant === "guard") {
        b.box(-7, y + 2, -5, 7, y + 4, 5, PAL.leather.base);
        b.box(-4, y + 4, -5, 4, y + 13, -4, "#3b5aa6"); // tabardo azul do santuário
        b.box(-1, y + 6, -6, 1, y + 10, -5, PAL.gold.base).box(-2, y + 7, -6, 2, y + 9, -5, PAL.gold.base); // brasão
        for (const s of [-1, 1]) b.box(s > 0 ? 7 : -10, y + 11, -5, s > 0 ? 10 : -7, y + 15, 5, PAL.steel.base);
      }
    },
    headPaint: (b) => {
      // Cabelo curto nos três; barba no ancião e no ferreiro; elmo no guarda.
      b.box(-6, 12, -6, 6, 14, 6, hair.base).box(-6, 9, 5, 6, 12, 6, hair.base);
      b.box(-6, 11, -7, 6, 12, -6, hair.dark);
      if (variant === "elder") {
        b.box(-4, -5, -7, 4, 3, -6, hair.base).box(-3, -8, -7, 3, -5, -6, hair.light); // barba longa
        b.box(-6, 3, -7, -4, 5, -6, hair.base).box(4, 3, -7, 6, 5, -6, hair.base); // bigode
        b.carve(-6, 12, -6, 6, 14, 6).box(-6, 12, -6, 6, 13, 6, hair.base); // careca com coroa de cabelo
        b.carve(-4, 12, -4, 4, 14, 4);
      }
      if (variant === "smith") {
        b.box(-4, 0, -7, 4, 3, -6, hair.base); // barba curta
        b.box(-6, 11, -7, 6, 14, 7, "#8a1f1f"); // bandana
      }
      if (variant === "merchant") {
        // Lenço colorido amarrado na cabeça, argolas de ouro e uma trança.
        b.box(-7, 10, -7, 7, 15, 7, "#e0a030").box(-7, 14, -7, 7, 15, 7, "#f0c050");
        b.box(-7, 11, -8, 7, 12, -7, "#c0392b");
        b.box(5, 11, 6, 9, 13, 9, "#e0a030").box(7, 8, 7, 9, 11, 9, "#c0392b"); // nó
        b.set(-7, 5, -1, PAL.gold.light).set(6, 5, -1, PAL.gold.light); // argolas
        b.box(-2, 1, 6, 2, 11, 8, hair.base).box(-1, -3, 7, 1, 1, 8, hair.base).set(0, -4, 7, "#c0392b"); // trança
      }
      if (variant === "guard") {
        b.box(-7, 8, -7, 7, 15, 7, PAL.steel.base).box(-7, 14, -7, 7, 15, 7, PAL.steel.light);
        b.box(-1, 2, -8, 1, 9, -7, PAL.steel.dark); // nasal
        b.box(-1, 15, -3, 1, 19, 4, "#b8322f"); // crista
      }
    },
    offhandPaint: (b) => {
      if (variant === "elder") {
        b.box(-1, -30, -1, 1, 6, 0, PAL.wood.base);
        b.sphere(0, 9, -1, 3, 3, 3, "#5fd36b").set(1, 11, -3, "#b9ffc0");
        b.box(-2, 5, -2, 2, 7, 1, PAL.gold.base);
      }
      if (variant === "smith") {
        b.box(-1, -22, -1, 1, -8, 0, PAL.wood.base);
        b.box(-4, -27, -3, 4, -21, 2, PAL.darkSteel.base).box(-4, -27, -3, 4, -21, -2, PAL.darkSteel.light); // martelo
      }
      if (variant === "merchant") {
        // Balança de comerciante na mão.
        b.box(0, -14, -1, 1, -9, 0, PAL.gold.base);
        b.box(-4, -15, -1, 5, -14, 0, PAL.gold.base);
        b.box(-5, -19, -2, -2, -18, 1, PAL.gold.dark).box(3, -19, -2, 6, -18, 1, PAL.gold.dark);
        b.set(-4, -17, -1, PAL.gold.base).set(4, -17, -1, PAL.gold.base).set(-3, -16, -1, PAL.gold.base).set(5, -16, -1, PAL.gold.base);
      }
      if (variant === "guard") {
        b.box(-1, -36, -1, 1, 12, 0, PAL.wood.base);
        b.box(-1, 12, -1, 1, 20, 0, PAL.steel.base).box(0, 20, -1, 1, 22, 0, PAL.steel.light); // ponta da lança
        b.box(-2, 11, -1, 2, 12, 0, PAL.gold.base);
      }
    },
  });
}
