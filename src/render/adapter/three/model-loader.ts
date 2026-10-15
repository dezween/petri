import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type ModelName = "player_cell" | "bot_wanderer" | "bot_hunter" | "bot_fleer" | "food";

/** Loaded model scenes, keyed by name — no stringly-typed lookups scattered through callers. */
export type ModelCache = Record<ModelName, THREE.Object3D>;

/**
 * One literal `new URL(path, import.meta.url)` per model — this is Vite's documented,
 * reliably-statically-analyzable form for bundling an asset this way (a templated/variable
 * path works too in practice, but isn't the form Vite's docs commit to). Note: in a
 * production build, `bot_wanderer.glb` and `food.glb` (both under Vite's default 4KB
 * `assetsInlineLimit`) end up inlined as base64 data URIs in the JS bundle rather than
 * separate files under `dist/assets/` — that's expected, and `GLTFLoader` loads a `data:`
 * URL the same way it loads a regular one, so it doesn't need special-casing here.
 */
const MODEL_URLS: Record<ModelName, URL> = {
  player_cell: new URL("../../../assets/models/player_cell.glb", import.meta.url),
  bot_wanderer: new URL("../../../assets/models/bot_wanderer.glb", import.meta.url),
  bot_hunter: new URL("../../../assets/models/bot_hunter.glb", import.meta.url),
  bot_fleer: new URL("../../../assets/models/bot_fleer.glb", import.meta.url),
  food: new URL("../../../assets/models/food.glb", import.meta.url),
};

const MODEL_FILES: Record<ModelName, string> = {
  player_cell: "player_cell.glb",
  bot_wanderer: "bot_wanderer.glb",
  bot_hunter: "bot_hunter.glb",
  bot_fleer: "bot_fleer.glb",
  food: "food.glb",
};

/**
 * Resolves a model's file name to a loadable URL. Kept separate from `loadAll` so the URL
 * lookup (pure, environment-dependent only on `import.meta.url`) can be unit tested without
 * actually invoking `GLTFLoader` against the filesystem/network.
 */
export function getModelUrl(name: ModelName): URL {
  return MODEL_URLS[name];
}

/**
 * Loads all 5 `.glb` assets from `src/assets/models/` via `GLTFLoader`, in parallel. A
 * missing/corrupt file rejects with a message naming which model failed, rather than
 * surfacing GLTFLoader's generic error or silently resolving with a hole in the cache.
 */
export async function loadAllModels(): Promise<ModelCache> {
  const loader = new GLTFLoader();
  const names = Object.keys(MODEL_FILES) as ModelName[];

  const scenes = await Promise.all(
    names.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(getModelUrl(name).href);
        return gltf.scene;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load model "${name}" (${MODEL_FILES[name]}): ${reason}`);
      }
    }),
  );

  const cache = {} as ModelCache;
  names.forEach((name, i) => {
    cache[name] = scenes[i];
  });
  return cache;
}
