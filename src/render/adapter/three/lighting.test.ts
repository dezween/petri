import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addLighting, configureShadowFrustum } from "./lighting";

describe("addLighting", () => {
  it("adds an ambient and a directional light to the scene", () => {
    const scene = new THREE.Scene();
    addLighting(scene, 1000);

    const ambientLights = scene.children.filter((c) => c instanceof THREE.AmbientLight);
    const directionalLights = scene.children.filter(
      (c) => c instanceof THREE.DirectionalLight,
    );

    expect(ambientLights).toHaveLength(1);
    expect(directionalLights).toHaveLength(1);
  });

  it("makes the directional light cast shadows with a frustum covering the given arena's depth range, and returns that light", () => {
    const scene = new THREE.Scene();
    const light = addLighting(scene, 2000);

    expect(scene.children).toContain(light);
    expect(light.castShadow).toBe(true);
    expect(light.shadow.mapSize.width).toBe(2048);
    expect(light.shadow.mapSize.height).toBe(2048);
    // Frustum width/height: must cover this arena's radius (1000) with margin.
    expect(light.shadow.camera.left).toBeLessThanOrEqual(-1000);
    expect(light.shadow.camera.right).toBeGreaterThanOrEqual(1000);
    expect(light.shadow.camera.top).toBeGreaterThanOrEqual(1000);
    expect(light.shadow.camera.bottom).toBeLessThanOrEqual(-1000);

    // Depth: per lighting.ts's derivation (verified against task 002's original by-hand
    // numbers), a 2000-wide arena's ground plane has real depth in [535, 1565] along this
    // light's view axis — near/far must cover that range (not just the Three.js defaults of
    // 0.5/500, which don't).
    expect(light.shadow.camera.near).toBeLessThanOrEqual(535);
    expect(light.shadow.camera.far).toBeGreaterThanOrEqual(1565);
  });
});

describe("configureShadowFrustum", () => {
  it("widens the frustum and depth range as arenaWidth grows, so the biggest of the 10 arena sizes isn't clipped by numbers tuned for a smaller one", () => {
    const light = new THREE.DirectionalLight();

    configureShadowFrustum(light, 1000);
    const smallRight = light.shadow.camera.right;
    const smallFar = light.shadow.camera.far;

    configureShadowFrustum(light, 3250); // the largest of the 10 arena sizes

    expect(light.shadow.camera.right).toBeGreaterThan(smallRight);
    expect(light.shadow.camera.right).toBeGreaterThanOrEqual(1625); // arena radius at 3250
    expect(light.shadow.camera.far).toBeGreaterThan(smallFar);

    light.shadow.camera.updateProjectionMatrix();
  });

  it("near never goes negative/zero even for a very large arena, which would produce a degenerate projection matrix", () => {
    const light = new THREE.DirectionalLight();

    configureShadowFrustum(light, 3250);

    expect(light.shadow.camera.near).toBeGreaterThan(0);
  });
});
