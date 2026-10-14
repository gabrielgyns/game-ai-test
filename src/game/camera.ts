import * as THREE from "three";
import { clamp } from "../domain/math";
import { terrainHeight } from "../domain/terrain";

/** Câmera orbital em terceira pessoa que segue o jogador. */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.35;
  distance = 9;
  private readonly smoothedTarget = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 400);
  }

  applyLook(dx: number, dy: number, zoom: number): void {
    this.yaw -= dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0028, -0.15, 1.2);
    this.distance = clamp(this.distance + zoom * 0.9, 3.5, 18);
  }

  update(target: THREE.Vector3, dt: number): void {
    if (!this.initialized) {
      this.smoothedTarget.copy(target);
      this.initialized = true;
    }
    this.smoothedTarget.lerp(target, clamp(dt * 10, 0, 1));
    const focus = this.smoothedTarget.clone().add(new THREE.Vector3(0, 1.6, 0));

    const cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosP,
    ).multiplyScalar(this.distance);

    const pos = focus.clone().add(offset);
    const floor = terrainHeight(pos.x, pos.z) + 0.6;
    if (pos.y < floor) pos.y = floor;

    this.camera.position.copy(pos);
    this.camera.lookAt(focus);
  }

  /** Converte eixos de input (relativos à tela) em direção no mundo, seguindo o yaw da câmera. */
  worldDirection(axes: { x: number; z: number }): { x: number; z: number } {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    return {
      x: forward.x * -axes.z + right.x * axes.x,
      z: forward.z * -axes.z + right.z * axes.x,
    };
  }
}
