import * as THREE from "three";

interface FloatingText {
  sprite: THREE.Sprite;
  age: number;
  velocityY: number;
}

/** Números de dano e textos flutuantes no mundo 3D. */
export class FloatingTexts {
  private items: FloatingText[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  spawn(position: { x: number; y: number; z: number }, text: string, color: string, scale = 1): void {
    const canvas = document.createElement("canvas");
    const font = "bold 56px system-ui, sans-serif";
    const measure = canvas.getContext("2d")!;
    measure.font = font;
    const width = Math.max(96, Math.ceil(measure.measureText(text).width) + 24);
    canvas.width = width;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(text, width / 2, 48);
    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set((width / 96) * 0.82 * scale, 0.82 * scale, 1);
    sprite.position.set(position.x + (Math.random() - 0.5) * 0.6, position.y + 1.8, position.z);
    sprite.renderOrder = 20;
    this.scene.add(sprite);
    this.items.push({ sprite, age: 0, velocityY: 2.2 });
  }

  update(dt: number): void {
    const LIFE = 1.1;
    this.items = this.items.filter((item) => {
      item.age += dt;
      item.sprite.position.y += item.velocityY * dt;
      item.velocityY -= 2.5 * dt;
      (item.sprite.material as THREE.SpriteMaterial).opacity = 1 - item.age / LIFE;
      if (item.age >= LIFE) {
        this.scene.remove(item.sprite);
        (item.sprite.material as THREE.SpriteMaterial).map?.dispose();
        item.sprite.material.dispose();
        return false;
      }
      return true;
    });
  }
}
