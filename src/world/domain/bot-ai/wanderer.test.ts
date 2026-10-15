import { describe, expect, it } from "vitest";
import { wandererMove } from "./wanderer";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "w1",
    position: { x: 0, z: 0 },
    mass: 5,
    radius: massToRadius(5),
    behavior: "wanderer",
    ...overrides,
  };
}

describe("wandererMove", () => {
  it("still returns a nonzero direction with no food nearby (never freezes)", () => {
    const direction = wandererMove(makeBot(), [], 1 / 60);
    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("steers toward the nearest food within detection radius", () => {
    const bot = makeBot({ position: { x: 0, z: 0 } });
    const food = [{ id: "f1", position: { x: 50, z: 0 }, mass: 1 }];

    const direction = wandererMove(bot, food, 1 / 60);

    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it("picks the nearer of two food candidates within range", () => {
    const bot = makeBot({ position: { x: 0, z: 0 } });
    const food = [
      { id: "far", position: { x: 100, z: 0 }, mass: 1 },
      { id: "near", position: { x: 20, z: 0 }, mass: 1 },
    ];

    const direction = wandererMove(bot, food, 1 / 60);

    expect(direction.x).toBeCloseTo(20, 5);
  });

  it("falls back to movement (not a frozen zero vector) when food is out of range", () => {
    const bot = makeBot({ position: { x: 0, z: 0 } });
    const farFood = [{ id: "f1", position: { x: 10_000, z: 0 }, mass: 1 }];

    const direction = wandererMove(bot, farFood, 1 / 60);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });
});
