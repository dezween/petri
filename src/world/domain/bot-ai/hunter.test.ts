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

    const { direction, speedMultiplier } = hunterMove(hunter, [prey], 1 / 60, 500);

    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeCloseTo(0, 5);
    expect(speedMultiplier).toBe(1);
  });

  it("picks the higher-utility of two qualifying prey (closer wins when mass is equal)", () => {
    const hunter = makeHunter();
    const entities = [
      { id: "far", position: { x: 100, z: 0 }, mass: 5 },
      { id: "near", position: { x: 20, z: 0 }, mass: 5 },
    ];

    const { direction } = hunterMove(hunter, entities, 1 / 60, 500);

    expect(direction.x).toBeCloseTo(1, 5);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it("never steers toward an entity equal or larger in mass", () => {
    const hunter = makeHunter({ mass: 10 });
    const entities = [
      { id: "big", position: { x: 1, z: 0 }, mass: 20 },
      { id: "equal", position: { x: 0, z: 1 }, mass: 10 },
    ];

    const { direction } = hunterMove(hunter, entities, 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
    expect(direction).not.toEqual({ x: 1, z: 0 });
  });

  it("falls back to the center-biased patrol (not fleeing, not chasing) when only an unqualifying same-or-bigger entity is nearby", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 100, z: 0 } });
    const entities = [
      { id: "big", position: { x: 105, z: 0 }, mass: 20 },
      { id: "equal", position: { x: 100, z: 1 }, mass: 10 },
    ];
    const rng = () => 0.25;

    const { direction } = hunterMove(hunter, entities, 1 / 60, 500, rng);

    expect(direction.x).toBeLessThan(0);
    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("behaves like a wanderer (keeps moving, never frozen) when nothing is in range", () => {
    const hunter = makeHunter();

    const { direction } = hunterMove(hunter, [], 1 / 60, 500);

    expect(Math.hypot(direction.x, direction.z)).toBeGreaterThan(0);
  });

  it("deflects away from a close threat instead of chasing straight at a farther prey (threat term is live, not weighted to zero)", () => {
    const farPrey = { id: "prey", position: { x: 100, z: 0 }, mass: 5 };
    const closeThreat = { id: "threat", position: { x: 0, z: 5 }, mass: 50 };

    const pureChase = hunterMove(makeHunter({ mass: 10 }), [farPrey], 1 / 60, 500);
    const deflected = hunterMove(makeHunter({ mass: 10 }), [farPrey, closeThreat], 1 / 60, 500);

    expect(deflected.direction).not.toEqual(pureChase.direction);
  });

  it("detection radius scales with arenaRadius — same absolute prey distance is in range at a large arena, out of range at a small one", () => {
    const prey = { id: "prey", position: { x: 300, z: 0 }, mass: 5 };

    const atLargeArena = hunterMove(makeHunter({ mass: 10 }), [prey], 1 / 60, 2000);
    const atSmallArena = hunterMove(makeHunter({ mass: 10 }), [prey], 1 / 60, 500);

    expect(atLargeArena.direction.x).toBeCloseTo(1, 5);
    expect(atLargeArena.direction.z).toBeCloseTo(0, 5);
    expect(atSmallArena.direction).not.toEqual(atLargeArena.direction);
  });

  it("idle patrol fallback is biased toward the arena center, not pure random", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 200, z: 0 } });
    const rng = () => 0.25;

    const { direction } = hunterMove(hunter, [], 1 / 60, 500, rng);

    expect(direction.x).toBeLessThan(0);
  });

  // Epic 4 task 007: target persistence
  it("keeps its locked target across ticks instead of flip-flopping between near-tied candidates", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const a = { id: "a", position: { x: 50, z: 0 }, mass: 5 };
    const b = { id: "b", position: { x: 0, z: 50 }, mass: 5 }; // near-tied with a (same distance/mass)

    hunterMove(hunter, [a, b], 1 / 60, 2000, Math.random, 0);
    const lockedId = hunter.targetLock?.targetId;
    expect(lockedId).toBeDefined();

    // Re-run several ticks shortly after — should keep the same lock, not re-roll between
    // the near-tied pair.
    for (let i = 0; i < 5; i++) {
      hunterMove(hunter, [a, b], 1 / 60, 2000, Math.random, 0.1 * i);
      expect(hunter.targetLock?.targetId).toBe(lockedId);
    }
  });

  it("switches targets immediately when a new candidate beats the locked one by the override margin", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const weak = { id: "weak", position: { x: 50, z: 0 }, mass: 2 };
    hunterMove(hunter, [weak], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("weak");

    // Much higher mass, closer -> utility score far exceeds 1.3x the locked target's score.
    const juicy = { id: "juicy", position: { x: 10, z: 0 }, mass: 9 };
    hunterMove(hunter, [weak, juicy], 1 / 60, 2000, Math.random, 0.1); // still well within the 1.5s commitment floor

    expect(hunter.targetLock?.targetId).toBe("juicy");
  });

  it("clears the lock immediately when the locked target disappears, even mid-commitment", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const prey = { id: "prey", position: { x: 50, z: 0 }, mass: 5 };
    hunterMove(hunter, [prey], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("prey");

    hunterMove(hunter, [], 1 / 60, 2000, Math.random, 0.1);
    expect(hunter.targetLock).toBeUndefined();
  });

  // Epic 4 task 008: give up on a bad chase
  it("gives up a chase that hasn't made 20% progress after the give-up deadline", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const elusive = { id: "elusive", position: { x: 100, z: 0 }, mass: 5 };
    hunterMove(hunter, [elusive], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("elusive");

    // Same distance (no progress) well past CHASE_GIVEUP_SECONDS (4.0), and well past the
    // 1.5s commitment floor too — this must clear via give-up logic. With only one candidate
    // in the scene it immediately re-acquires the same id, so the real assertion is that a
    // FRESH lock was acquired (acquiredAt reset to the new tick), not that the id changed.
    hunterMove(hunter, [elusive], 1 / 60, 2000, Math.random, 5.0);
    expect(hunter.targetLock?.acquiredAt).toBe(5.0);
  });

  it("keeps a chase that HAS closed distance by >=20%, even past the give-up deadline", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const catchable = { id: "catchable", position: { x: 100, z: 0 }, mass: 5 };
    hunterMove(hunter, [catchable], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("catchable");

    // Distance closed from 100 to 50 (> 20% progress), at t=5.0 (past give-up deadline).
    const stillCatchable = { id: "catchable", position: { x: 50, z: 0 }, mass: 5 };
    hunterMove(hunter, [stillCatchable], 1 / 60, 2000, Math.random, 5.0);
    expect(hunter.targetLock?.targetId).toBe("catchable");
  });

  // Epic 4 task 009: soft pack awareness
  it("biases its approach away from another hunter already closer to the same target", () => {
    const hunter = makeHunter({ id: "h1", mass: 10, position: { x: -100, z: 0 } });
    const prey = { id: "prey", position: { x: 0, z: 0 }, mass: 5 };
    const otherHunter = {
      id: "h2",
      position: { x: -20, z: 0 },
      mass: 10,
      botBehavior: "hunter" as const,
    };

    const alone = hunterMove(makeHunter({ id: "h1", mass: 10, position: { x: -100, z: 0 } }), [prey], 1 / 60, 2000);
    const withPack = hunterMove(hunter, [prey, otherHunter], 1 / 60, 2000);

    expect(withPack.direction).not.toEqual(alone.direction);
  });

  it("is unaffected by a lone hunter with no other hunter nearby", () => {
    const hunter = makeHunter({ id: "h1", mass: 10, position: { x: -100, z: 0 } });
    const prey = { id: "prey", position: { x: 0, z: 0 }, mass: 5 };

    const { direction } = hunterMove(hunter, [prey], 1 / 60, 2000);
    expect(direction.x).toBeGreaterThan(0);
  });

  it("pack bias changes only the approach vector, not which target gets picked", () => {
    const hunter = makeHunter({ id: "h1", mass: 10, position: { x: -100, z: 0 } });
    const prey = { id: "prey", position: { x: 0, z: 0 }, mass: 5 };
    const otherHunter = {
      id: "h2",
      position: { x: -20, z: 0 },
      mass: 10,
      botBehavior: "hunter" as const,
    };

    hunterMove(hunter, [prey, otherHunter], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("prey");
  });

  // Epic 4 task 010: food-vs-prey utility
  it("prefers a close, substantial food pellet over a far, barely-qualifying prey when utility favors food", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const closeFood = { id: "food", position: { x: 5, z: 0 }, mass: 8 }; // high mass, very close
    const farPrey = { id: "prey", position: { x: 400, z: 0 }, mass: 1 }; // low mass, far

    hunterMove(hunter, [closeFood, farPrey], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("food");
  });

  it("still prefers a close, substantial prey over far food when utility favors prey", () => {
    const hunter = makeHunter({ mass: 10, position: { x: 0, z: 0 } });
    const closePrey = { id: "prey", position: { x: 5, z: 0 }, mass: 8 };
    const farFood = { id: "food", position: { x: 400, z: 0 }, mass: 1 };

    hunterMove(hunter, [closePrey, farFood], 1 / 60, 2000, Math.random, 0);
    expect(hunter.targetLock?.targetId).toBe("prey");
  });
});
