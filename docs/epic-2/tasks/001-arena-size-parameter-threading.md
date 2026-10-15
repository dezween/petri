# 001 — Arena Size Parameter Threading

## Goal

Thread a selectable arena width through `SessionState`'s bootstrap/Restart flow instead of
always constructing `WorldService`/`ThreeRenderer`/`BotPopulationService`/`FoodSpawnerService`
with the default. No UI yet — that's task 002. This task is pure wiring.

## Depends on / why it's next

Depends on nothing new — builds directly on Epic 1's finished `src/session/session-state.ts`,
`src/session/bootstrap.ts`, and `src/world/service/world.service.ts` (all already accept
`arenaWidth`, confirmed: `WorldService`'s constructor 4th param, `SessionStateDeps.arenaWidth?`
already exists as an optional field). Nothing in Epic 1 needs to change — this is additive.

## Detailed steps

- Confirm (don't assume) exactly how `arenaWidth` currently flows from `SessionState` into
  `WorldService`/`BotPopulationService`/`FoodSpawnerService`/`ThreeRenderer` construction on
  Restart — read `src/ui/session-state.ts` and `src/session/bootstrap.ts` in full first.
- Extend whatever "start a new game" entry point `SessionState` exposes to accept a chosen
  arena width (one of the three fixed sizes from `docs/epic-2/SPEC.md`: 1000 / 1500 / 2000),
  defaulting to Small (1000, the existing `DEFAULT_ARENA_WIDTH`) if none is supplied — so
  nothing breaks before task 002 adds a real picker.
- Make sure the chosen width is used consistently across *all four* places that currently take
  it (world service, renderer, population service, food spawner) — a mismatch between, say,
  the renderer's arena visual size and the world's actual collision bounds would reproduce the
  square-vs-circle clamp bug Epic 1 already fixed once (see `docs/epic-1/REVIEW.md` /
  task 024's history) in a new form. Don't let that regress.

## Files touched

- `src/ui/session-state.ts`
- `src/session/bootstrap.ts`

## Acceptance criteria

- Calling the "start game" path with an explicit arena width of 1500 or 2000 produces a world,
  renderer, and spawners that all agree on that width (verify with a unit test asserting the
  same width value reaches each constructed service, not just that the call doesn't throw).
- Omitting an explicit width still defaults to 1000 and behaves exactly as Epic 1 did (no
  regression for existing tests).
- `npx vitest run` passes, including all pre-existing tests.
