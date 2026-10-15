import { describe, expect, it } from "vitest";
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
});
