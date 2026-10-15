import { describe, expect, it } from "vitest";
import { getModelUrl, type ModelName } from "./model-loader";

const ALL_MODEL_NAMES: ModelName[] = [
  "player_cell",
  "bot_wanderer",
  "bot_hunter",
  "bot_fleer",
  "food",
];

describe("getModelUrl", () => {
  it("resolves every model name to a URL ending in its expected .glb filename", () => {
    for (const name of ALL_MODEL_NAMES) {
      const url = getModelUrl(name);
      expect(url.href.endsWith(`${name}.glb`)).toBe(true);
    }
  });

  it("resolves into the src/assets/models/ directory", () => {
    const url = getModelUrl("food");
    expect(url.pathname).toContain("/src/assets/models/food.glb");
  });
});
