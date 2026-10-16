# 003 — Entity Meshes Cast Shadows

## Goal

Make the player mesh, all three bot `InstancedMesh`es, the food `InstancedMesh`, and the static
decorative props all cast shadows onto the now-shadow-receiving arena floor/rim/bench (task
002). This is the task where shadows actually become visible.

## Depends on / why it's next

Depends on 002 (shadow mapping must be enabled and the floor/rim/bench must already be
receivers, or a caster here would have nothing to cast onto). Independent of 001 (camera tilt)
functionally, but shadows will be far more visually legible once the camera isn't looking
straight down — verify this task's result with task 001 already in place.

## Detailed steps

- `src/render/adapter/three/cell-mesh-factory.ts`: set `castShadow = true` on the player mesh
  (built via `buildStaticObject` — if it's a multi-primitive `Group`, as `player_cell.glb` is,
  per the Epic 2 review-pass fix documented in `buildStaticObject`'s own doc comment, make sure
  every child `Mesh` in the group gets the flag, not just the group itself — `Object3D.castShadow`
  on a `Group` has no rendering effect, Three.js only checks it on actual `Mesh` objects) and on
  the three bot `InstancedMesh`es and the food `InstancedMesh` (set once at construction time in
  the `CellMeshFactory` constructor, not per-frame — it's a static flag, not something that
  changes with entity state).
- `src/render/adapter/three/static-props.ts` (Epic 2 task 012's static prop loader): same
  `castShadow = true` treatment for the decorative props, with the same Group-vs-Mesh care if
  any prop model is multi-primitive.
- Confirm `InstancedMesh` shadow-casting actually works as expected for this codebase's specific
  usage (each instance should cast its own shadow using its own per-instance transform from
  `setMatrixAt`) — this is standard Three.js behavior, but verify visually in a real browser
  rather than assuming from documentation alone, since this is the task where a subtle
  per-instance-matrix mistake would be easy to miss in a unit test (no real WebGL/shadow-map
  rendering happens in this project's vitest environment).

## Files touched

- `src/render/adapter/three/cell-mesh-factory.ts`
- `src/render/adapter/three/static-props.ts`
- Corresponding `*.test.ts` files — verify the `castShadow` flags are set on construction.

## Acceptance criteria

- Player mesh, all bot `InstancedMesh`es, food `InstancedMesh`, and static props all have
  `castShadow === true`.
- `npx vitest run` passes.
- Manually verified in a real browser: entities visibly cast shadows onto the arena floor,
  shadows move correctly as entities move, shadows don't flicker or disappear at the edges of
  the shadow-camera frustum sized in task 002.
