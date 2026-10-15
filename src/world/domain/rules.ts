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

/**
 * MVP mass transfer: direct 1:1 addition, no decay or efficiency loss. Balance pass (027)
 * considered a flat multiplier here instead of retuning RADIUS_PER_MASS_SQRT (see
 * cell.entity.ts) — rejected: with starting masses of 5 (bot) / 10 (player) / 1 (food), any
 * multiplier large enough to make the victory cap reachable in a reasonable session (~35,156
 * mass at the default arena width and a flat 1:1 transfer — an empirical 40s playtest
 * measured ~0.05 mass/sec, i.e. ~195 hours to cap) also makes a single food pickup worth
 * several times someone's entire starting mass, producing exactly the "instant off-screen
 * snipe" deaths this task's acceptance criteria warns against (confirmed: at a 60x
 * multiplier, a bot that ate just one food jumped from mass 5 to 65 and one-shot the player
 * within 16 seconds). Retuning the mass-to-radius conversion instead keeps every entity's
 * mass proportional to the others exactly as before, so a bite's value relative to your
 * current size never changes — only how much total mass the victory radius requires does.
 */
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
