import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { evaluateSteering, normalize, randomDirection } from "./evaluate";

/** Arena-relative (Epic 4, task 001 — was a fixed 200 through Epic 1/2/3). */
export const HUNTER_DETECTION_RADIUS_FRACTION = 0.35;

/** How strongly a nearby threat deflects an active chase (see evaluate.ts's gating doc —
 * a threat alone, with no prey to chase, does not by itself trigger fleeing). */
const WEIGHTS = { threatWeight: 0.6, opportunityWeight: 1.0 };

/** Blend weight toward the arena center in the idle patrol fallback (Epic 4, task 001 /
 * SPEC.md Design Decision 1b) — replaces the old "wander toward whatever's safely nearby"
 * fallback, so a hunter with nothing to chase reads as patrolling, not just ambling. */
const CENTER_PATROL_BIAS = 0.4;

/**
 * Aggressive movement: chases the nearest smaller entity within (arena-relative) detection
 * range, deflected by any nearby bigger threat. Falls back to a center-biased patrol when
 * there's nothing to chase, so a hunter is never frozen and never reads as aimless.
 */
export function hunterMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  _deltaTime: number,
  arenaRadius: number,
  rng: () => number = Math.random,
): Vector2 {
  const detectionRadius = HUNTER_DETECTION_RADIUS_FRACTION * arenaRadius;
  const reactive = evaluateSteering(bot, nearbyEntities, WEIGHTS, detectionRadius);
  if (reactive) return reactive;
  return patrolFallback(bot, rng);
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
