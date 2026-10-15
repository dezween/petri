import type { Vector2 } from "../geometry";
import type { Bot } from "../bot.entity";
import type { PositionedMass } from "./types";
import { directionTo, findNearestWithinRadius, wandererMove } from "./wanderer";

/** Tunable: how far a fleer can "see" a threat. Tuned for real in 027. */
export const FLEER_DETECTION_RADIUS = 180;

/**
 * How strongly the flee vector gets biased toward the nearest arena edge vs. a pure
 * straight-line retreat (per SPEC.md: "tends toward arena edges", so it reads as a
 * distinct silhouette on screen, not just "hunter in reverse"). Kept below 0.5 so the
 * away-from-threat component always dominates the blend — see the test asserting a
 * fleer never moves toward its threat, which this bound is what makes provably true
 * regardless of where the nearest edge happens to be.
 */
const EDGE_BIAS = 0.35;

/**
 * Skittish movement: flees the nearest bigger entity within range, biased toward the
 * nearest arena edge. Falls back to wanderer-style ambling (reusing `wandererMove`) when
 * nothing threatening is in range, so a fleer with no threat nearby is never frozen.
 *
 * No arena-size parameter needed: the arena is a circle centered at the origin (see
 * `world.service.ts`'s radial clamp and `render/adapter/three/scene.ts`'s floor/rim), so
 * "nearest edge" is just the radially-outward direction from (0, 0) — independent of the
 * arena's actual radius.
 */
export function fleerMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  deltaTime: number,
): Vector2 {
  const threats = nearbyEntities.filter(
    (entity) => entity.id !== bot.id && entity.mass > bot.mass,
  );
  const threat = findNearestWithinRadius(bot.position, threats, FLEER_DETECTION_RADIUS);
  if (!threat) return wandererMove(bot, nearbyEntities, deltaTime);

  const away = normalize(directionTo(threat.position, bot.position));
  const towardEdge = directionToNearestEdge(bot.position);
  return blend(away, towardEdge, EDGE_BIAS);
}

/** Radially outward from the arena center. Returns the zero vector at the exact center, where no edge is nearer than any other — `blend` handles that gracefully since it just scales `away`'s contribution down, not to zero. */
function directionToNearestEdge(position: Vector2): Vector2 {
  return normalize(position);
}

function normalize(v: Vector2): Vector2 {
  const length = Math.hypot(v.x, v.z);
  if (length === 0) return { x: 0, z: 0 };
  return { x: v.x / length, z: v.z / length };
}

function blend(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t };
}
