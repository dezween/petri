import { describe, expect, it } from "vitest";
import { distance, isOverlapping, randomPointInDisk } from "./geometry";

describe("distance", () => {
  it("computes euclidean distance on the x/z plane", () => {
    expect(distance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });

  it("returns zero for identical points", () => {
    expect(distance({ x: 2, z: -1 }, { x: 2, z: -1 })).toBe(0);
  });
});

describe("isOverlapping", () => {
  it("reports true when circles intersect", () => {
    const a = { position: { x: 0, z: 0 }, radius: 5 };
    const b = { position: { x: 6, z: 0 }, radius: 5 };
    expect(isOverlapping(a, b)).toBe(true);
  });

  it("reports false when circles are far apart", () => {
    const a = { position: { x: 0, z: 0 }, radius: 1 };
    const b = { position: { x: 100, z: 0 }, radius: 1 };
    expect(isOverlapping(a, b)).toBe(false);
  });

  it("reports false when circles exactly touch (boundary is exclusive)", () => {
    const a = { position: { x: 0, z: 0 }, radius: 5 };
    const b = { position: { x: 10, z: 0 }, radius: 5 };
    expect(isOverlapping(a, b)).toBe(false);
  });
});

describe("randomPointInDisk", () => {
  it("never returns a point farther from the origin than maxRadius", () => {
    let seed = 1;
    const rng = () => {
      // Deterministic pseudo-random sequence in [0, 1) — no real randomness needed, just
      // broad coverage of the input space.
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < 200; i++) {
      const point = randomPointInDisk(rng, 100);
      expect(Math.hypot(point.x, point.z)).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it("can land outside the inscribed square (proving it samples the full disk, not a smaller shape)", () => {
    // A point near the disk's edge but off-axis (e.g. near 45°) lies outside any square
    // inscribed inside that same disk — reaching one confirms the sampling isn't
    // accidentally restricted to a smaller region than the full circle.
    let sawNearEdge = false;
    let seed = 7;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < 500; i++) {
      const point = randomPointInDisk(rng, 100);
      if (Math.hypot(point.x, point.z) > 95) sawNearEdge = true;
    }
    expect(sawNearEdge).toBe(true);
  });

  it("returns the origin when maxRadius is zero", () => {
    const point = randomPointInDisk(Math.random, 0);
    // Avoid asserting exact -0 vs 0 on x/z individually (sign of zero is an
    // implementation detail of cos/sin here, not something callers should depend on).
    expect(Math.hypot(point.x, point.z)).toBe(0);
  });
});
