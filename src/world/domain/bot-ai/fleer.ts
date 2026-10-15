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
 * Deviation from the task doc's literal 3-arg signature: arena bounds are required to
 * compute "nearest edge," so `arenaWidth` is threaded through as an extra parameter
 * rather than smuggled some other way.
 *
 * Skittish movement: flees the nearest bigger entity within range, biased toward the
 * nearest arena wall. Falls back to wanderer-style ambling (reusing `wandererMove`) when
 * nothing threatening is in range, so a fleer with no threat nearby is never frozen.
 */
export function fleerMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  arenaWidth: number,
  deltaTime: number,
): Vector2 {
  const threats = nearbyEntities.filter(
    (entity) => entity.id !== bot.id && entity.mass > bot.mass,
  );
  const threat = findNearestWithinRadius(bot.position, threats, FLEER_DETECTION_RADIUS);
  if (!threat) return wandererMove(bot, nearbyEntities, deltaTime);

  const away = normalize(directionTo(threat.position, bot.position));
  const towardEdge = directionToNearestEdge(bot.position, arenaWidth);
  return blend(away, towardEdge, EDGE_BIAS);
}

function directionToNearestEdge(position: Vector2, arenaWidth: number): Vector2 {
  const half = arenaWidth / 2;
  const edges: Array<[Vector2, number]> = [
    [{ x: 1, z: 0 }, half - position.x],
    [{ x: -1, z: 0 }, position.x + half],
    [{ x: 0, z: 1 }, half - position.z],
    [{ x: 0, z: -1 }, position.z + half],
  ];
  edges.sort((a, b) => a[1] - b[1]);
  return edges[0]![0];
}

function normalize(v: Vector2): Vector2 {
  const length = Math.hypot(v.x, v.z);
  if (length === 0) return { x: 0, z: 0 };
  return { x: v.x / length, z: v.z / length };
}

function blend(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t };
}
