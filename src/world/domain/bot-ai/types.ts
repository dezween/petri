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
}
