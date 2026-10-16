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
  `src/ui/adapter/dom/menu.adapter.ts`'s arena-size constants (`ARENA_WIDTH_SMALL`/`_MEDIUM`/
  `_LARGE` = 1000/1500/2000) and size the frustum for the Large case (radius 1000). The shadow
  frustum only needs to cover the arena's fixed world-space footprint — a circle of radius 1000
  for the Large arena — regardless of camera zoom or aspect ratio, so size
  `shadow.camera.left/right/top/bottom` to roughly `±1200` (1000 radius plus a ~20% margin for
  the frustum's projection skew under the light's tilt). **Do not** reuse `scene.ts`'s
  `BENCH_RADIUS` (6000) sizing reasoning here — that value is specifically derived from the
  *camera's* viewport worst-case (zoom-out curve, player roam offset, ultrawide aspect), none of
  which bounds what the shadow camera needs to see. Using `BENCH_RADIUS`-scale values would make
  shadows noticeably blockier than the 2048 resolution below is meant to support, for no benefit
  (entities can never be positioned outside the arena's fixed radius 1000, no matter how the
  player's camera is zoomed).
- **Shadow camera near/far and light position/target** (the part that's easy to miss): the
  orthographic `shadow.camera`'s `left/right/top/bottom` only bound the frustum's width/height —
  `near`/`far` separately bound its depth *along the light's view direction*, and Three.js's
  defaults (`near = 0.5`, `far = 500`) are nowhere near enough here. The light is created as:
  ```ts
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(100, 300, 150);
  ```
  with no `light.target` ever set, so the target defaults to the world origin `(0, 0, 0)` —
  distance from light to target is `sqrt(100² + 300² + 150²) = 350`, and the unit view direction
  (light → target) is `(-2/7, -6/7, -3/7) ≈ (-0.2857, -0.8571, -0.4286)`. Entities only ever sit
  in the horizontal (X/Z) plane at `y = 0` (confirmed: `cell-mesh-factory.ts`'s
  `position.set(x, 0, z)`), so for a point offset by `(dx, 0, dz)` from the origin, its depth
  along the view axis is `350 + (-0.2857·dx - 0.4286·dz)`. Over the Large arena's full disk
  (radius 1000 around the origin), that offset term ranges over
  `±1000 · sqrt(0.2857² + 0.4286²) ≈ ±515`, so the real depth range needed is
  **`[350 - 515, 350 + 515] = [-165, 865]`** at the light's current position — i.e. part of the
  arena is already behind the light's near plane entirely (negative depth), which no choice of
  positive `near`/`far` can fix without moving the light.
  Fix: move the light further back along the *same* direction (direction-only change — moving a
  `DirectionalLight`'s position along a fixed direction doesn't change its lighting, only where
  its shadow camera sits) by scaling its position 3x, to **`(300, 900, 450)`** (distance 1050
  from target, same direction). Depth range shifts by the same `+700` (`350 → 1050`), becoming
  `[1050 - 515, 1050 + 515] = [535, 1565]`. Set:
  ```ts
  directional.position.set(300, 900, 450);
  directional.shadow.camera.near = 400;
  directional.shadow.camera.far = 1700;
  ```
  giving a ~135-unit margin on each side of the real `[535, 1565]` range. No change to
  `light.target` is needed — it already defaults to the origin, which is where the arena is
  centered.
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
  at least the Large arena (2000-wide) without clipping, with `near`/`far` set to actually cover
  every point in the Large arena along the light's view axis (verified by computing worst-case
  depth the way this task's steps above compute it — `[535, 1565]` for `near = 400`/`far = 1700`
  at light position `(300, 900, 450)` — not just the frustum's width/height).
- Floor, rim, and lab-bench meshes all have `receiveShadow === true`.
- `npx vitest run` passes.
- No visible regression in a real browser — the scene should look the same as before this task
  (shadows exist in the pipeline now but nothing casts one yet).
