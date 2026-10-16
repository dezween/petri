# 002 — Shadow Mapping Setup

## Goal

Enable shadow mapping on the renderer and light, and make the static arena geometry (floor,
rim, lab-bench) receive shadows. This task does NOT make any entity cast a shadow yet (that's
task 003) — after this task, the scene should render identically to before except that nothing
visibly changes yet (no caster = no shadow to see), which is fine; this task is the plumbing,
003 is the payoff.

## Depends on / why it's next

Independent of task 001 (camera tilt) — shadow configuration doesn't depend on camera angle,
though a tilted camera will make shadows much more visible/legible than a straight-down one
would, so doing 001 first is a reasonable sequencing even though it isn't a hard dependency.
Depends on nothing else in Epic 3.

## Detailed steps

- `src/render/adapter/three/three-renderer.ts`: set `renderer.shadowMap.enabled = true` and
  `renderer.shadowMap.type = THREE.PCFSoftShadowMap` on the `WebGLRenderer` created in `init()`.
- `src/render/adapter/three/lighting.ts`: make the existing `DirectionalLight` shadow-casting
  (`light.castShadow = true`). Configure its `shadow.camera` (an orthographic frustum for a
  directional light) to cover the arena at its largest configured width — read
  `src/world/service/world.service.ts`'s arena-size constants (Epic 2 task 001:
  Small/Medium/Large = 1000/1500/2000) and size the frustum for the Large case, with the same
  kind of worst-case-headroom reasoning `scene.ts`'s `BENCH_RADIUS` comment documents for an
  analogous sizing problem — don't under-size it and clip shadows at the arena edge, and don't
  wildly over-size it either (a needlessly huge shadow-camera frustum wastes shadow-map
  resolution on empty space, making shadows blockier than they need to be for the area that
  actually matters).
- Set `shadow.mapSize.width = shadow.mapSize.height = 2048` (SPEC.md's starting value — tuned
  for real in task 006 if needed).
- `src/render/adapter/three/scene.ts`: set `receiveShadow = true` on the arena floor mesh, the
  rim mesh, and the lab-bench mesh (all three, built in `buildArenaFloorAndRim`/`buildLabBench`).
  Do NOT set `castShadow` on any of these — nothing in the scene would cast a shadow onto them
  from below, so they're receivers only (see SPEC.md's Design Decision 2 for this reasoning).

## Files touched

- `src/render/adapter/three/three-renderer.ts`
- `src/render/adapter/three/lighting.ts`
- `src/render/adapter/three/scene.ts`
- Corresponding `*.test.ts` files for each — verify the shadow-related properties/flags are
  actually set, not just that the functions still run without throwing.

## Acceptance criteria

- `renderer.shadowMap.enabled === true`, `shadowMap.type === THREE.PCFSoftShadowMap`.
- The directional light has `castShadow === true` and a `shadow.camera` frustum sized to cover
  at least the Large arena (2000-wide) without clipping.
- Floor, rim, and lab-bench meshes all have `receiveShadow === true`.
- `npx vitest run` passes.
- No visible regression in a real browser — the scene should look the same as before this task
  (shadows exist in the pipeline now but nothing casts one yet).
