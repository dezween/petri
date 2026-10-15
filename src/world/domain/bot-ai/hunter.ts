import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { directionTo, findNearestWithinRadius, wandererMove } from "./wanderer";

/** Tunable: how far a hunter can "see" prey. Not revisited during the 027 balance pass — still a rough guess, revisit if real playtesting suggests otherwise. */
export const HUNTER_DETECTION_RADIUS = 200;

/**
 * Aggressive movement: chases the nearest entity (player, bot, or food) smaller than
 * itself within detection range. Falls back to wanderer-style ambling — reusing
 * `wandererMove` rather than duplicating the random-walk logic — when nothing qualifies,
 * so a hunter with no prey in range is never frozen either.
 */
export function hunterMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  deltaTime: number,
  rng: () => number = Math.random,
): Vector2 {
  const prey = nearbyEntities.filter(
    (entity) => entity.id !== bot.id && entity.mass < bot.mass,
  );
  const target = findNearestWithinRadius(bot.position, prey, HUNTER_DETECTION_RADIUS);
  if (target) return directionTo(bot.position, target.position);

  // Fallback wander: must not hand the *unfiltered* entity list to wandererMove, since
  // WANDERER_FOOD_DETECTION_RADIUS (150) is smaller than HUNTER_DETECTION_RADIUS (200) —
  // an entity too big to be valid prey (just excluded above) could still be the nearest
  // "food" candidate within wander range, sending the hunter straight at the thing its own
  // filter said to avoid. Re-apply the same mass filter (entities no bigger than the hunter)
  // to the wander fallback's candidate list.
  const safeToApproach = nearbyEntities.filter(
    (entity) => entity.id !== bot.id && entity.mass <= bot.mass,
  );
  return wandererMove(bot, safeToApproach, deltaTime, rng);
}
