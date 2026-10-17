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

    const direction = hunterMove(hunter, [prey], 1 / 60, 500);

    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it("picks the nearer of two qualifying prey", () => {
    const hunter = makeHunter();
    const entities = [
      { id: "far", position: { x: 100, z: 0 }, mass: 5 },
      { id: "near", position: { x: 20, z: 0 }, mass: 5 },
    ];

    const direction = hunterMove(hunter, entities, 1 / 60, 500);

    // Epic 4, task 001: hunterMove's output is now a normalized blended vector (so it can be
    // combined with a threat-avoidance term), not the raw unnormalized directionTo of before —
    // the sign/direction is what matters, not an exact distance magnitude.
    expect(direction.x).toBeCloseTo(1, 5);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it("never steers toward an entity equal or larger in mass", () => {
    const hunter = makeHunter({ mass: 10 });
    // Both candidates are disqualified as prey (one bigger, one equal) — the hunter has
    // nothing to chase, so it must fall back to wander movement instead of targeting either.
    const entities = [
      { id: "big", position: { x: 1, z: 0 }, mass: 20 },
      { id: "equal", position: { x: 0, z: 1 }, mass: 10 },
    ];

    const direction = hunterMove(hunter, entities, 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
    // Regression guard: the bigger "big" entity was explicitly disqualified as prey —
    // the fallback must not re-target it just because it's the nearest thing within
    // wander range. Pointing at (1, 0) would mean exactly that bug.
    expect(direction).not.toEqual({ x: 1, z: 0 });
  });

  it("falls back to the center-biased patrol (not fleeing, not chasing) when only an unqualifying same-or-bigger entity is nearby", () => {
    // Epic 4, task 001 (SPEC.md 1b): a threat alone — with no prey to chase — no longer
    // triggers fleeing (that would make "hunter" meaningless) and no longer reuses the old
    // wander-toward-whatever's-safe fallback; it's a pure center-biased patrol. "equal" (mass
    // 10, same as the hunter) isn't a threat (needs mass > bot.mass) or an opportunity (needs
    // mass < bot.mass), so it's inert either way; "big" is a threat but there's no opportunity
    // present, so evaluateSteering's chase-primary gating (see evaluate.ts) returns null here.
    const hunter = makeHunter({ mass: 10, position: { x: 100, z: 0 } });
    const entities = [
      { id: "big", position: { x: 105, z: 0 }, mass: 20 },
      { id: "equal", position: { x: 100, z: 1 }, mass: 10 },
    ];
    const rng = () => 0.25; // deterministic random component of the patrol blend

    const direction = hunterMove(hunter, entities, 1 / 60, 500, rng);

    // CENTER_PATROL_BIAS pulls the result toward the origin — from (100, 0), "toward origin"
    // is (-1, 0), so the blended x must be negative (bias pulling away from the random-only
    // direction a pure wander with this rng would have produced, (0, 1)).
    expect(direction.x).toBeLessThan(0);
    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing is in range", () => {
    const hunter = makeHunter();

    const direction = hunterMove(hunter, [], 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("deflects away from a close threat instead of chasing straight at a farther prey (threat term is live, not weighted to zero)", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const farPrey = { id: "prey", position: { x: 100, z: 0 }, mass: 5 };
    const closeThreat = { id: "threat", position: { x: 0, z: 5 }, mass: 50 }; // off-axis from the prey so the blend isn't collinear-degenerate

    const pureChase = hunterMove(hunter, [farPrey], 1 / 60, 500);
    const deflected = hunterMove(hunter, [farPrey, closeThreat], 1 / 60, 500);

    // Pure chase points straight at the prey, (1, 0)-ish. With the threat also present and
    // threatWeight > 0, the result must differ from pure chase — proving the threat term
    // actually influences the output rather than being a dead weight multiplied by zero.
    expect(deflected).not.toEqual(pureChase);
  });

  it("detection radius scales with arenaRadius — same absolute prey distance is in range at a large arena, out of range at a small one", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const prey = { id: "prey", position: { x: 300, z: 0 }, mass: 5 };

    // HUNTER_DETECTION_RADIUS_FRACTION = 0.35 -> at arenaRadius 2000, range is 700 (in range);
    // at arenaRadius 500, range is 175 (out of range) -> falls back to patrol instead.
    const atLargeArena = hunterMove(hunter, [prey], 1 / 60, 2000);
    const atSmallArena = hunterMove(hunter, [prey], 1 / 60, 500);

    // In range: normalized direction straight toward prey, (1, 0).
    expect(atLargeArena.x).toBeCloseTo(1, 5);
    expect(atLargeArena.z).toBeCloseTo(0, 5);
    // Out of range: falls back to patrol, which is never a pure (1, 0) chase vector toward
    // a prey that's 300 units away in a 175-unit-range arena.
    expect(atSmallArena).not.toEqual(atLargeArena);
  });

  it("idle patrol fallback is biased toward the arena center, not pure random", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 200, z: 0 } });
    const rng = () => 0.25; // pure-random component alone would be (0, 1) (angle = PI/2)

    const direction = hunterMove(hunter, [], 1 / 60, 500, rng);

    // CENTER_PATROL_BIAS pulls toward the origin, i.e. toward -x from (200, 0) — a pure
    // random result at this rng would have x === 0 exactly; a nonzero negative x proves the
    // center bias is actually applied, not a dead parameter.
    expect(direction.x).toBeLessThan(0);
  });
});
