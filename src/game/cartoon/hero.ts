import * as THREE from "three";
import type { ClassId } from "../../domain/classes";
import type { Equipment } from "../../domain/inventory";
import type { Item } from "../../domain/items";
import { BLADE_BY_RARITY, RARITY_GLOW, lookRarity, type CharacterModel } from "../characters/common";
import { ball, bladeGeometry, capsule, cone, frustum, neonMaterial, part, roundedBox, toonMaterial } from "./toon";

/**
 * Herói cartoon: o mesmo boneco articulado do voxel (pivôs no quadril, ombro e pescoço, animados
 * pelo EntityView), mas modelado com formas lisas. Proporção de anime de ação: cabeça um pouco
 * grande, ombros largos, cintura fina e botas pesadas.
 *
 * O equipamento continua decidindo o visual: a armadura troca roupa, ombreiras e capacete; a arma
 * troca o que vai na mão; a raridade acende o neon (lâmina e frisos da armadura).
 *
 * Capa e penacho têm "molas": um pouco de atraso físico que dá vida sem nenhuma animação desenhada.
 */

const INK = "#1c1410";
/** O voxel tem ~2,5 m; o cartoon é modelado em ~1,85 m e ampliado para ocupar o mesmo espaço. */
const SCALE = 1.3;

interface Palette {
  skin: string;
  hair: string;
  cloth: string;
  clothDark: string;
  armor: string;
  armorDark: string;
  trim: string;
  boots: string;
  cape: string | null;
}

function palette(classId: ClassId, visual: string): Palette {
  const hair = classId === "mage" ? "#d8d4f0" : classId === "archer" ? "#3a2618" : "#d8352a";
  const cloth = classId === "archer" ? "#3f7a3a" : classId === "mage" ? "#5a3f8f" : "#3b5aa6";
  switch (visual) {
    case "plate":
      return { skin: "#f0c4a0", hair, cloth: "#4a3a4a", clothDark: "#2e2432", armor: "#5a5870", armorDark: "#3a384a", trim: "#d4a92a", boots: "#3a384a", cape: "#a8242c" };
    case "chain":
      return { skin: "#f0c4a0", hair, cloth: "#5a4a3a", clothDark: "#3a2e24", armor: "#9aa2b0", armorDark: "#6a7280", trim: "#c8ccd6", boots: "#3a2e24", cape: classId === "warrior" ? "#2a3f7a" : null };
    case "tunic":
      return { skin: "#f0c4a0", hair, cloth: "#8a5a2b", clothDark: "#5e3c1c", armor: "#a8743a", armorDark: "#6e4a22", trim: "#6b4a2b", boots: "#3a2618", cape: null };
    default:
      return { skin: "#f0c4a0", hair, cloth, clothDark: new THREE.Color(cloth).multiplyScalar(0.62).getStyle(), armor: cloth, armorDark: cloth, trim: "#6b4a2b", boots: "#2f2a28", cape: null };
  }
}

/** Mola amortecida de um eixo: segue o alvo com atraso e passa um pouco do ponto. */
class Spring {
  value = 0;
  private velocity = 0;
  constructor(private readonly stiffness: number, private readonly damping: number) {}
  step(target: number, dt: number): number {
    const h = Math.min(dt, 1 / 30);
    this.velocity += ((target - this.value) * this.stiffness - this.velocity * this.damping) * h;
    this.value += this.velocity * h;
    return this.value;
  }
}

export function createCartoonHero(equipment?: Equipment, classId: ClassId = "warrior"): CharacterModel {
  const armor = equipment?.armor ?? null;
  const weapon = equipment?.weapon ?? null;
  const accessory = equipment?.accessory ?? null;
  const visual = armor?.visual ?? "none";
  const pal = palette(classId, visual);
  const glows: NonNullable<CharacterModel["glowMaterials"]> = [];

  const m = {
    skin: toonMaterial(pal.skin),
    hair: toonMaterial(pal.hair),
    cloth: toonMaterial(pal.cloth),
    clothDark: toonMaterial(pal.clothDark),
    armor: toonMaterial(pal.armor, 0.6),
    armorDark: toonMaterial(pal.armorDark, 0.6),
    boots: toonMaterial(pal.boots),
    leather: toonMaterial("#5a3a22"),
    ink: toonMaterial(INK),
    white: toonMaterial("#fff6e8"),
  };
  // Frisos da armadura: dourado/prata comum, ou neon na cor da raridade da peça.
  const armorGlowColor = armor ? RARITY_GLOW[lookRarity(armor)] : null;
  const trim = armorGlowColor ? neonMaterial(armorGlowColor, armorGlowColor, 1.6) : toonMaterial(pal.trim, 0.5);
  if (armorGlowColor) glows.push({ material: trim, baseIntensity: 1.6 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(SCALE);
  root.add(body);

  const HIP_Y = 0.78;
  const SHOULDER_Y = 1.32;
  const NECK_Y = 1.42;
  const heavy = visual === "plate" || visual === "chain";

  // Quadril e tronco: peito em V (tronco de cone achatado na profundidade).
  const pelvis = part(roundedBox(0.36, 0.2, 0.24, 0.08), m.clothDark);
  pelvis.position.set(0, HIP_Y + 0.02, 0);
  body.add(pelvis);
  const chest = part(frustum(0.27, 0.17, 0.56, 16), heavy ? m.armor : m.cloth);
  chest.scale.z = 0.62;
  chest.position.set(0, HIP_Y + 0.36, 0);
  body.add(chest);
  // Cinto com fivela.
  const belt = part(frustum(0.2, 0.19, 0.07, 16), m.leather, { ink: 0.012 });
  belt.scale.z = 0.66;
  belt.position.set(0, HIP_Y + 0.12, 0);
  body.add(belt);
  const buckle = part(roundedBox(0.08, 0.07, 0.03, 0.01), trim, { ink: 0.01 });
  buckle.position.set(0, HIP_Y + 0.12, -0.13);
  body.add(buckle);
  if (heavy) {
    // Placa do peito com friso em V (a "veia" de neon da armadura).
    const plate = part(roundedBox(0.36, 0.26, 0.06, 0.03), m.armorDark, { ink: 0.012 });
    plate.position.set(0, HIP_Y + 0.44, -0.15);
    plate.rotation.x = 0.12;
    body.add(plate);
    for (const side of [-1, 1]) {
      const vein = part(roundedBox(0.035, 0.22, 0.02, 0.01), trim, { ink: 0 });
      vein.position.set(side * 0.06, HIP_Y + 0.43, -0.19);
      vein.rotation.set(0.12, 0, -side * 0.5);
      body.add(vein);
    }
  } else {
    // Gola e um "V" de tecido mais escuro: roupa, não armadura.
    const collar = part(frustum(0.13, 0.15, 0.06, 14), m.clothDark, { ink: 0.012 });
    collar.position.set(0, NECK_Y - 0.06, 0);
    body.add(collar);
  }
  // Aba da túnica caindo sobre as coxas.
  const skirt = part(frustum(0.21, 0.27, 0.22, 16), heavy ? m.clothDark : m.cloth);
  skirt.scale.z = 0.7;
  skirt.position.set(0, HIP_Y - 0.08, 0);
  body.add(skirt);

  // Amuleto/anel: uma gema no peito brilhando na cor da raridade.
  if (accessory) {
    const c = RARITY_GLOW[lookRarity(accessory)] ?? "#d4a92a";
    const gem = neonMaterial(c, c, 1.2);
    glows.push({ material: gem, baseIntensity: 1.2 });
    const g = part(ball(0.035, 10, 8), gem, { ink: 0.01 });
    g.position.set(0, HIP_Y + 0.56, -0.2);
    body.add(g);
  }

  // Pernas: coxa em cápsula e bota pesada; pivô no quadril.
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, HIP_Y, 0);
    const thigh = part(capsule(0.085, 0.32), m.clothDark);
    pivot.add(thigh);
    const boot = part(roundedBox(0.17, 0.3, 0.24, 0.06), m.boots);
    boot.position.set(0, -0.62, -0.03);
    pivot.add(boot);
    const cuff = part(frustum(0.1, 0.095, 0.06, 12), heavy ? trim : m.leather, { ink: 0.01 });
    cuff.position.set(0, -0.47, -0.01);
    pivot.add(cuff);
    body.add(pivot);
    legs.push(pivot);
  }

  // Braços: pivô no ombro; ombreira grande nas armaduras pesadas (silhueta de herói de ação).
  const arm = (side: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, SHOULDER_Y, 0);
    const upper = part(capsule(0.07, 0.3), heavy ? m.armorDark : m.cloth);
    pivot.add(upper);
    const glove = part(ball(0.085), heavy ? m.armor : m.leather);
    glove.scale.set(1, 1.1, 1);
    glove.position.set(0, -0.5, 0);
    pivot.add(glove);
    const bracer = part(frustum(0.085, 0.075, 0.14, 12), heavy ? m.armor : m.leather, { ink: 0.012 });
    bracer.position.set(0, -0.38, 0);
    pivot.add(bracer);
    if (heavy) {
      const pad = part(ball(0.16, 14, 10), m.armor);
      pad.scale.set(1.05, 0.75, 1);
      pad.position.set(side * 0.03, 0.02, 0);
      pivot.add(pad);
      const rim = part(frustum(0.165, 0.17, 0.035, 14), trim, { ink: 0.01 });
      rim.position.set(side * 0.03, -0.04, 0);
      pivot.add(rim);
    }
    body.add(pivot);
    return pivot;
  };
  const weaponArm = arm(1);
  const offArm = arm(-1);
  if (weapon) {
    const held = createWeapon(weapon, glows);
    held.position.set(0, -0.52, 0);
    weaponArm.add(held);
  }

  // Cabeça: pivô no pescoço. Rosto de anime: olhos altos e escuros com brilho branco.
  const head = new THREE.Group();
  head.position.set(0, NECK_Y, 0);
  const neck = part(capsule(0.06, 0.04), m.skin, { ink: 0 });
  neck.position.y = 0.08;
  head.add(neck);
  const skull = part(ball(0.2, 18, 14), m.skin);
  skull.scale.set(1, 1.08, 0.98);
  skull.position.y = 0.2;
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = part(capsule(0.022, 0.035, 8), m.ink, { ink: 0, castShadow: false });
    eye.position.set(side * 0.075, 0.25, -0.18);
    eye.rotation.x = -0.3;
    head.add(eye);
    const shine = part(ball(0.01, 6, 4), m.white, { ink: 0, castShadow: false });
    shine.position.set(side * 0.075 + 0.008, 0.232, -0.2);
    head.add(shine);
  }

  // Penacho/cabelo: uma mecha de cones que balança com mola (atrás da cabeça).
  const tuft = new THREE.Group();
  tuft.position.set(0, 0.36, 0.02);
  head.add(tuft);
  if (visual === "plate") {
    // Elmo fechado com fenda de visor e crista vermelha.
    const helm = part(ball(0.225, 18, 14), m.armor);
    helm.scale.set(1, 1.1, 1.02);
    helm.position.y = 0.21;
    head.add(helm);
    const visor = part(roundedBox(0.26, 0.035, 0.05, 0.015), m.ink, { ink: 0 });
    visor.position.set(0, 0.22, -0.21);
    head.add(visor);
    const brow = part(roundedBox(0.3, 0.04, 0.08, 0.02), trim, { ink: 0.01 });
    brow.position.set(0, 0.28, -0.18);
    head.add(brow);
    // Crista: leque de mechas da cor do cabelo saindo do topo do elmo, da testa até a nuca.
    for (let i = 0; i < 6; i++) {
      const spike = part(cone(0.075, 0.34 - i * 0.02, 8), m.hair, { ink: 0.012 });
      spike.position.set(0, 0.06 - i * 0.03, -0.12 + i * 0.07);
      spike.rotation.x = 0.2 + i * 0.32;
      tuft.add(spike);
    }
  } else {
    if (visual === "chain") {
      const coif = part(ball(0.215, 18, 14), m.armor);
      coif.scale.set(1, 1.05, 1);
      coif.position.set(0, 0.2, 0.02);
      head.add(coif);
      // Abertura do rosto: o contorno de dentro some atrás da pele.
      const face = part(ball(0.15, 14, 10), m.skin, { ink: 0 });
      face.scale.set(1, 1.05, 0.6);
      face.position.set(0, 0.2, -0.12);
      head.add(face);
    }
    // Cabelo espetado de anime: franja na frente e mechas para trás.
    const cap = part(ball(0.21, 16, 12), m.hair);
    cap.scale.set(1.04, 0.72, 1.05);
    cap.position.set(0, 0.3, 0.02);
    if (visual !== "chain") head.add(cap);
    const bangs = [[-0.1, -0.15, 0.3], [0, -0.17, 0], [0.1, -0.15, -0.3]] as const;
    if (visual !== "chain") {
      for (const [x, z, rz] of bangs) {
        const s = part(cone(0.06, 0.18, 8), m.hair, { ink: 0.012 });
        s.position.set(x, 0.3, z);
        s.rotation.set(-2.6, 0, rz);
        head.add(s);
      }
    }
    for (let i = 0; i < 4; i++) {
      const s = part(cone(0.065, 0.26, 8), m.hair, { ink: 0.012 });
      const a = (i - 1.5) * 0.45;
      s.position.set(Math.sin(a) * 0.12, -0.04, 0.12);
      s.rotation.set(1.9, 0, -a * 0.8);
      tuft.add(s);
    }
  }
  body.add(head);

  // Capa: um pano curvo preso nos ombros, com mola (balança para trás ao correr e ao virar).
  let cape: THREE.Group | null = null;
  if (pal.cape) {
    cape = new THREE.Group();
    cape.position.set(0, SHOULDER_Y + 0.03, 0.13);
    const cloth = new THREE.CylinderGeometry(0.34, 0.42, 0.95, 16, 4, true, -Math.PI * 0.32, Math.PI * 0.64);
    // O arco do cilindro fica em +Z (as costas); recuado para o pano encostar nos ombros.
    cloth.translate(0, -0.47, -0.2);
    const capeMat = new THREE.MeshStandardMaterial({ color: pal.cape, roughness: 0.9, side: THREE.DoubleSide });
    const sheet = new THREE.Mesh(cloth, capeMat);
    sheet.castShadow = true;
    sheet.scale.z = 0.7;
    // Contorno da capa: casca pelas costas, levemente maior (o pano é aberto, sem normais fechadas).
    const edge = new THREE.Mesh(cloth, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
    edge.scale.set(1.04, 1.02, 1.04);
    sheet.add(edge);
    cape.add(sheet);
    // Barra da capa em tom escuro.
    const hem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.425, 0.425, 0.05, 16, 1, true, -Math.PI * 0.32, Math.PI * 0.64).translate(0, -0.93, -0.2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.cape).multiplyScalar(0.55), roughness: 0.9, side: THREE.DoubleSide }),
    );
    hem.scale.z = 0.7;
    cape.add(hem);
    body.add(cape);
  }

  // Molas: capa (balanço para trás e para o lado) e mecha/penacho.
  const capeSwing = new Spring(60, 7);
  const capeSide = new Spring(45, 6);
  const tuftSwing = new Spring(90, 6);
  let lastYaw = 0;
  let bob = 0;
  const update = (dt: number, moving: boolean, time: number): void => {
    // Virar o corpo empurra o pano para o lado oposto, como na vida real.
    const yaw = root.rotation.y;
    let dYaw = yaw - lastYaw;
    if (dYaw > Math.PI) dYaw -= Math.PI * 2;
    if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    lastYaw = yaw;
    const turn = THREE.MathUtils.clamp(dYaw / Math.max(dt, 1e-3), -6, 6);
    bob = moving ? bob + dt * 11 : 0;
    if (cape) {
      cape.rotation.x = capeSwing.step(moving ? 0.55 + Math.sin(bob) * 0.08 : 0.06 + Math.sin(time * 1.3) * 0.03, dt);
      cape.rotation.z = capeSide.step(-turn * 0.08, dt);
    }
    tuft.rotation.x = tuftSwing.step(moving ? 0.35 + Math.sin(bob * 2) * 0.1 : Math.sin(time * 1.7) * 0.05, dt);
  };

  return { root, weaponArm, offArm, legs, head, height: 1.95 * SCALE, glowMaterials: glows, weaponArmRest: 0.3, update };
}

/** A arma na mão (pendurada para baixo, -Y, como no voxel; o golpe gira o braço para a frente). */
function createWeapon(weapon: Item, glows: NonNullable<CharacterModel["glowMaterials"]>): THREE.Group {
  const g = new THREE.Group();
  const rarity = lookRarity(weapon);
  const glow = RARITY_GLOW[rarity];
  const steel = toonMaterial(BLADE_BY_RARITY[rarity], 0.35);
  // Fio de neon: a lâmina inteira ganha um brilho na cor da raridade (o "neon" da referência).
  const edge = glow ? neonMaterial(BLADE_BY_RARITY[rarity], glow, 1.4) : steel;
  if (glow) glows.push({ material: edge, baseIntensity: 1.4 });
  const gold = toonMaterial("#d4a92a", 0.4);
  const wood = toonMaterial("#7a5230");
  const grip = toonMaterial("#3a2618");
  const dmg = weapon.stats.damage ?? 0;
  switch (weapon.icon) {
    case "dagger": {
      g.add(at(part(capsule(0.025, 0.1, 8), grip, { ink: 0.01 }), 0, 0.08, 0));
      g.add(at(part(roundedBox(0.16, 0.03, 0.04, 0.012), gold, { ink: 0.01 }), 0, -0.06, 0));
      g.add(at(part(bladeGeometry(0.32, 0.07, 0.015), edge, { ink: 0.01 }), 0, -0.07, 0));
      break;
    }
    case "axe": {
      g.add(at(part(capsule(0.03, 0.85, 8), wood, { ink: 0.012 }), 0, 0.14, 0));
      const head = part(roundedBox(0.04, 0.26, 0.24, 0.02), steel, { ink: 0.012 });
      g.add(at(head, 0, -0.62, -0.14));
      g.add(at(part(roundedBox(0.03, 0.3, 0.05, 0.015), edge, { ink: 0 }), 0, -0.62, -0.27));
      if (dmg >= 14) g.add(at(part(roundedBox(0.04, 0.26, 0.24, 0.02), steel, { ink: 0.012 }), 0, -0.62, 0.14));
      break;
    }
    case "bow": {
      // Arco em pé: um pedaço de toro curvado para a frente (-Z), com a mão no meio e a corda atrás.
      const R = 0.55, half = Math.PI * 0.375;
      const limbGeo = new THREE.TorusGeometry(R, 0.028, 6, 20, half * 2).rotateZ(-half).rotateY(Math.PI / 2).translate(0, 0, R);
      g.add(part(limbGeo, wood, { ink: 0.01 }));
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2 * R * Math.sin(half), 4), toonMaterial("#f0ead8"));
      string.position.set(0, 0, R - R * Math.cos(half));
      g.add(string);
      g.add(at(part(capsule(0.04, 0.12, 8), glow ? edge : grip, { ink: 0.01 }), 0, 0.1, 0));
      break;
    }
    case "staff": {
      g.add(at(part(capsule(0.028, 1.15, 8), wood, { ink: 0.012 }), 0, 0.75, 0));
      const orb = part(ball(0.09, 14, 10), edge, { ink: 0.012 });
      orb.position.set(0, 0.88, 0);
      g.add(orb);
      for (let i = 0; i < 3; i++) {
        const claw = part(cone(0.025, 0.14, 6), gold, { ink: 0.008 });
        const a = (i / 3) * Math.PI * 2;
        claw.position.set(Math.cos(a) * 0.07, 0.8, Math.sin(a) * 0.07);
        claw.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(claw);
      }
      break;
    }
    case "sword":
    default: {
      // Montante (dano alto) ou espada curta; a lâmina é larga e plana, de frente para a câmera.
      const long = dmg >= 12;
      const len = long ? 1.15 : 0.62;
      g.add(at(part(capsule(0.028, long ? 0.2 : 0.12, 8), grip, { ink: 0.01 }), 0, long ? 0.14 : 0.1, 0));
      g.add(at(part(ball(0.04, 8, 6), gold, { ink: 0.01 }), 0, long ? 0.16 : 0.12, 0));
      const guard = part(roundedBox(long ? 0.3 : 0.22, 0.045, 0.06, 0.02), gold, { ink: 0.012 });
      g.add(at(guard, 0, -0.08, 0));
      // Lâmina de frente para a câmera de cima (a face larga aparece, como na arte de referência).
      const blade = part(bladeGeometry(len, long ? 0.17 : 0.09, 0.02), steel, { ink: 0.012 });
      g.add(at(blade, 0, -0.1, 0));
      // Canal central brilhante (o neon corre pela lâmina).
      const fuller = part(roundedBox(long ? 0.05 : 0.03, len * 0.7, 0.032, 0.012), edge, { ink: 0 });
      g.add(at(fuller, 0, -0.1 - len * 0.38, 0));
      break;
    }
  }
  return g;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
