import { describe, expect, it } from "vitest";
import { ParticleSystem } from "./particles";

describe("ParticleSystem", () => {
  it("constructs without a WebGL context (Points/BufferGeometry/PointsMaterial need none)", () => {
    expect(() => new ParticleSystem()).not.toThrow();
  });

  it("burst() increases activeCount, update() past the lifetime brings it back to zero", () => {
    const system = new ParticleSystem();
    expect(system.activeCount).toBe(0);

    system.burst({ x: 0, z: 0 }, 0xff00ff);
    expect(system.activeCount).toBeGreaterThan(0);

    // Lifetime is well under a second; 2 seconds of 60fps-sized steps is more than enough for
    // every particle from this single burst to age out.
    for (let i = 0; i < 120; i++) system.update(1 / 60);
    expect(system.activeCount).toBe(0);
  });

  it("repeated bursts don't grow activeCount past the fixed capacity, even without draining", () => {
    const system = new ParticleSystem(32);

    for (let i = 0; i < 20; i++) system.burst({ x: 0, z: 0 }, 0x00ff00);

    expect(system.activeCount).toBeLessThanOrEqual(32);
  });

  it("many burst+update cycles return activeCount to baseline — no leaked particles over a long session", () => {
    const system = new ParticleSystem();

    for (let cycle = 0; cycle < 50; cycle++) {
      system.burst({ x: cycle, z: -cycle }, 0xffffff);
      for (let i = 0; i < 30; i++) system.update(1 / 60);
    }

    expect(system.activeCount).toBe(0);
  });

  it("update() is a safe no-op when nothing has ever burst", () => {
    const system = new ParticleSystem();
    expect(() => system.update(1 / 60)).not.toThrow();
    expect(system.activeCount).toBe(0);
  });

  it("dispose() doesn't throw", () => {
    const system = new ParticleSystem();
    system.burst({ x: 0, z: 0 }, 0xff0000);
    expect(() => system.dispose()).not.toThrow();
  });

  it("exposes a THREE.Points object with frustum culling disabled (positions move every frame)", () => {
    const system = new ParticleSystem();
    expect(system.points.frustumCulled).toBe(false);
  });
});
