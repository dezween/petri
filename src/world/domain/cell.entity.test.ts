import { describe, expect, it } from "vitest";
import { massToRadius, radiusToMass } from "./cell.entity";

describe("massToRadius / radiusToMass", () => {
  it("round-trips for a range of mass values", () => {
    for (const mass of [0, 1, 10, 100, 1000, 12345.678]) {
      const radius = massToRadius(mass);
      expect(radiusToMass(radius)).toBeCloseTo(mass, 5);
    }
  });

  it("is monotonically increasing with mass", () => {
    expect(massToRadius(10)).toBeGreaterThan(massToRadius(1));
    expect(massToRadius(1000)).toBeGreaterThan(massToRadius(10));
  });

  it("treats negative mass as zero rather than producing NaN", () => {
    expect(massToRadius(-5)).toBe(0);
  });
});
