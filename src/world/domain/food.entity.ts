import type { Vector2 } from "./geometry";
import { massToRadius } from "./cell.entity";

/** Fixed mass value for every food particle — the steady, ambient mass source. */
export const FOOD_MASS = 1;

export interface Food {
  id: string;
  position: Vector2;
  mass: number;
  radius: number;
}

export function createFood(id: string, position: Vector2): Food {
  return { id, position, mass: FOOD_MASS, radius: massToRadius(FOOD_MASS) };
}
