import { describe, expect, it } from "vitest";
import { evaluateSteering } from "./evaluate";
import type { Bot } from "../bot.entity";
import { massToRadius } from "../cell.entity";
import type { Vector2 } from "../geometry";

/** Simulates `ticks` frames of a bot steering via `evaluateSteering` toward/away from a single
 * moving target, returning the final bot-to-target distance. `targetHasVelocity` controls
 * whether the AI can see the target's velocity (prediction) or not (pre-task-003 behavior) —
 * the target's actual simulated motion is identical either way, only what the steering function
 * is allowed to see differs, isolating the effect of prediction itself. */
function simulate(
  weights: { threatWeight: number; opportunityWeight: number },
  botStart: Vector2,
  botSpeed: number,
  targetStart: Vector2,
  targetVelocity: Vector2,
  ticks: number,
  dt: number,
  targetHasVelocity: boolean,
): number {
  let bot = { x: botStart.x, z: botStart.z };
  let target = { x: targetStart.x, z: targetStart.z };
  for (let i = 0; i < ticks; i++) {
    const entity = {
      id: "t",
      position: { x: target.x, z: target.z },
      mass: weights.opportunityWeight > 0 ? 2 : 50,
      velocity: targetHasVelocity ? targetVelocity : undefined,
    };
    const direction = evaluateSteering(makeBot({ position: bot }), [entity], weights, 1000);
    if (direction) {
      bot = { x: bot.x + direction.x * botSpeed * dt, z: bot.z + direction.z * botSpeed * dt };
    }
    target = { x: target.x + targetVelocity.x * dt, z: target.z + targetVelocity.z * dt };
  }
  return Math.hypot(bot.x - target.x, bot.z - target.z);
}

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

  describe("movement prediction (task 003)", () => {
    it("a hunter chasing prey moving in a straight line closes more distance with velocity-based prediction than without", () => {
      const weights = { threatWeight: 0, opportunityWeight: 1 };
      const withPrediction = simulate(weights, { x: 0, z: 0 }, 50, { x: 100, z: 0 }, { x: 0, z: 40 }, 20, 0.1, true);
      const withoutPrediction = simulate(weights, { x: 0, z: 0 }, 50, { x: 100, z: 0 }, { x: 0, z: 40 }, 20, 0.1, false);

      expect(withPrediction).toBeLessThan(withoutPrediction);
    });

    it("a fleer being approached by a threat moving in a straight line gains more separation with prediction than without", () => {
      // Off-axis approach (not a straight line through the bot's start position) — a purely
      // collinear head-on approach gives prediction nothing to improve on, since "away from
      // predicted position" and "away from current position" point the same direction when
      // threat, predicted threat, and bot are all on one line.
      const weights = { threatWeight: 1, opportunityWeight: 0 };
      const withPrediction = simulate(weights, { x: 0, z: 0 }, 50, { x: -100, z: 30 }, { x: 40, z: -10 }, 20, 0.1, true);
      const withoutPrediction = simulate(weights, { x: 0, z: 0 }, 50, { x: -100, z: 30 }, { x: 40, z: -10 }, 20, 0.1, false);

      expect(withPrediction).toBeGreaterThan(withoutPrediction);
    });

    it("a target with no velocity data degrades gracefully to current-position steering (no crash, unchanged result)", () => {
      const bot = makeBot();
      const prey = { id: "p", position: { x: 10, z: 0 }, mass: 2, velocity: undefined };

      const result = evaluateSteering(bot, [prey], { threatWeight: 0.6, opportunityWeight: 1.0 }, 100);

      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1, 5);
      expect(result!.z).toBeCloseTo(0, 5);
    });
  });
});
