import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { directionTo, findNearestWithinRadius, wandererMove } from "./wanderer";

/** Tunable: how far a hunter can "see" prey. Tuned for real in 027. */
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
): Vector2 {
  const prey = nearbyEntities.filter(
    (entity) => entity.id !== bot.id && entity.mass < bot.mass,
  );
  const target = findNearestWithinRadius(bot.position, prey, HUNTER_DETECTION_RADIUS);
  if (target) return directionTo(bot.position, target.position);
  return wandererMove(bot, nearbyEntities, deltaTime);
}
