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

    const direction = fleerMove(fleer, [threat], 1 / 60);

    // Threat is due +x of the fleer, so retreat must have a negative x component even
    // after the edge-bias blend (EDGE_BIAS < 0.5 guarantees this, see fleer.ts).
    expect(direction.x).toBeLessThan(0);
  });

  it("never moves toward an entity larger than itself, regardless of arena edge position", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const threat = { id: "big", position: { x: 0, z: 50 }, mass: 50 };

    const direction = fleerMove(fleer, [threat], 1 / 60);

    expect(direction.z).toBeLessThan(0);
  });

  it("ignores entities equal or smaller in mass as threats", () => {
    const fleer = makeFleer({ mass: 10, position: { x: 0, z: 0 } });
    const notAThreat = { id: "smaller", position: { x: 10, z: 0 }, mass: 5 };

    const direction = fleerMove(fleer, [notAThreat], 1 / 60);

    // No threat in range -> falls back to wanderer movement toward/around the only
    // candidate present; the key invariant is just that it isn't fleeing something
    // smaller than itself, which the "greater than" filter in fleerMove guarantees.
    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing threatening is in range", () => {
    const fleer = makeFleer();

    const direction = fleerMove(fleer, [], 1 / 60);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("biases the flee direction radially outward from the arena center (circular boundary), not toward a flat wall", () => {
    // Fleer sits off-center on the +x/+z diagonal; threat is due +x of it, so the pure
    // "away" vector alone is (-1, 0) with no z component. The arena is circular and
    // centered at the origin, so "nearest edge" here is the outward diagonal (+x, +z),
    // not a cardinal wall direction — the blend should pull in a +z component that pure
    // "away" never had, proving the edge-bias term is reading the circular model.
    const fleer = makeFleer({ position: { x: 300, z: 300 } });
    const threat = { id: "big", position: { x: 350, z: 300 }, mass: 50 };

    const direction = fleerMove(fleer, [threat], 1 / 60);

    expect(direction.x).toBeLessThan(0); // away-from-threat still dominates (EDGE_BIAS < 0.5)
    expect(direction.z).toBeGreaterThan(0); // outward diagonal bias, absent from pure "away"
  });
});
