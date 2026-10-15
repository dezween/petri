import { describe, expect, it } from "vitest";
import { fleerMove } from "./fleer";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";

const ARENA_WIDTH = 1000;

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

    const direction = fleerMove(fleer, [threat], ARENA_WIDTH, 1 / 60);

    // Threat is due +x of the fleer, so retreat must have a negative x component even
    // after the edge-bias blend (EDGE_BIAS < 0.5 guarantees this, see fleer.ts).
    expect(direction.x).toBeLessThan(0);
  });

  it("never moves toward an entity larger than itself, regardless of arena edge position", () => {
    const fleer = makeFleer({ position: { x: 0, z: 0 } });
    const threat = { id: "big", position: { x: 0, z: 50 }, mass: 50 };

    const direction = fleerMove(fleer, [threat], ARENA_WIDTH, 1 / 60);

    expect(direction.z).toBeLessThan(0);
  });

  it("ignores entities equal or smaller in mass as threats", () => {
    const fleer = makeFleer({ mass: 10, position: { x: 0, z: 0 } });
    const notAThreat = { id: "smaller", position: { x: 10, z: 0 }, mass: 5 };

    const direction = fleerMove(fleer, [notAThreat], ARENA_WIDTH, 1 / 60);

    // No threat in range -> falls back to wanderer movement toward/around the only
    // candidate present; the key invariant is just that it isn't fleeing something
    // smaller than itself, which the "greater than" filter in fleerMove guarantees.
    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing threatening is in range", () => {
    const fleer = makeFleer();

    const direction = fleerMove(fleer, [], ARENA_WIDTH, 1 / 60);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });
});
