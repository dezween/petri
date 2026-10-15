# 015 — Render Sync

## Goal

Wire `IRenderer.render(snapshot)` (task 011) to actually call into the mesh factory (task 014) every frame, completing the `ThreeRenderer` implementation.

## Depends on / why it's next

Depends on 014 (mesh factory must exist to call) and 012 (scene/camera must exist to render into). This is the task that makes `ThreeRenderer` a complete, working `IRenderer` implementation — the last render-module task before input (016) and the game loop (017) can wire everything together.

## Detailed steps

- `ThreeRenderer.render(snapshot)`: calls `cell-mesh-factory.ts`'s `updateFromSnapshot(snapshot)`, then calls the camera's zoom/height adjustment (hook from task 012) based on the player's current radius in the snapshot, then calls `renderer.render(scene, camera)`.
- Confirm `init()` → `render()` → `dispose()` lifecycle works end-to-end with a hand-built fake `WorldSnapshot` (no real game loop needed yet to verify this).

## Files touched

- `src/render/adapter/three/three-renderer.ts`

## Acceptance criteria

- Calling `render()` repeatedly with changing fake snapshots (entities moving, growing, being removed) visibly updates the scene correctly.
- `dispose()` cleans up the renderer/canvas with no leaked WebGL context warnings.
- No console errors across a sustained run (several hundred frames) with a snapshot that adds/removes entities over time.
