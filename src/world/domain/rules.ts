export interface Massive {
  id: string;
  mass: number;
}

export interface EatResult<T extends Massive> {
  eater: T;
  eaten: T;
}

/**
 * Strictly larger mass wins. Equal mass is a tie: no one eats (returns null) rather than
 * picking an arbitrary winner, since simultaneous-equal-mass overlap has no "correct" outcome.
 */
export function resolveEating<T extends Massive>(a: T, b: T): EatResult<T> | null {
  if (a.mass > b.mass) return { eater: a, eaten: b };
  if (b.mass > a.mass) return { eater: b, eaten: a };
  return null;
}

/** MVP mass transfer: direct 1:1 addition, no decay or efficiency loss. */
export function growMass(eaterMass: number, eatenMass: number): number {
  return eaterMass + eatenMass;
}

/** Radius is capped at this fraction of arena width (35-40% per SPEC.md; midpoint chosen). */
export const VICTORY_CAP_FRACTION = 0.375;

export function isAtVictoryCap(radius: number, arenaWidth: number): boolean {
  return radius >= arenaWidth * VICTORY_CAP_FRACTION;
}

/** Caps radius at the victory threshold regardless of how far over it the input is. */
export function clampRadiusToCap(radius: number, arenaWidth: number): number {
  const cap = arenaWidth * VICTORY_CAP_FRACTION;
  return Math.min(radius, cap);
}
