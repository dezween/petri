# 001 — Tilt the Camera

## Goal

Change the camera from a perfectly top-down (90° elevation) view to a tilted one (65-70°
elevation from horizontal), without breaking camera-follow, zoom-by-mass, or aspect/resize
handling. This is the foundational task — every later Epic 3 task should be checked against the
tilted view, not the old top-down one.

## Depends on / why it's next

Nothing in Epic 3 (first task). Builds on Epic 1 task 012 (camera creation) and the camera-
follow fix (`updateCameraPosition`, documented in `camera.ts` as having been missing end-to-end
until caught by a real playtest — read that comment for context on how load-bearing this
function is).

## Detailed steps

- Read `src/render/adapter/three/camera.ts` in full before changing anything — `createCamera`,
  `updateCameraPosition`, `updateCameraAspect`, `adjustZoomForPlayerRadius` all interact.
- Add a tilt: offset the camera's position away from the player along world -Z by
  `CAMERA_HEIGHT / tan(elevationDegrees)` (see SPEC.md's Design Decision 1 for the derivation
  and a worked example at 67°), keeping `lookAt(player)`. This changes both `createCamera`
  (initial position) and `updateCameraPosition` (per-frame follow) — they must stay consistent
  with each other, or the camera will jump between its initial pose and its first follow-update.
- Re-examine the `camera.up.set(0, 0, -1)` line and its comment (it exists specifically to dodge
  the look-straight-down degenerate case). Determine whether it's still needed once tilted, or
  whether the natural `(0, 1, 0)` up vector works now that the view direction isn't parallel to
  it — don't assume either way, verify (a unit test can check `camera.up` doesn't produce a
  degenerate view matrix, e.g. by checking the resulting `matrixWorldInverse` isn't singular, or
  more simply by checking the camera's computed "forward" and "up" aren't parallel).
- `updateCameraAspect`/`adjustZoomForPlayerRadius` operate on `camera.top/bottom/left/right` —
  these shouldn't need logic changes (they're already independent of camera position/tilt), but
  re-verify this is actually true once tilted, don't just assume orthogonality holds.
- Make the elevation angle a named, documented constant (e.g. `CAMERA_ELEVATION_DEGREES`) so
  task 006's balance pass can tune it without re-deriving the trig.
- **Note for task 006**: `src/render/adapter/three/post-processing.ts`'s radial-blur effect is
  documented as assuming the camera looks straight down (every entity sits at roughly the same
  camera-space depth, and "near the screen center" correlates with "near the dish center"
  specifically because of that straight-down assumption). Tilting the camera here breaks that
  assumption — the circular arena floor no longer projects as a screen-centered circle once
  tilted, so the blur ring's `innerRadius`/`outerRadius` falloff may no longer line up
  symmetrically with the dish edge. This task does not need to fix `post-processing.ts` itself
  (out of this task's scope — it doesn't touch camera geometry), but task 006's regression pass
  must re-verify/retune it under the new tilt (see task 006's checklist).

## Files touched

- `src/render/adapter/three/camera.ts`
- `src/render/adapter/three/camera.test.ts` — existing tests assert `camera.position.x === 0`
  and `camera.position.z === 0` for a camera centered on the origin (player at `(0,0)`); with a
  tilt offset, `position.z` is no longer `0` even when `lookAt` targets the origin — these
  assertions need updating to reflect the tilted geometry, not deleting.

## Acceptance criteria

- `createCamera` and `updateCameraPosition` produce a camera tilted 65-70° from horizontal
  (not 90°), consistently with each other (no visible jump/snap on the first frame after
  `init()`).
- `updateCameraAspect` and `adjustZoomForPlayerRadius` still behave correctly under the tilt
  (verified by test, not just inspection — e.g. aspect ratio changes still produce the expected
  frustum width/height relationship).
- `npx vitest run` passes, including updated/new tests for the tilted geometry.
- Manually confirmed in a real browser (dev server, not just unit tests) that the view is
  visibly tilted and the camera still follows the player smoothly with no jitter/snapping.
