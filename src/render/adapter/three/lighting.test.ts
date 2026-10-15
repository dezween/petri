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
});
