import type { Vector2 } from "../geometry";
import { distance } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { directionTo, findNearestWithinRadius } from "./wanderer";

export interface SteeringWeights {
  threatWeight: number;
  opportunityWeight: number;
}

/** Epic 4, task 003: how far ahead (seconds) a target's velocity is extrapolated before
 * steering toward/away from it, so chasing/fleeing leads a moving target instead of chasing
 * its stale current position. Confirmed in task 011's balance pass: a real Playwright session
 * (large arena, 35s, player mass 25->55, zero console errors) showed hunters consistently
 * closing distance on the player rather than trailing a fixed offset behind, and a careless
 * dash into a corner on the small arena got the player caught and eaten within ~14s — both
 * consistent with 0.5s lead producing a believable, not-trivially-escapable chase. Left as-is. */
export const PREDICTION_LOOKAHEAD_SECONDS = 0.5;

/** Predicted position after `PREDICTION_LOOKAHEAD_SECONDS`, or the entity's current position
 * unchanged if it has no velocity data (degrades gracefully per task 003's acceptance
 * criteria — never throws, never produces NaN). */
export function predictedPosition(entity: PositionedMass): Vector2 {
  if (!entity.velocity) return entity.position;
  return {
    x: entity.position.x + entity.velocity.x * PREDICTION_LOOKAHEAD_SECONDS,
    z: entity.position.z + entity.velocity.z * PREDICTION_LOOKAHEAD_SECONDS,
  };
}

/**
 * Epic 4, task 004: inverse-square-distance-weighted sum of "away from each threat" vectors,
 * so a bot surrounded by multiple threats weighs all of them (closer ones dominating much more
 * strongly) instead of reacting only to the single nearest one. Degrades to the exact old
 * nearest-threat-only direction when `threats` has exactly one entry (the single normalized
 * away-vector, weighted and renormalized, points the same way regardless of the weight's
 * magnitude) — this is what task 004's "no regression for the single-threat case" acceptance
 * criterion relies on. Uses each threat's *predicted* position (task 003), not its current one,
 * so prediction and multi-threat-awareness compose rather than conflict.
 */
export function weightedAwayFromThreats(bot: Bot, threats: PositionedMass[]): Vector2 {
  let sx = 0;
  let sz = 0;
  for (const threat of threats) {
    const predicted = predictedPosition(threat);
    const away = directionTo(predicted, bot.position);
    const d = Math.max(Math.hypot(away.x, away.z), 1e-6);
    const weight = 1 / (d * d);
    sx += (away.x / d) * weight;
    sz += (away.z / d) * weight;
  }
  return normalize({ x: sx, z: sz });
}

/**
 * Shared per-tick core (Epic 4, task 001): finds threats (mass > bot.mass) and the nearest
 * opportunity (mass < bot.mass) within `detectionRadius`, blends an away-from-threats vector
 * and a toward-opportunity vector by `weights`, and normalizes. `behavior` becomes a weight
 * preset over this one function instead of three disjoint implementations.
 *
 * `multiThreat` (task 004) opts into the inverse-square multi-threat weighting above instead
 * of nearest-threat-only — scoped per SPEC.md's Design Decision 3 to fleeing only; hunter's
 * threat-deflection term (threatWeight 0.6 in hunter.ts) deliberately keeps the simpler
 * nearest-threat-only behavior, since "which single nearby thing is big enough to make me
 * reconsider chasing" doesn't need the same multi-threat nuance fleeing-for-survival does.
 *
 * Gating is deliberately asymmetric, not "both terms empty -> null": a weight of 0 for a term
 * means that term is never searched for at all (not found-but-ignored), and the function only
 * returns a live vector when at least one *active* (nonzero-weight) term actually found a
 * candidate — a hunter (opportunityWeight > 0) with only a threat in range and no prey still
 * falls through to its idle fallback rather than fleeing with no chase to deflect; a fleer
 * (opportunityWeight = 0) reacts purely off the threat term, exactly as before this task.
 */
export function evaluateSteering(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  weights: SteeringWeights,
  detectionRadius: number,
  multiThreat = false,
): Vector2 | null {
  const threatCandidates =
    weights.threatWeight > 0
      ? nearbyEntities.filter(
          (e) => e.id !== bot.id && e.mass > bot.mass && distance(bot.position, e.position) <= detectionRadius,
        )
      : [];
  const nearestOpportunity =
    weights.opportunityWeight > 0
      ? findNearestWithinRadius(
          bot.position,
          nearbyEntities.filter((e) => e.id !== bot.id && e.mass < bot.mass),
          detectionRadius,
        )
      : null;

  if (weights.opportunityWeight > 0 && !nearestOpportunity) return null;
  if (weights.opportunityWeight === 0 && threatCandidates.length === 0) return null;

  const away =
    threatCandidates.length === 0
      ? { x: 0, z: 0 }
      : multiThreat
        ? weightedAwayFromThreats(bot, threatCandidates)
        : normalize(directionTo(predictedPosition(nearestClosest(bot, threatCandidates)), bot.position));
  const toward = nearestOpportunity
    ? normalize(directionTo(bot.position, predictedPosition(nearestOpportunity)))
    : { x: 0, z: 0 };

  const blended = {
    x: away.x * weights.threatWeight + toward.x * weights.opportunityWeight,
    z: away.z * weights.threatWeight + toward.z * weights.opportunityWeight,
  };
  return normalizeOrNull(blended);
}

function nearestClosest(bot: Bot, candidates: PositionedMass[]): PositionedMass {
  let best = candidates[0];
  let bestD = distance(bot.position, best.position);
  for (const c of candidates) {
    const d = distance(bot.position, c.position);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function normalize(v: Vector2): Vector2 {
  const length = Math.hypot(v.x, v.z);
  if (length === 0) return { x: 0, z: 0 };
  return { x: v.x / length, z: v.z / length };
}

function normalizeOrNull(v: Vector2): Vector2 | null {
  const length = Math.hypot(v.x, v.z);
  if (length === 0) return null;
  return { x: v.x / length, z: v.z / length };
}

export function randomDirection(rng: () => number): Vector2 {
  const angle = rng() * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

/**
 * Epic 4, task 010: utility score for a hunter choosing between a prey candidate and a food
 * candidate — mass discounted by distance, per SPEC.md's `UTILITY_DISTANCE_SCALE`. Shared
 * shape (`PositionedMass`) means the same formula applies to either without special-casing.
 */
export const UTILITY_DISTANCE_SCALE = 50;

export function utilityScore(bot: Bot, candidate: PositionedMass): number {
  const d = distance(bot.position, candidate.position);
  return candidate.mass / (1 + d / UTILITY_DISTANCE_SCALE);
}
