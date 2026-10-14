import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createPlayer } from "../domain/factories";
import { World } from "../domain/world";
import { EntityViews } from "./entityViews";

describe("EntityViews: Golpe Giratório", () => {
  it("os dois braços abrem durante o giro e voltam ao lado do corpo depois", () => {
    const world = new World();
    const player = world.spawn((id) => createPlayer(id, { x: 0, y: 0, z: 0 }, "warrior"));
    const views = new EntityViews(new THREE.Scene());
    views.sync(world);
    const view = views.get(player.id)!;
    const camera = new THREE.PerspectiveCamera();

    view.triggerSpin();
    views.update(0.1, camera, undefined, 0, player);
    expect(view.model.weaponArm!.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(view.model.offArm!.rotation.z).toBeCloseTo(-Math.PI / 2);

    for (let i = 0; i < 10; i++) views.update(0.1, camera, undefined, 0.1 * i, player);
    expect(view.model.weaponArm!.rotation.z).toBe(0);
    expect(view.model.offArm!.rotation.z).toBe(0);
  });
});
