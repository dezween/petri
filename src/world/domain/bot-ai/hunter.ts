import type { Vector2 } from "../geometry";
import { distance } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { evaluateSteering, normalize, predictedPosition, randomDirection, utilityScore } from "./evaluate";
import { directionTo } from "./wanderer";

/** Arena-relative (Epic 4, task 001 — was a fixed 200 through Epic 1/2/3). */
export const HUNTER_DETECTION_RADIUS_FRACTION = 0.35;

/** How strongly a nearby threat deflects an active chase (see evaluate.ts's gating doc —
 * a threat alone, with no prey to chase, does not by itself trigger fleeing). */
const WEIGHTS = { threatWeight: 0.6, opportunityWeight: 1.0 };

/** Blend weight toward the arena center in the idle patrol fallback (Epic 4, task 001 /
 * SPEC.md Design Decision 1b) — a hunter with nothing to chase reads as patrolling, not just
 * ambling. */
const CENTER_PATROL_BIAS = 0.4;

/** Task 007: how long a freshly-acquired target lock resists being replaced by a merely
 * slightly-better candidate. */
export const TARGET_COMMITMENT_SECONDS = 1.5;
/** Task 007: a candidate must beat the locked target's utility score by this factor to
 * override the commitment floor early. */
export const COMMITMENT_OVERRIDE_MARGIN = 1.3;
/** Task 008: how long a chase can go without meaningful progress before the hunter gives up. */
export const CHASE_GIVEUP_SECONDS = 4.0;
/** Task 008: fraction of the lock-start distance the chase must have closed by the give-up
 * deadline, or the lock clears early (bypassing the commitment floor above). */
export const CHASE_GIVEUP_MIN_PROGRESS = 0.2;
/** Task 009: how strongly this hunter's approach steers away from another hunter's approach
 * to the same target. */
export const PACK_ANGLE_BIAS_STRENGTH = 0.3;

export interface HunterResult {
  direction: Vector2;
  speedMultiplier: number;
}

/**
 * Aggressive movement: picks the best available opportunity (prey or food, by utility —
 * task 010) within (arena-relative) detection range, commits to it for a short window
 * (task 007) unless something meaningfully better appears or the chase stalls (task 008),
 * biases its approach away from another hunter converging on the same target (task 009), and
 * is deflected by any nearby bigger threat. Falls back to a center-biased patrol when there's
 * nothing to chase.
 */
export function hunterMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  _deltaTime: number,
  arenaRadius: number,
  rng: () => number = Math.random,
  currentTime = 0,
): HunterResult {
  const detectionRadius = HUNTER_DETECTION_RADIUS_FRACTION * arenaRadius;
  const candidates = nearbyEntities.filter(
    (e) => e.id !== bot.id && e.mass < bot.mass && distance(bot.position, e.position) <= detectionRadius,
  );
  const target = selectTarget(bot, candidates, currentTime);

  if (!target) {
    // Still let a nearby threat deflect even with nothing to chase, same gating as before this
    // task — evaluateSteering with opportunityWeight>0 and no opportunity just returns null,
    // so fall straight to patrol.
    return { direction: patrolFallback(bot, rng), speedMultiplier: 1 };
  }

  let direction = normalize(directionTo(bot.position, predictedPosition(target)));
  direction = applyThreatDeflection(bot, nearbyEntities, direction, detectionRadius);
  direction = applyPackBias(bot, nearbyEntities, target, direction, detectionRadius);

  return { direction, speedMultiplier: 1 };
}

/** Tasks 007/008/010: picks (and locks) the best-utility candidate, honoring an existing
 * lock's commitment floor and give-up deadline. Mutates `bot.targetLock` in place, consistent
 * with how the rest of this codebase mutates entity state (e.g. `bot.radius` in
 * `world.service.ts`) rather than threading immutable updates back up through a return value. */
function selectTarget(bot: Bot, candidates: PositionedMass[], currentTime: number): PositionedMass | null {
  if (candidates.length === 0) {
    bot.targetLock = undefined;
    return null;
  }

  let best = candidates[0];
  let bestScore = utilityScore(bot, best);
  for (const c of candidates) {
    const score = utilityScore(bot, c);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }

  const lock = bot.targetLock;
  if (lock) {
    const locked = candidates.find((c) => c.id === lock.targetId);
    if (!locked) {
      bot.targetLock = undefined; // target gone — clears immediately regardless of lockedUntil
    } else {
      const timedOut = currentTime - lock.acquiredAt >= CHASE_GIVEUP_SECONDS;
      const currentDistance = distance(bot.position, locked.position);
      const progress = (lock.distanceAtStart - currentDistance) / Math.max(lock.distanceAtStart, 1e-6);
      const givingUp = timedOut && progress < CHASE_GIVEUP_MIN_PROGRESS;

      if (givingUp) {
        bot.targetLock = undefined; // bypasses lockedUntil by design — see task 008
      } else {
        const stillCommitted = currentTime < lock.lockedUntil;
        const lockedScore = utilityScore(bot, locked);
        const beatenByMargin = bestScore > lockedScore * COMMITMENT_OVERRIDE_MARGIN;
        if (stillCommitted && !beatenByMargin) return locked;
      }
    }
  }

  bot.targetLock = {
    targetId: best.id,
    lockedUntil: currentTime + TARGET_COMMITMENT_SECONDS,
    acquiredAt: currentTime,
    distanceAtStart: distance(bot.position, best.position),
  };
  return best;
}

/** The pre-Epic-4-task-007 threat-deflection behavior, factored out unchanged: a threat alone
 * (opportunityWeight-gated) never triggers standalone fleeing for a hunter, it only nudges an
 * active chase. */
function applyThreatDeflection(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  chaseDirection: Vector2,
  detectionRadius: number,
): Vector2 {
  const deflected = evaluateSteering(bot, nearbyEntities, { threatWeight: WEIGHTS.threatWeight, opportunityWeight: 0 }, detectionRadius);
  if (!deflected) return chaseDirection;
  const blended = {
    x: chaseDirection.x * WEIGHTS.opportunityWeight + deflected.x * WEIGHTS.threatWeight,
    z: chaseDirection.z * WEIGHTS.opportunityWeight + deflected.z * WEIGHTS.threatWeight,
  };
  return normalize(blended);
}

/** Task 009: if another hunter within detection range is closer to this hunter's chosen
 * target than this hunter is, bias the approach toward whichever side increases separation
 * from that other hunter — an emergent flanking look with zero shared state beyond what every
 * bot already sees each tick. */
function applyPackBias(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  target: PositionedMass,
  direction: Vector2,
  detectionRadius: number,
): Vector2 {
  const myDistanceToTarget = distance(bot.position, target.position);
  const converging = nearbyEntities.find(
    (e) =>
      e.id !== bot.id &&
      e.botBehavior === "hunter" &&
      distance(bot.position, e.position) <= detectionRadius &&
      distance(e.position, target.position) < myDistanceToTarget,
  );
  if (!converging) return direction;

  const otherApproach = normalize(directionTo(converging.position, target.position));
  const perpA = { x: -otherApproach.z, z: otherApproach.x };
  const perpB = { x: otherApproach.z, z: -otherApproach.x };
  const awayFromOther = normalize(directionTo(converging.position, bot.position));
  const dotA = perpA.x * awayFromOther.x + perpA.z * awayFromOther.z;
  const dotB = perpB.x * awayFromOther.x + perpB.z * awayFromOther.z;
  const perp = dotA >= dotB ? perpA : perpB;

  const blended = {
    x: direction.x * (1 - PACK_ANGLE_BIAS_STRENGTH) + perp.x * PACK_ANGLE_BIAS_STRENGTH,
    z: direction.z * (1 - PACK_ANGLE_BIAS_STRENGTH) + perp.z * PACK_ANGLE_BIAS_STRENGTH,
  };
  return normalize(blended);
}

function patrolFallback(bot: Bot, rng: () => number): Vector2 {
  const toCenter = normalize({ x: -bot.position.x, z: -bot.position.z });
  const random = randomDirection(rng);
  const blended = {
    x: random.x * (1 - CENTER_PATROL_BIAS) + toCenter.x * CENTER_PATROL_BIAS,
    z: random.z * (1 - CENTER_PATROL_BIAS) + toCenter.z * CENTER_PATROL_BIAS,
  };
  const length = Math.hypot(blended.x, blended.z);
  return length === 0 ? random : { x: blended.x / length, z: blended.z / length };
}
