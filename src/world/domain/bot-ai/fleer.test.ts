import { describe, expect, it } from "vitest";
import { fleerMove } from "./fleer";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";

function makeFleer(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "f1",
    position: { x: 0, z: 0 },
    mass: 5,
    radius: massToRadius(5),
    behavior: "fleer",
    ...overrides,
  };
}

describe("fleerMove", () => {
  it("moves away from a bigger entity in range along the threatened axis", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const threat = { id: "big", position: { x: 50, z: 0 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threat], 1 / 60, 500);

    expect(direction.x).toBeLessThan(0);
  });

  it("never moves toward an entity larger than itself, regardless of arena edge position", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const threat = { id: "big", position: { x: 0, z: 50 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threat], 1 / 60, 500);

    expect(direction.z).toBeLessThan(0);
  });

  it("ignores entities equal or smaller in mass as threats", () => {
    const fleer = makeFleer({ mass: 10, position: { x: 0, z: 0 } });
    const notAThreat = { id: "smaller", position: { x: 10, z: 0 }, mass: 5 };

    const { direction } = fleerMove(fleer, [notAThreat], 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing threatening is in range", () => {
    const fleer = makeFleer();

    const { direction, speedMultiplier } = fleerMove(fleer, [], 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
    expect(speedMultiplier).toBe(1);
  });

  it("biases the flee direction radially outward from the arena center (circular boundary), not toward a flat wall, when well inside the rim", () => {
    const fleer = makeFleer({ position: { x: 300, z: 300 } });
    const threat = { id: "big", position: { x: 350, z: 300 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threat], 1 / 60, 2000); // arenaRadius 2000 -> ratio ~0.21, well under the 0.7 fade start

    expect(direction.x).toBeLessThan(0);
    expect(direction.z).toBeGreaterThan(0);
  });

  // Epic 4 task 004: multi-threat weighting
  it("weighs multiple threats instead of reacting only to the nearest one", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    // Two threats both roughly "east" of the fleer but offset in z on opposite sides —
    // fleeing the nearest alone (threatA) would point almost purely -x; weighing both should
    // pull in a z component away from threatB too, off the pure-threatA axis.
    const threatA = { id: "a", position: { x: 100, z: 5 }, mass: 50 };
    const threatB = { id: "b", position: { x: 90, z: -80 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threatA, threatB], 1 / 60, 2000);
    const nearestOnly = fleerMove(fleer, [threatA], 1 / 60, 2000);

    // Weighing both threats must differ from reacting to threatA alone.
    expect(direction.z).not.toBeCloseTo(nearestOnly.direction.z, 2);
  });

  it("degrades to the single-nearest-threat direction when only one threat is present", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const threat = { id: "big", position: { x: 100, z: 0 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threat], 1 / 60, 2000);

    expect(direction.x).toBeLessThan(-0.9); // nearly pure -x, matching old nearest-only behavior
  });

  it("weighs a much closer threat far more strongly than an equally-sized farther one", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const closeThreat = { id: "close", position: { x: 10, z: 0 }, mass: 50 };
    const farThreat = { id: "far", position: { x: 0, z: 500 }, mass: 50 };

    const { direction } = fleerMove(fleer, [closeThreat, farThreat], 1 / 60, 2000);

    // The close threat (due +x) should dominate: result should still have a strongly
    // negative x component despite the far threat (due +z) being present.
    expect(direction.x).toBeLessThan(-0.8);
  });

  // Epic 4 task 005: edge/dead-end awareness
  it("keeps the full edge bias near the arena center", () => {
    const fleer = makeFleer({ position: { x: 10, z: 10 } }); // ratio tiny, well under 0.7
    const threat = { id: "big", position: { x: 60, z: 10 }, mass: 50 };

    const { direction } = fleerMove(fleer, [threat], 1 / 60, 2000);
    expect(direction.z).toBeGreaterThan(0); // outward-diagonal edge bias still present
  });

  it("produces a nonzero steering vector even when trapped near the rim with a threat between it and the center", () => {
    const arenaRadius = 1000;
    const fleer = makeFleer({ position: { x: 950, z: 0 } }); // ratio 0.95, near the rim
    const threat = { id: "big", position: { x: 900, z: 0 }, mass: 50 }; // between fleer and center

    const { direction } = fleerMove(fleer, [threat], 1 / 60, arenaRadius);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0.01);
  });

  // Epic 4 task 006: panic/urgency
  it("panics (speed multiplier > 1) when a threat is within the imminent-danger radius", () => {
    const arenaRadius = 2000;
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    // IMMINENT_DANGER_RADIUS_FRACTION = 0.4 * 0.3 = 0.12 -> imminent radius = 240 at arenaRadius 2000
    const closeThreat = { id: "close", position: { x: 50, z: 0 }, mass: 50 };

    const { speedMultiplier } = fleerMove(fleer, [closeThreat], 1 / 60, arenaRadius);

    expect(speedMultiplier).toBeGreaterThan(1);
  });

  it("does not panic when a threat is only in the wider (non-imminent) detection range", () => {
    const arenaRadius = 2000;
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const farThreat = { id: "far", position: { x: 500, z: 0 }, mass: 50 }; // within 0.3*2000=600 detection, outside 0.12*2000=240 imminent

    const { speedMultiplier } = fleerMove(fleer, [farThreat], 1 / 60, arenaRadius);

    expect(speedMultiplier).toBe(1);
  });
});
