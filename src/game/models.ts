import * as THREE from "three";

/** Um modelo visual com ganchos de animação simples. */
export interface CharacterModel {
  root: THREE.Group;
  /** Ponto do pivô do braço que balança no ataque. */
  weaponArm?: THREE.Object3D;
  /** Altura aproximada, para posicionar a barra de vida. */
  height: number;
}

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });

function shadowed<T extends THREE.Object3D>(obj: T): T {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return obj;
}

export function createHero(): CharacterModel {
  const root = new THREE.Group();
  const skin = mat("#e8b893");
  const cloth = mat("#3b5aa6");
  const leather = mat("#6b4a2b");

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), cloth);
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
  head.position.y = 1.85;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#4a2e1a"));
  hair.position.y = 1.9;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10), leather);
  belt.position.y = 0.95;

  const legGeo = new THREE.CapsuleGeometry(0.14, 0.4, 3, 6);
  const legL = new THREE.Mesh(legGeo, leather);
  legL.position.set(-0.18, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 3, 6), skin);
  armL.position.set(-0.56, 1.1, 0);

  // Braço direito com espada: pivô no ombro para a animação de golpe.
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.56, 1.4, 0);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 3, 6), skin);
  armR.position.y = -0.3;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.22), mat("#d8dde6"));
  blade.position.set(0, -0.2, 0.75);
  blade.rotation.x = Math.PI / 2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), mat("#c9a227"));
  guard.position.set(0, -0.55, 0.15);
  weaponArm.add(armR, blade, guard);

  root.add(body, head, hair, belt, legL, legR, armL, weaponArm);
  return { root: shadowed(root), weaponArm, height: 2.2 };
}

export function createSlime(): CharacterModel {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mat("#5fd36b"));
  body.scale.set(1, 0.75, 1);
  body.position.y = 0.55;
  const eyeMat = mat("#1b1b1b");
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
    eye.position.set(sx * 0.25, 0.72, -0.55);
    root.add(eye);
  }
  root.add(body);
  return { root: shadowed(root), height: 1.1 };
}

export function createGoblin(): CharacterModel {
  const root = new THREE.Group();
  const skin = mat("#7bb04a");
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.5, 4, 8), mat("#5a3d2b"));
  body.position.y = 0.8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.5;
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), skin);
    ear.position.set(sx * 0.4, 1.6, 0);
    ear.rotation.z = sx * -Math.PI / 2.4;
    root.add(ear);
  }
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.45, 1.1, 0);
  const club = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.0, 6), mat("#8a5a2b"));
  club.position.set(0, -0.1, 0.5);
  club.rotation.x = Math.PI / 2;
  weaponArm.add(club);
  root.add(body, head, weaponArm);
  return { root: shadowed(root), weaponArm, height: 1.9 };
}

export function createOrc(): CharacterModel {
  const root = new THREE.Group();
  const skin = mat("#4f7a3a");
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 4, 8), mat("#3c3c45"));
  body.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skin);
  head.position.y = 2.35;
  for (const sx of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 5), mat("#f1ead6"));
    tusk.position.set(sx * 0.18, 2.1, -0.36);
    root.add(tusk);
  }
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.8, 1.8, 0);
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), mat("#5a3d2b"));
  axeHandle.position.set(0, -0.2, 0.7);
  axeHandle.rotation.x = Math.PI / 2;
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), mat("#aab0b8"));
  axeHead.position.set(0, -0.2, 1.4);
  weaponArm.add(axeHandle, axeHead);
  root.add(body, head, weaponArm);
  return { root: shadowed(root), weaponArm, height: 2.9 };
}

export function createModel(archetype: string): CharacterModel {
  switch (archetype) {
    case "hero": return createHero();
    case "slime": return createSlime();
    case "goblin": return createGoblin();
    case "orc": return createOrc();
    default: return createSlime();
  }
}
