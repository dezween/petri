import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { wandererMove } from "./wanderer";
import { evaluateSteering, normalize } from "./evaluate";

/** Arena-relative (Epic 4, task 001 — was a fixed 180 through Epic 1/2/3). */
export const FLEER_DETECTION_RADIUS_FRACTION = 0.3;

/** opportunityWeight = 0: a fleer never chases, so evaluateSteering only ever searches for
 * threats for it (see evaluate.ts's gating doc). */
const WEIGHTS = { threatWeight: 1.0, opportunityWeight: 0 };

/**
 * How strongly the flee vector gets biased toward the nearest arena edge vs. a pure
 * straight-line retreat (per SPEC.md: "tends toward arena edges", so it reads as a
 * distinct silhouette on screen, not just "hunter in reverse"). Kept below 0.5 so the
 * away-from-threat component always dominates the blend.
 */
const EDGE_BIAS = 0.35;

/**
 * Skittish movement: flees the nearest bigger entity within (arena-relative) detection
 * range, biased toward the nearest arena edge. Falls back to wanderer-style ambling when
 * nothing threatening is in range, so a fleer with no threat nearby is never frozen.
 *
 * No arena-size parameter needed for the edge direction itself: the arena is a circle
 * centered at the origin, so "nearest edge" is just the radially-outward direction from
 * (0, 0) — independent of the arena's actual radius. `arenaRadius` is only used for the
 * (now arena-relative) detection radius.
 */
export function fleerMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  deltaTime: number,
  arenaRadius: number,
  rng: () => number = Math.random,
): Vector2 {
  const detectionRadius = FLEER_DETECTION_RADIUS_FRACTION * arenaRadius;
  const away = evaluateSteering(bot, nearbyEntities, WEIGHTS, detectionRadius);
  if (!away) return wandererMove(bot, nearbyEntities, deltaTime, arenaRadius, rng);

  const towardEdge = directionToNearestEdge(bot.position);
  return blend(away, towardEdge, EDGE_BIAS);
}

/** Radially outward from the arena center. Returns the zero vector at the exact center, where no edge is nearer than any other — `blend` handles that gracefully since it just scales `away`'s contribution down, not to zero. */
function directionToNearestEdge(position: Vector2): Vector2 {
  return normalize(position);
}

function blend(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t };
}
