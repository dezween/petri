import type { Vector2 } from "./geometry";

/** Tunable: how quickly radius grows relative to mass. Larger = bigger cells for the same mass. */
const RADIUS_PER_MASS_SQRT = 2;

/** Radius is always derived from mass, never set independently. */
export function massToRadius(mass: number): number {
  return Math.sqrt(Math.max(mass, 0)) * RADIUS_PER_MASS_SQRT;
}

/** Inverse of massToRadius. */
export function radiusToMass(radius: number): number {
  const clamped = Math.max(radius, 0);
  return (clamped / RADIUS_PER_MASS_SQRT) ** 2;
}

/** Shared shape for anything that has mass and occupies space on the arena plane. */
export interface Cell {
  id: string;
  position: Vector2;
  radius: number;
  mass: number;
}

/** A player is structurally identical to a Cell — no behavior field, no skills. */
export type Player = Cell;

/** Starting mass for a freshly created player. Slightly above INITIAL_BOT_MASS so a new session doesn't start pre-eaten by a same-tick spawn. Tuned for real in task 027. */
export const INITIAL_PLAYER_MASS = 10;

/** Builds a fresh player at session start or Restart — the only place a Player should be constructed. */
export function createPlayer(id: string, position: Vector2): Player {
  return { id, position, mass: INITIAL_PLAYER_MASS, radius: massToRadius(INITIAL_PLAYER_MASS) };
}
