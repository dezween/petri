import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { WorldSnapshot } from "@/world/service/world.service";
import { ThreeRenderer } from "./three-renderer";

/**
 * `ThreeRenderer.init()` creates a real `THREE.WebGLRenderer`, which needs a canvas/GL
 * context this test environment (vitest's default "node" environment, no DOM/WebGL) doesn't
 * have — so the full init() -> render() -> dispose() lifecycle against a real canvas can
 * only be verified by hand in a browser (task 015's acceptance criteria describes exactly
 * that manual check). What IS testable here without a GL context: the scene/camera build in
 * the constructor doesn't throw, and render()/resize()/dispose() are safe no-ops before
 * init() has run (covers a caller accidentally calling these out of order).
 */
describe("ThreeRenderer", () => {
  const fakeSnapshot: WorldSnapshot = {
    player: { id: "p1", position: { x: 0, z: 0 }, radius: 10, mass: 25 },
    bots: [],
    food: [],
    arenaWidth: 1000,
  };

  it("constructs its scene/camera without needing a WebGL context", () => {
    expect(() => new ThreeRenderer()).not.toThrow();
  });

  it("render() before init() is a safe no-op", () => {
    const renderer = new ThreeRenderer();
    expect(() => renderer.render(fakeSnapshot)).not.toThrow();
  });

  it("resize() before init() is a safe no-op", () => {
    const renderer = new ThreeRenderer();
    expect(() => renderer.resize(800, 600)).not.toThrow();
  });

  it("dispose() before init() is a safe no-op", () => {
    const renderer = new ThreeRenderer();
    expect(() => renderer.dispose()).not.toThrow();
  });

  it("dispose() releases the static floor/rim geometry and materials, not just the renderer", () => {
    // The floor/rim are built in the constructor (createScene), independent of init(), so
    // this can be verified without a real WebGL context — only THREE.WebGLRenderer.dispose()
    // (called when `this.renderer` exists) needs one, and that's not under test here.
    const renderer = new ThreeRenderer();
    const scene = (renderer as unknown as { scene: THREE.Scene }).scene;
    const floor = scene.getObjectByName("arena-floor") as THREE.Mesh;
    const rim = scene.getObjectByName("arena-rim") as THREE.Mesh;
    const floorGeometryDispose = vi.spyOn(floor.geometry, "dispose");
    const floorMaterialDispose = vi.spyOn(floor.material as THREE.Material, "dispose");
    const rimGeometryDispose = vi.spyOn(rim.geometry, "dispose");
    const rimMaterialDispose = vi.spyOn(rim.material as THREE.Material, "dispose");

    renderer.dispose();

    expect(floorGeometryDispose).toHaveBeenCalledOnce();
    expect(floorMaterialDispose).toHaveBeenCalledOnce();
    expect(rimGeometryDispose).toHaveBeenCalledOnce();
    expect(rimMaterialDispose).toHaveBeenCalledOnce();
  });
});
