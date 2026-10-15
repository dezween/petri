# 014 — Mesh/Instancing Factory

## Goal

Turn world-state entities (player, bots, food) into efficiently-rendered Three.js meshes, using instancing so food/bot counts don't tank frame rate.

## Depends on / why it's next

Depends on 013 (needs loaded models to instance) and 003 (needs the entity type shapes to map from). This is the bridge between "we have models" and "we can show live game entities."

## Detailed steps

- `cell-mesh-factory.ts`: for food (likely the highest instance count), use `THREE.InstancedMesh` built from the `food.glb` geometry/material — one instanced mesh for all food, updated per-frame via per-instance transform matrices rather than individual `Object3D`s.
- For bots (lower count, three distinct geometries), either per-behavior `InstancedMesh`es (one per behavior type) or individual meshes if the expected on-screen count stays low (confirm against task 027's tuned bot counts; default to instancing per-behavior-type since it costs little and headroom is cheap).
- For the player, a single mesh (no instancing needed — there's only ever one).
- All meshes scale with entity radius (derived from mass per task 003's `massToRadius`) — scaling must happen per-instance/per-mesh, not by scaling the whole scene.
- Expose a factory API consumed by task 015 (render sync): something like `updateFromSnapshot(snapshot: WorldSnapshot)` that diffs/updates instance transforms rather than rebuilding meshes from scratch every frame.

## Files touched

- `src/render/adapter/three/cell-mesh-factory.ts`

## Acceptance criteria

- Rendering 100+ food instances uses a single draw call (or close to it) via `InstancedMesh`, not 100+ individual mesh objects.
- Entity radius changes (growth) are reflected by scaling the correct instance, not the whole instanced mesh.
- No per-frame mesh/geometry allocation — only transform updates on existing instances.
