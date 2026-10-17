import { describe, expect, it } from "vitest";
import { evaluateSteering } from "./evaluate";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "b1",
    position: { x: 0, z: 0 },
    mass: 10,
    radius: massToRadius(10),
    behavior: "hunter",
    ...overrides,
  };
}

describe("evaluateSteering", () => {
  it("returns null when opportunityWeight > 0 and nothing qualifies as an opportunity, even with a threat present", () => {
    const bot = makeBot();
    const threat = { id: "t", position: { x: 5, z: 0 }, mass: 50 };

    const result = evaluateSteering(bot, [threat], { threatWeight: 0.6, opportunityWeight: 1.0 }, 100);

    expect(result).toBeNull();
  });

  it("returns a pure normalized chase vector when only an opportunity is present", () => {
    const bot = makeBot();
    const prey = { id: "p", position: { x: 10, z: 0 }, mass: 2 };

    const result = evaluateSteering(bot, [prey], { threatWeight: 0.6, opportunityWeight: 1.0 }, 100);

    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(1, 5);
    expect(result!.z).toBeCloseTo(0, 5);
  });

  it("flee-primary weights (opportunityWeight = 0) react purely to a threat, ignoring any opportunity", () => {
    const bot = makeBot();
    const threat = { id: "t", position: { x: 0, z: -10 }, mass: 50 };
    const prey = { id: "p", position: { x: 10, z: 0 }, mass: 2 };

    const result = evaluateSteering(bot, [threat, prey], { threatWeight: 1.0, opportunityWeight: 0 }, 100);

    expect(result).not.toBeNull();
    // Away from (0, -10) is (0, 1) — straight up, not toward the prey at all.
    expect(result!.x).toBeCloseTo(0, 5);
    expect(result!.z).toBeCloseTo(1, 5);
  });

  it("flee-primary weights return null when no threat is in range, regardless of opportunities nearby", () => {
    const bot = makeBot();
    const prey = { id: "p", position: { x: 10, z: 0 }, mass: 2 };

    const result = evaluateSteering(bot, [prey], { threatWeight: 1.0, opportunityWeight: 0 }, 100);

    expect(result).toBeNull();
  });

  it("entities outside detectionRadius are ignored entirely", () => {
    const bot = makeBot();
    const farPrey = { id: "p", position: { x: 1000, z: 0 }, mass: 2 };

    const result = evaluateSteering(bot, [farPrey], { threatWeight: 0.6, opportunityWeight: 1.0 }, 50);

    expect(result).toBeNull();
  });
});
