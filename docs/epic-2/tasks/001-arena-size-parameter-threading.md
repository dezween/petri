# 001 — Arena Size Parameter Threading

## Goal

Thread a selectable arena width through `SessionState`'s bootstrap/Restart flow instead of
always constructing `WorldService`/`ThreeRenderer`/`BotPopulationService`/`FoodSpawnerService`
with the default. No UI yet — that's task 002. This task is pure wiring.

## Depends on / why it's next

Depends on nothing new — builds directly on Epic 1's finished `src/session/session-state.ts`,
`src/session/bootstrap.ts`, `src/world/service/world.service.ts`, and
`src/render/adapter/three/three-renderer.ts`. **Correction (code-review finding, see
`docs/epic-2/REVIEW.md` CR-01):** `WorldService`'s constructor 4th param and
`SessionStateDeps.arenaWidth?` already exist and are already re-threaded on every Play/Restart
via `SessionState.createFreshGameLoop()` — that part really is additive, nothing to change. But
`ThreeRenderer` is **not** in the same position: it's constructed exactly once in
`bootstrap.ts`, *before* any menu/size choice can exist, and `SessionState` holds that single
`IRenderer` instance for the app's entire lifetime (confirmed: `init`/`render`/`resize`/
`dispose` is `IRenderer`'s entire contract — no method to reconfigure its arena dimension
afterward). Choosing Medium/Large on the Main Menu would otherwise produce a `WorldService`
with correctly-sized circular collision bounds while the renderer keeps drawing the Small-sized
dish floor/rim forever — reproducing the "square-vs-circle clamp bug... in a new form" this
task already warns about, just via a stale renderer instead of a stale clamp formula. This task
is *not* pure wiring for that one piece — it needs a small, explicitly-scoped renderer change
too (see below).

## Detailed steps

- Confirm (don't assume) exactly how `arenaWidth` currently flows from `SessionState` into
  `WorldService`/`BotPopulationService`/`FoodSpawnerService`/`ThreeRenderer` construction on
  Restart — read `src/ui/session-state.ts` and `src/session/bootstrap.ts` in full first.
- Extend whatever "start a new game" entry point `SessionState` exposes to accept a chosen
  arena width (one of the three fixed sizes from `docs/epic-2/SPEC.md`: 1000 / 1500 / 2000),
  defaulting to Small (1000, the existing `DEFAULT_ARENA_WIDTH`) if none is supplied — so
  nothing breaks before task 002 adds a real picker.
- **Renderer-side fix (the part Epic 1's existing code doesn't already cover):** add a new
  `setArenaWidth(width: number): void` method to the `IRenderer` port
  (`src/render/port/renderer.port.ts`) and implement it on `ThreeRenderer`. Chosen over the
  alternative (disposing and reconstructing a whole new `ThreeRenderer`/`WebGLRenderer`/canvas
  per Play) because:
  - `ThreeRenderer.dispose()` exists but is — per a separate code-review finding — currently
    *unreachable* in the app's wiring precisely because nothing in this codebase has ever
    needed to tear down and recreate the renderer; introducing that lifecycle here, just for
    arena resize, would be a bigger and riskier change than one targeted method.
  - `main.ts`'s `window.addEventListener("resize", ...)` closes over the single `renderer`
    reference `bootstrap()` returns. Swapping in a brand-new `ThreeRenderer` instance from
    inside `SessionState` would leave that closure pointing at a stale, disposed instance
    (`bootstrap.ts` returns `BootstrappedApp.renderer`, a plain value, not a mutable
    reference `main.ts` re-reads). Keeping one long-lived `IRenderer` identity avoids this
    entirely.
  - This mirrors the existing `resize()` method's own pattern exactly: mutate camera/scene
    state in place on the already-constructed renderer, rather than rebuild objects.
  - Implementation: remove the current `"arena-floor"`/`"arena-rim"` meshes from the scene,
    dispose their geometry/materials (same pattern as the `dispose()` fix landed via code
    review — see `ThreeRenderer.dispose()`'s floor/rim cleanup loop for the exact shape to
    reuse), then call `createScene`'s floor/rim-building logic again at the new width and
    re-add the results. Do **not** rebuild lighting, the camera, or `meshFactory` — only the
    static floor/rim geometry depends on `arenaWidth`.
  - Call `renderer.setArenaWidth(arenaWidth)` from `SessionState.play()`, before
    `createFreshGameLoop()`, every time (idempotent — rebuilding at an unchanged width is
    cheap and still correct, so no need to track "did it actually change").
- Make sure the chosen width is used consistently across *all four* places that currently take
  it (world service, renderer, population service, food spawner) — a mismatch between, say,
  the renderer's arena visual size and the world's actual collision bounds would reproduce the
  square-vs-circle clamp bug Epic 1 already fixed once (see `docs/epic-1/REVIEW.md` /
  task 024's history) in a new form. Don't let that regress.

## Files touched

- `src/ui/session-state.ts`
- `src/session/bootstrap.ts`
- `src/render/port/renderer.port.ts` — add `setArenaWidth(width: number): void` to `IRenderer`.
- `src/render/adapter/three/three-renderer.ts` — implement `setArenaWidth`, rebuilding the
  floor/rim in place.

## Acceptance criteria

- Calling the "start game" path with an explicit arena width of 1500 or 2000 produces a world,
  renderer, and spawners that all agree on that width. Satisfiable at the port level without
  breaking the hexagonal boundary: assert `IRenderer.setArenaWidth` was called with the same
  width value passed to `WorldService`'s constructor (e.g. a fake `IRenderer` test double
  recording its calls, the same convention `session-state.test.ts` already uses for
  `GameLoopService`) — don't reach into `ThreeRenderer`'s internal `THREE.Scene` object graph
  to verify this.
- Omitting an explicit width still defaults to 1000 and behaves exactly as Epic 1 did (no
  regression for existing tests).
- A test exercises `ThreeRenderer.setArenaWidth` directly (not just through `SessionState`)
  and confirms the old floor/rim mesh's geometry/material were disposed before the new one
  was added — the same "disposed, not leaked" bar `ThreeRenderer.dispose()`'s own test holds
  itself to.
- `npx vitest run` passes, including all pre-existing tests.
