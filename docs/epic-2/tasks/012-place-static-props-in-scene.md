# 012 — Place Static Props in the Scene

## Goal

Load the 3 prop models from task 011 and place them at fixed positions on the bench (task 010),
scattered around the dish — purely static scene dressing, never updated per-frame.

## Depends on / why it's next

Depends on 010 (bench to place them on) and 011 (models to place). Reuses Epic 1's
`model-loader.ts` (`GLTFLoader` wrapper) rather than writing a second loading mechanism.

## Detailed steps

- Load the 3 new `.glb` files via the existing `model-loader.ts` (extend its model list, don't
  fork a parallel loader).
- Place several instances (e.g. 2-3 droplets, 1 pipette, 1 empty dish) at fixed, hand-picked
  positions outside the main dish rim but within the bench plane's bounds, at a reasonable
  distance so they read as background detail rather than competing visually with the main
  dish/entities.
- These are loaded once during `init()` and never touched again during `render()` — no
  per-frame transform updates, no instancing (there are only a handful of them, `InstancedMesh`
  would be overkill here unlike the food/bot case).

## Files touched

- `src/render/adapter/three/model-loader.ts`
- `src/render/adapter/three/scene.ts` (or `three-renderer.ts`, wherever prop placement most
  naturally lives alongside the bench plane from task 010)

## Acceptance criteria

- All 3 prop types appear in the scene at `init()` and remain visible/static through gameplay
  (no accidental per-frame mutation).
- Loading failure for a prop model degrades the same way Epic 1's entity-model loading already
  does (logged, not thrown, scene stays otherwise functional) — match that existing error
  handling, don't introduce a different failure mode for these new assets.
