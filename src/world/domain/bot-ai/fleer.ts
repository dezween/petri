import type { Vector2 } from "../geometry";
import { distance } from "../geometry";
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
 * straight-line retreat, when away from the rim (per SPEC.md: "tends toward arena edges",
 * so it reads as a distinct silhouette, not just "hunter in reverse"). Epic 4 task 005 fades
 * this toward 0 near the rim instead of applying it unconditionally.
 */
const EDGE_BIAS = 0.35;

/** Task 005: `distanceFromCenterRatio` below which the full EDGE_BIAS still applies unfaded. */
const EDGE_FADE_START_RATIO = 0.7;
/** Task 005: `distanceFromCenterRatio` at/above which EDGE_BIAS has faded to 0 and only the
 * tangential (along-the-rim) component remains. */
const EDGE_FADE_END_RATIO = 1.0;

/** Epic 4, task 006: how much faster a fleer moves while a threat is inside
 * `IMMINENT_DANGER_RADIUS_FRACTION * arenaRadius`. */
export const PANIC_SPEED_MULTIPLIER = 1.5;
/** Derived from FLEER_DETECTION_RADIUS_FRACTION per SPEC.md Design Decision 4a — a threat
 * has to be meaningfully closer than the full detection range to count as "imminent". */
export const IMMINENT_DANGER_RADIUS_FRACTION = 0.4 * FLEER_DETECTION_RADIUS_FRACTION;

export interface FleerResult {
  direction: Vector2;
  speedMultiplier: number;
}

/**
 * Skittish movement: flees all threats within (arena-relative) detection range, weighted by
 * proximity (task 004), biased toward the nearest arena edge away from the rim, fading into a
 * tangential (along-the-rim) component near the boundary so a cornered bot runs along the wall
 * instead of stalling (task 005), and panics (task 006: faster, less edge-biased) when a
 * threat is imminent. Falls back to wanderer-style ambling when nothing threatening is in
 * range, so a fleer with no threat nearby is never frozen.
 */
export function fleerMove(
  bot: Bot,
  nearbyEntities: PositionedMass[],
  deltaTime: number,
  arenaRadius: number,
  rng: () => number = Math.random,
): FleerResult {
  const detectionRadius = FLEER_DETECTION_RADIUS_FRACTION * arenaRadius;
  const away = evaluateSteering(bot, nearbyEntities, WEIGHTS, detectionRadius, true);
  if (!away) {
    return { direction: wandererMove(bot, nearbyEntities, deltaTime, arenaRadius, rng), speedMultiplier: 1 };
  }

  const threats = nearbyEntities.filter(
    (e) => e.id !== bot.id && e.mass > bot.mass && distance(bot.position, e.position) <= detectionRadius,
  );
  const nearestThreatDistance = Math.min(...threats.map((t) => distance(bot.position, t.position)));
  const imminentRadius = IMMINENT_DANGER_RADIUS_FRACTION * arenaRadius;
  const isImminent = nearestThreatDistance <= imminentRadius;
  // 0 when the threat is right on top of the bot, 1 at the imminent-danger boundary — scales
  // down how much of the edge/tangential term survives the closer the threat gets, so raw
  // escape urgency fills in whatever weight it gives up (task 006).
  const imminentProximityFactor = isImminent ? nearestThreatDistance / imminentRadius : 1;

  const distanceFromCenterRatio = distance(bot.position, { x: 0, z: 0 }) / Math.max(arenaRadius, 1e-6);
  const edgeBias = fadeEdgeBias(distanceFromCenterRatio) * imminentProximityFactor;

  const edgeComponent = edgeComponentFor(bot.position, away, distanceFromCenterRatio);
  const direction = blend(away, edgeComponent, edgeBias);

  return { direction, speedMultiplier: isImminent ? PANIC_SPEED_MULTIPLIER : 1 };
}

/** Task 005: EDGE_BIAS unfaded below EDGE_FADE_START_RATIO, linearly faded to 0 by
 * EDGE_FADE_END_RATIO (at/past the rim). */
function fadeEdgeBias(distanceFromCenterRatio: number): number {
  if (distanceFromCenterRatio <= EDGE_FADE_START_RATIO) return EDGE_BIAS;
  if (distanceFromCenterRatio >= EDGE_FADE_END_RATIO) return 0;
  const fadeProgress =
    (distanceFromCenterRatio - EDGE_FADE_START_RATIO) / (EDGE_FADE_END_RATIO - EDGE_FADE_START_RATIO);
  return EDGE_BIAS * (1 - fadeProgress);
}

/**
 * Below EDGE_FADE_START_RATIO: pure radially-outward (toward the nearest edge), as before.
 * At/near the rim: blend in a tangential (perpendicular-to-radial) component, picking whichever
 * of the two perpendicular directions better aligns with `away` (the away-from-threat vector),
 * so a bot trapped near the wall runs *along* it toward safety instead of stalling with a
 * near-zero net vector once the radial term has faded out (task 005's actual guarantee).
 */
function edgeComponentFor(position: Vector2, away: Vector2, distanceFromCenterRatio: number): Vector2 {
  const radial = directionToNearestEdge(position);
  if (distanceFromCenterRatio < EDGE_FADE_START_RATIO) return radial;

  const tangentA = { x: -radial.z, z: radial.x };
  const tangentB = { x: radial.z, z: -radial.x };
  const dotA = tangentA.x * away.x + tangentA.z * away.z;
  const dotB = tangentB.x * away.x + tangentB.z * away.z;
  const tangent = dotA >= dotB ? tangentA : tangentB;

  const tangentWeight = Math.min(
    1,
    (distanceFromCenterRatio - EDGE_FADE_START_RATIO) / (EDGE_FADE_END_RATIO - EDGE_FADE_START_RATIO),
  );
  return blend(radial, tangent, tangentWeight);
}

/** Radially outward from the arena center. Returns the zero vector at the exact center, where no edge is nearer than any other — `blend` handles that gracefully since it just scales `away`'s contribution down, not to zero. */
function directionToNearestEdge(position: Vector2): Vector2 {
  return normalize(position);
}

function blend(a: Vector2, b: Vector2, t: number): Vector2 {
  const blended = { x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t };
  const length = Math.hypot(blended.x, blended.z);
  return length === 0 ? a : { x: blended.x / length, z: blended.z / length };
}
