# 016 — Input Port + DOM Mouse Adapter

## Goal

Define `IInputSource` and implement cursor-direction movement input — the only input mechanic in this game (no skills, no keys for abilities).

## Depends on / why it's next

Depends on 001 (needs `src/input/` to exist). Independent of 003-015 (world/render work) — can run any time after scaffolding, but must land before 017 (game loop consumes it).

## Detailed steps

- `input.port.ts`: `IInputSource` with `getDirection(): Vector2` — returns the normalized direction from the player's current screen position toward the cursor (direction only; the world service, per task 005, decides actual movement speed).
- `mouse-input.adapter.ts`: listens to `mousemove` (and `touchmove`/`pointermove` for basic touch support, since this is a browser game — decide in this task whether touch is in scope for MVP or deferred; if deferred, note it explicitly rather than silently ignoring touch) on the renderer's canvas/container, tracks cursor position, computes direction relative to the canvas center (since camera is top-down and centered on the player per task 012).
- No split/eject/skill handling anywhere in this module — confirmed out of scope per `docs/SPEC.md`.

## Files touched

- `src/input/port/input.port.ts`
- `src/input/adapter/dom/mouse-input.adapter.ts`

## Acceptance criteria

- Moving the mouse to any point on screen produces a correctly-normalized direction vector toward that point.
- No keyboard event listeners are registered anywhere in this module (confirms no skill creep).
- Direction defaults to zero/neutral when the cursor hasn't moved yet (no undefined/NaN on first frame).
