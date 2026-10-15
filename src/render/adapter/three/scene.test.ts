import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createScene } from "./scene";

describe("createScene", () => {
  it("adds a floor and a rim mesh, both lying flat on the XZ ground plane", () => {
    const scene = createScene(1000);

    const floor = scene.getObjectByName("arena-floor");
    const rim = scene.getObjectByName("arena-rim");

    expect(floor).toBeInstanceOf(THREE.Mesh);
    expect(rim).toBeInstanceOf(THREE.Mesh);
    // Rotated -90deg around X so the geometry (flat in XY by default) lies in XZ.
    expect(floor?.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(rim?.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it("sizes the floor to match the given arena width", () => {
    const scene = createScene(1000);
    const floor = scene.getObjectByName("arena-floor") as THREE.Mesh;
    const geometry = floor.geometry as THREE.CircleGeometry;

    expect(geometry.parameters.radius).toBeCloseTo(500);
  });
});
