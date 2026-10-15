import { describe, expect, it } from "vitest";
import { hunterMove } from "./hunter";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";

function makeHunter(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "h1",
    position: { x: 0, z: 0 },
    mass: 20,
    radius: massToRadius(20),
    behavior: "hunter",
    ...overrides,
  };
}

describe("hunterMove", () => {
  it("steers toward the nearest smaller entity in range, closing the distance", () => {
    const hunter = makeHunter();
    const prey = { id: "prey", position: { x: 30, z: 0 }, mass: 5 };

    const direction = hunterMove(hunter, [prey], 1 / 60);

    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it("picks the nearer of two qualifying prey", () => {
    const hunter = makeHunter();
    const entities = [
      { id: "far", position: { x: 100, z: 0 }, mass: 5 },
      { id: "near", position: { x: 20, z: 0 }, mass: 5 },
    ];

    const direction = hunterMove(hunter, entities, 1 / 60);

    expect(direction.x).toBeCloseTo(20, 5);
  });

  it("never steers toward an entity equal or larger in mass", () => {
    const hunter = makeHunter({ mass: 10 });
    // Both candidates are disqualified (one bigger, one equal) — the hunter has nothing
    // to chase, so it must fall back to wander movement instead of targeting either.
    const entities = [
      { id: "big", position: { x: 1, z: 0 }, mass: 20 },
      { id: "equal", position: { x: 0, z: 1 }, mass: 10 },
    ];

    const direction = hunterMove(hunter, entities, 1 / 60);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing is in range", () => {
    const hunter = makeHunter();

    const direction = hunterMove(hunter, [], 1 / 60);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });
});
