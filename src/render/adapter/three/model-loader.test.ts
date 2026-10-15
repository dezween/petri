import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getModelUrl, loadAllModels, type ModelName } from "./model-loader";

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

describe("loadAllModels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with a full cache when every model loads successfully", async () => {
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => ({ scene: new THREE.Group() }) as any,
    );

    const cache = await loadAllModels();

    for (const name of ALL_MODEL_NAMES) {
      expect(cache[name]).toBeInstanceOf(THREE.Group);
    }
  });

  it("degrades gracefully when exactly one model fails to load — the other four still resolve", async () => {
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (url: string): Promise<any> => {
        if (url.includes("food")) throw new Error("404");
        return { scene: new THREE.Group() };
      },
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const cache = await loadAllModels();

    expect(cache.food).toBeUndefined();
    for (const name of ALL_MODEL_NAMES.filter((n) => n !== "food")) {
      expect(cache[name]).toBeInstanceOf(THREE.Group);
    }
    // The failure is still surfaced (named, not swallowed), just not thrown.
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("food"));
  });

  it("never rejects even if every model fails to load", async () => {
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const cache = await loadAllModels();

    expect(cache).toEqual({});
  });
});
