import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { directionTo, findNearestWithinRadius } from "./wanderer";

export interface SteeringWeights {
  threatWeight: number;
  opportunityWeight: number;
}

/**
 * Shared per-tick core (Epic 4, task 001): finds the nearest threat (mass > bot.mass) and
 * nearest opportunity (mass < bot.mass) within `detectionRadius`, blends an away-from-threat
 * vector and a toward-opportunity vector by `weights`, and normalizes. `behavior` becomes a
 * weight preset over this one function instead of three disjoint implementations.
 *
 * Gating is deliberately asymmetric, not "both terms empty -> null": a weight of 0 for a term
 * means that term is never searched for at all (not found-but-ignored), and the function only
 * returns a live vector when at least one *active* (nonzero-weight) term actually found a
 * candidate — a hunter (opportunityWeight > 0) with only a threat in range and no prey still
 * falls through to its idle fallback rather than fleeing with no chase to deflect, since
 * fleeing-with-nothing-to-chase was never part of what "hunter" means; a fleer
 * (opportunityWeight = 0) reacts purely off the threat term, exactly as before this task.
 */
export function evaluateSteering(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  weights: SteeringWeights,
  detectionRadius: number,
): Vector2 | null {
  const nearestThreat =
    weights.threatWeight > 0
      ? findNearestWithinRadius(
          bot.position,
          nearbyEntities.filter((e) => e.id !== bot.id && e.mass > bot.mass),
          detectionRadius,
        )
      : null;
  const nearestOpportunity =
    weights.opportunityWeight > 0
      ? findNearestWithinRadius(
          bot.position,
          nearbyEntities.filter((e) => e.id !== bot.id && e.mass < bot.mass),
          detectionRadius,
        )
      : null;

  // The chase-primary case (opportunityWeight > 0): only react if there's something to chase
  // — a threat alone just deflects an active chase, it doesn't cause standalone fleeing.
  if (weights.opportunityWeight > 0 && !nearestOpportunity) return null;
  // The flee-primary case (opportunityWeight === 0, e.g. fleer): only react if there's a
  // threat, since that's the only term being searched for at all.
  if (weights.opportunityWeight === 0 && !nearestThreat) return null;

  const away = nearestThreat ? normalize(directionTo(nearestThreat.position, bot.position)) : { x: 0, z: 0 };
  const toward = nearestOpportunity
    ? normalize(directionTo(bot.position, nearestOpportunity.position))
    : { x: 0, z: 0 };

  const blended = {
    x: away.x * weights.threatWeight + toward.x * weights.opportunityWeight,
    z: away.z * weights.threatWeight + toward.z * weights.opportunityWeight,
  };
  return normalizeOrNull(blended);
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
