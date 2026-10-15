import type { Vector2 } from "./geometry";

/**
 * Tunable: how quickly radius grows relative to mass. Larger = bigger cells for the same mass.
 * Balance pass (027): at the old value of 2, reaching the victory radius (37.5% of the
 * default 1000-wide arena = 375 units) required mass ≈ 35,156 — an empirical playtest
 * measured ~0.05 mass/sec of growth, i.e. ~195 hours to cap, unreachable in any session.
 *
 * This constant is extremely sensitive: every entity's *radius* — not just the player's —
 * scales with it, so it simultaneously lowers how much mass the cap requires (∝ 1/R²) AND
 * raises how much food/bot area a growing player sweeps up per tick (∝ R² × current mass,
 * since reach scales with radius and radius scales with mass too) — the two effects compound.
 * A first attempt at R=24 (12x) overshot drastically: a playtest reached full Victory in
 * 4.6 seconds (mass 26 -> 246) purely from how much ground a radius-122 player already covers
 * standing in a food-dense arena. R=4 (2x), retested with a corrected (non-circular, actually
 * ground-covering) playtest movement pattern, undershot the other way: ~0.067 mass/sec of pure
 * food grazing, which alone would take ~36 hours to reach the then cap of 8,789 — still far too
 * grindy. R=8 (4x, cap ≈ 2,197) is the settled middle value. Pure passive food-grazing alone is
 * still deliberately slow at this value — see bot-population.service.ts's config comment for
 * why eating other (especially grown) bots, not ambient pellets, is meant to be the dominant
 * route to the cap, matching classic agar.io's design and this codebase's existing snowball
 * mechanic (bots graze food and grow too, so a bot that's been alive a while is worth eating).
 * camera.ts's view-frustum constants scale with this value (factor = R/2) so on-screen framing
 * stays consistent at whatever this is set to.
 */
const RADIUS_PER_MASS_SQRT = 8;

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

/**
 * Starting mass for a freshly created player. Balance pass (027): bumped from 10 — a
 * Playwright playtest showed a fresh bot reaching the arena's dense food scatter and eating
 * just 1-2 food within the first few seconds was enough to overtake a mass-10 player, killing
 * it before any reaction was possible (an "instant off-screen snipe," exactly what this
 * task's acceptance criteria rules out). At 25, a bot needs real time grazing (≈15+ food,
 * each a real encounter, not simultaneous) before it can threaten the player at all, while
 * still leaving a long runway to the ≈244 victory-cap mass so growth still matters.
 */
export const INITIAL_PLAYER_MASS = 25;

/** Builds a fresh player at session start or Restart — the only place a Player should be constructed. */
export function createPlayer(id: string, position: Vector2): Player {
  return { id, position, mass: INITIAL_PLAYER_MASS, radius: massToRadius(INITIAL_PLAYER_MASS) };
}
