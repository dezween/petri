import type { Vector2 } from "@/world/domain/geometry";

/**
 * The only input mechanic in this game: a normalized direction toward the cursor. No split,
 * no eject, no keyboard — confirmed out of scope per docs/SPEC.md.
 */
export interface IInputSource {
  /**
   * Normalized direction from the player's screen position toward the cursor.
   * Zero vector if the cursor hasn't moved yet (no undefined/NaN on the first frame).
   */
  getDirection(): Vector2;
}
