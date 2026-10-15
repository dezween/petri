# 025 — Composition Root (bootstrap.ts)

## Goal

Centralize the wiring of every concrete adapter into its service via its port — the one place in the codebase allowed to know about every module at once.

## Depends on / why it's next

Depends on everything structural being in place: 005 (world service), 015 (render adapter complete), 016 (input adapter), 017 (game loop), 018 (UI state machine). This task doesn't add new behavior — it assembles what already exists into the real, concrete object graph the app runs with (as opposed to the hand-built fakes used for testing in earlier tasks).

## Detailed steps

- `bootstrap.ts`: constructs one `ThreeRenderer` (task 012/015), one `MouseInputAdapter` (task 016), one `WorldService` (task 005, with its bot population and food spawner from 009/010 wired in), one `GameLoopService` (task 017) injected with the above three via their ports, and the UI state machine (task 018) injected with the game loop.
- No module outside `bootstrap.ts` should construct a concrete adapter directly — everything else depends only on ports/interfaces. If any earlier task's code directly `new`'d a concrete adapter outside tests, move that construction here.

## Files touched

- `src/session/bootstrap.ts`
- Spot-fixes in any earlier file found to be constructing concrete adapters outside this composition root

## Acceptance criteria

- `bootstrap.ts` is the only file importing from more than one of `render/adapter`, `input/adapter`, `ui/adapter`, and `world/service` simultaneously.
- Swapping `ThreeRenderer` for a no-op mock `IRenderer` (from task 011's acceptance criteria) requires changing only `bootstrap.ts`, nothing in `session/game-loop.service.ts` or `world/`.
