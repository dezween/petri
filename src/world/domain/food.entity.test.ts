import { describe, expect, it } from "vitest";
import { createFood, FOOD_MASS } from "./food.entity";
import { massToRadius } from "./cell.entity";

describe("createFood", () => {
  it("creates a food particle with the fixed mass and its derived radius", () => {
    const food = createFood("food-1", { x: 10, z: -5 });
    expect(food).toEqual({
      id: "food-1",
      position: { x: 10, z: -5 },
      mass: FOOD_MASS,
      radius: massToRadius(FOOD_MASS),
    });
  });
});
