import type { Vector2 } from "../geometry";

/**
 * Anything with mass and a position on the arena plane. Player, Bot, and Food all satisfy
 * this structurally, so bot-AI steering logic can treat them interchangeably as potential
 * targets/threats without importing each concrete entity type.
 */
export interface PositionedMass {
  id: string;
  position: Vector2;
  mass: number;
  /** Epic 4, task 002: this entity's velocity as of the current tick, `{0,0}` for anything
   * stationary (food) or without a prior-tick position yet (freshly spawned). Optional so any
   * consumer written before this field existed degrades gracefully to current-position-only
   * steering. */
  velocity?: Vector2;
}
