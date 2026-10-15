import { describe, expect, it } from "vitest";
import {
  clampRadiusToCap,
  growMass,
  isAtVictoryCap,
  resolveEating,
  VICTORY_CAP_FRACTION,
} from "./rules";

describe("resolveEating", () => {
  it("always picks the larger mass as the eater", () => {
    const a = { id: "a", mass: 10 };
    const b = { id: "b", mass: 20 };
    expect(resolveEating(a, b)).toEqual({ eater: b, eaten: a });
    expect(resolveEating(b, a)).toEqual({ eater: b, eaten: a });
  });

  it("returns null on equal mass (tie: no one eats)", () => {
    const a = { id: "a", mass: 15 };
    const b = { id: "b", mass: 15 };
    expect(resolveEating(a, b)).toBeNull();
  });
});

describe("growMass", () => {
  it("adds eaten mass directly onto the eater (1:1 for MVP)", () => {
    expect(growMass(10, 5)).toBe(15);
    expect(growMass(0, 1)).toBe(1);
  });
});

describe("isAtVictoryCap / clampRadiusToCap", () => {
  const arenaWidth = 1000;
  const cap = arenaWidth * VICTORY_CAP_FRACTION;

  it("is false below the cap and true at/above it", () => {
    expect(isAtVictoryCap(cap - 1, arenaWidth)).toBe(false);
    expect(isAtVictoryCap(cap, arenaWidth)).toBe(true);
    expect(isAtVictoryCap(cap + 50, arenaWidth)).toBe(true);
  });

  it("never clamps above the cap no matter how far over the input is", () => {
    expect(clampRadiusToCap(cap, arenaWidth)).toBe(cap);
    expect(clampRadiusToCap(cap + 1, arenaWidth)).toBe(cap);
    expect(clampRadiusToCap(cap * 100, arenaWidth)).toBe(cap);
  });

  it("passes values below the cap through unchanged", () => {
    expect(clampRadiusToCap(10, arenaWidth)).toBe(10);
  });
});
