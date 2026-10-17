import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type ModelName =
  | "player_cell"
  | "bot_wanderer"
  | "bot_hunter"
  | "bot_fleer"
  | "food"
  | "prop_empty_dish"
  | "prop_pipette"
  | "prop_droplet"
  | "prop_microscope";

/**
 * Loaded model scenes, keyed by name — no stringly-typed lookups scattered through callers.
 * Partial: a model that failed to load (corrupt/missing `.glb`) has no entry here rather than
 * aborting the whole cache, so one bad asset degrades only that one entity type (see
 * `loadAllModels`'s doc comment) — `CellMeshFactory` tolerates missing keys accordingly.
 */
export type ModelCache = Partial<Record<ModelName, THREE.Object3D>>;

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
  // Epic 2, task 012: static background decoration (never instanced per-entity like the five
  // above) — same literal-URL form Vite's bundler needs, no different treatment.
  prop_empty_dish: new URL("../../../assets/models/prop_empty_dish.glb", import.meta.url),
  prop_pipette: new URL("../../../assets/models/prop_pipette.glb", import.meta.url),
  prop_droplet: new URL("../../../assets/models/prop_droplet.glb", import.meta.url),
  // One big detailed static piece (user request) framing the dish from one side — same
  // static/non-instanced treatment as the other three props, just a lot more geometry.
  prop_microscope: new URL("../../../assets/models/prop_microscope.glb", import.meta.url),
};

const MODEL_FILES: Record<ModelName, string> = {
  player_cell: "player_cell.glb",
  bot_wanderer: "bot_wanderer.glb",
  bot_hunter: "bot_hunter.glb",
  bot_fleer: "bot_fleer.glb",
  food: "food.glb",
  prop_empty_dish: "prop_empty_dish.glb",
  prop_pipette: "prop_pipette.glb",
  prop_droplet: "prop_droplet.glb",
  prop_microscope: "prop_microscope.glb",
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
 * Loads all 5 `.glb` assets from `src/assets/models/` via `GLTFLoader`, in parallel, via
 * `Promise.allSettled` rather than `Promise.all` — so one missing/corrupt file degrades only
 * that one model instead of blacking out every entity (player, every bot, and food all at
 * once) the way an all-or-nothing `Promise.all` would. Each failure is logged individually
 * (naming which model and file failed) and simply has no entry in the returned, intentionally
 * partial `ModelCache` — never thrown as an aggregate error, so a caller can't accidentally
 * end up with zero entity types rendered just because one asset was bad.
 */
export async function loadAllModels(): Promise<ModelCache> {
  const loader = new GLTFLoader();
  const names = Object.keys(MODEL_FILES) as ModelName[];

  const results = await Promise.allSettled(
    names.map((name) => loader.loadAsync(getModelUrl(name).href)),
  );

  const cache: ModelCache = {};
  results.forEach((result, i) => {
    const name = names[i];
    if (result.status === "fulfilled") {
      cache[name] = result.value.scene;
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`Failed to load model "${name}" (${MODEL_FILES[name]}): ${reason}`);
    }
  });
  return cache;
}
