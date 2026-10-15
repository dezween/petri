import { describe, expect, it } from "vitest";
import { distance, isOverlapping } from "./geometry";

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
