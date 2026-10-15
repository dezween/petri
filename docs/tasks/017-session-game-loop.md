# 017 — Session Game-Loop Service

## Goal

Wire the three completed modules together for the first time: input → world tick → render, running on `requestAnimationFrame`.

## Depends on / why it's next

Depends on 005 (world service), 015 (render sync complete), and 016 (input adapter). This is the first task where the game is actually playable end-to-end, even without any UI chrome around it (that's 018-022).

## Detailed steps

- `game-loop.service.ts`: holds references to one `IInputSource`, one `world.service.ts` instance, and one `IRenderer`. Runs a `requestAnimationFrame` loop:
  1. Read `inputSource.getDirection()`.
  2. Call `worldService.tick(deltaTime, direction)`.
  3. Call `renderer.render(worldService.getSnapshot())`.
  4. Check the tick result for death/victory-cap flags (from task 005) and expose them via a callback/event so task 018's state machine can react (game loop itself doesn't own UI state transitions — it just reports what happened).
- Compute `deltaTime` properly (time since last frame), don't assume a fixed frame rate.
- Expose `start()`/`stop()` so the state machine (018) can start/stop the loop on entering/leaving the Playing state.

## Files touched

- `src/session/game-loop.service.ts`

## Acceptance criteria

- Starting the loop with a real mouse input and real renderer produces a visibly playable scene: player moves toward the cursor, eats food/bots, bots move per their behaviors.
- `stop()` actually halts the `requestAnimationFrame` loop (verified by confirming no further ticks after calling it).
- Death and victory-cap events fire exactly once each per occurrence (no duplicate/missed events).
