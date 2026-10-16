import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addLighting } from "./lighting";

describe("addLighting", () => {
  it("adds an ambient and a directional light to the scene", () => {
    const scene = new THREE.Scene();
    addLighting(scene);

    const ambientLights = scene.children.filter((c) => c instanceof THREE.AmbientLight);
    const directionalLights = scene.children.filter(
      (c) => c instanceof THREE.DirectionalLight,
    );

    expect(ambientLights).toHaveLength(1);
    expect(directionalLights).toHaveLength(1);
  });

  it("makes the directional light cast shadows with a frustum covering the Large arena's depth range", () => {
    const scene = new THREE.Scene();
    addLighting(scene);

    const light = scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;

    expect(light.castShadow).toBe(true);
    expect(light.shadow.mapSize.width).toBe(2048);
    expect(light.shadow.mapSize.height).toBe(2048);
    // Frustum width/height: must cover the Large arena's radius (1000) with margin.
    expect(light.shadow.camera.left).toBeLessThanOrEqual(-1000);
    expect(light.shadow.camera.right).toBeGreaterThanOrEqual(1000);
    expect(light.shadow.camera.top).toBeGreaterThanOrEqual(1000);
    expect(light.shadow.camera.bottom).toBeLessThanOrEqual(-1000);

    // Depth: per docs/epic-3/tasks/002-shadow-mapping-setup.md's derivation, every point on the
    // Large arena's ground plane has real depth in [535, 1565] along this light's view axis —
    // near/far must cover that range (not just the Three.js defaults of 0.5/500, which don't).
    expect(light.shadow.camera.near).toBeLessThanOrEqual(535);
    expect(light.shadow.camera.far).toBeGreaterThanOrEqual(1565);
  });
});
