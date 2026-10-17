import type { Vector2 } from "../geometry";
import { distance } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";

/** Tunable: how far a wanderer can "see" food to steer toward it. Not revisited during the 027 balance pass — still a rough guess, revisit if real playtesting suggests otherwise. */
export const WANDERER_FOOD_DETECTION_RADIUS = 150;

/**
 * Passive movement: steers toward the nearest food within detection range, otherwise
 * ambles in a pseudo-random direction so it never sits frozen. Never looks at the player
 * or other bots at all — that omission (not a filter) is what makes a wanderer a wanderer;
 * hunter/fleer reuse this function for their own idle fallback, which is fine since the
 * "ignores player/bots" guarantee only applies when this is actually called as a wanderer.
 */
export function wandererMove(
  bot: Bot,
  nearbyFood: PositionedMass[],
  _deltaTime: number,
  _arenaRadius: number,
  rng: () => number = Math.random,
): Vector2 {
  const target = findNearestWithinRadius(
    bot.position,
    nearbyFood,
    WANDERER_FOOD_DETECTION_RADIUS,
  );
  if (target) return directionTo(bot.position, target.position);
  return randomDirection(rng);
}

/** Shared by hunter/fleer too — keeps "find closest qualifying candidate" in one place. */
export function findNearestWithinRadius<T extends { position: Vector2 }>(
  from: Vector2,
  candidates: T[],
  radius: number,
): T | null {
  let nearest: T | null = null;
  let nearestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(from, candidate.position);
    if (d <= radius && d < nearestDistance) {
      nearest = candidate;
      nearestDistance = d;
    }
  }
  return nearest;
}

/** Shared by hunter/fleer too — a plain (non-normalized) vector pointing from `from` to `to`. */
export function directionTo(from: Vector2, to: Vector2): Vector2 {
  return { x: to.x - from.x, z: to.z - from.z };
}

function randomDirection(rng: () => number): Vector2 {
  const angle = rng() * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}
