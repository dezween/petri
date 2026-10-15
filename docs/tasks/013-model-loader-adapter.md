# 013 — Model Loader Adapter

## Goal

Load the 5 `.glb` assets produced in task 002 via Three.js's `GLTFLoader`, cached and ready to be instanced by task 014.

## Depends on / why it's next

Depends on 002 (the `.glb` files must exist) and 012 (needs a scene to eventually place loaded models into, though loading itself is scene-independent). This is the first task to actually touch the Blender output.

## Detailed steps

- `model-loader.ts`: wraps `GLTFLoader`, exposes an async `loadAll(): Promise<ModelCache>` that loads all 5 models (`player_cell.glb`, `bot_wanderer.glb`, `bot_hunter.glb`, `bot_fleer.glb`, `food.glb`) from `src/assets/models/` and returns them keyed by name.
- `ThreeRenderer.init()` (from task 012) should await this before accepting its first `render()` call, or render a loading state — decide based on how task 017/018 want to sequence startup (likely: MainMenu can show before load finishes, loading just needs to complete before Playing starts).
- Smoke-test each model loads without console errors/warnings (confirms task 002's export settings are valid glTF).

## Files touched

- `src/render/adapter/three/model-loader.ts`

## Acceptance criteria

- All 5 models load successfully with no console errors.
- `loadAll()` resolves with a cache object providing typed access to each model by name (no stringly-typed lookups scattered through calling code).
- A deliberately-missing/corrupt file produces a clear error rather than a silent failure.
