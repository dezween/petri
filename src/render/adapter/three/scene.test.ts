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

  it("adds a lab-bench plane large enough to stay beneath the camera at the largest arena + max zoom-out", () => {
    const scene = createScene(2000);
    const bench = scene.getObjectByName("lab-bench") as THREE.Mesh;
    const geometry = bench.geometry as THREE.CircleGeometry;

    expect(bench).toBeInstanceOf(THREE.Mesh);
    expect(bench.rotation.x).toBeCloseTo(-Math.PI / 2);
    // Worst-case required coverage from world origin is ~4200 (see scene.ts's BENCH_RADIUS
    // comment for the derivation) — assert comfortable headroom above that, not an exact value,
    // so this doesn't become a brittle pin on the precise constant.
    expect(geometry.parameters.radius).toBeGreaterThan(4200);
  });

  it("sizes the lab-bench the same regardless of arena width, unlike the floor/rim", () => {
    const small = createScene(1000);
    const large = createScene(2000);
    const smallBench = (small.getObjectByName("lab-bench") as THREE.Mesh).geometry as THREE.CircleGeometry;
    const largeBench = (large.getObjectByName("lab-bench") as THREE.Mesh).geometry as THREE.CircleGeometry;

    expect(smallBench.parameters.radius).toBeCloseTo(largeBench.parameters.radius);
  });

  it("makes the floor, rim, and lab-bench all receive shadows (none of them cast)", () => {
    const scene = createScene(1000);
    const floor = scene.getObjectByName("arena-floor") as THREE.Mesh;
    const rim = scene.getObjectByName("arena-rim") as THREE.Mesh;
    const bench = scene.getObjectByName("lab-bench") as THREE.Mesh;

    expect(floor.receiveShadow).toBe(true);
    expect(rim.receiveShadow).toBe(true);
    expect(bench.receiveShadow).toBe(true);

    // Nothing in the scene shadows onto these from below (SPEC.md's Design Decision 2) — they
    // should stay receivers only.
    expect(floor.castShadow).toBe(false);
    expect(rim.castShadow).toBe(false);
    expect(bench.castShadow).toBe(false);
  });
});
