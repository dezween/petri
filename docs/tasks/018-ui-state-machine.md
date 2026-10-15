# 018 — UI State Machine

## Goal

Implement the explicit MainMenu/Playing/GameOver/Victory state machine from `docs/SPEC.md`, as the backbone the four screen tasks (019-022) hang off of.

## Depends on / why it's next

Depends on 017 (needs the game loop's `start()`/`stop()` and its death/victory-cap events to drive transitions). Must land before 019-022 (each screen task implements one state's view, but the transition logic itself belongs here, not duplicated across screens).

## Detailed steps

- `src/ui/session-state.ts` (or similar): a small explicit state machine with states `MainMenu | Playing | GameOver | Victory`, transitions:
  - `MainMenu --Play--> Playing` (starts the game loop from 017)
  - `Playing --death--> GameOver` (stops the game loop, triggered by task 017's death event)
  - `Playing --victoryCap--> Victory` (stops the game loop, triggered by task 017's victory-cap event)
  - `GameOver --Restart--> Playing` (resets world state, restarts the loop)
  - `GameOver --MainMenu--> MainMenu`
  - `Victory --Restart--> Playing`
  - `Victory --MainMenu--> MainMenu`
- Each state transition shows/hides the relevant screen's DOM (screens themselves are built in 019-022; this task can use empty placeholder containers if those land later, but the transition wiring and event listeners for their buttons belong here per screen's `port` contract).
- `hud.port.ts`: define the interface the state machine/game loop use to push live data (mass/score) to whatever is currently rendering it — implemented concretely by task 020.

## Files touched

- `src/ui/session-state.ts`
- `src/ui/port/hud.port.ts`

## Acceptance criteria

- Every state transition in the list above is reachable and leaves the game loop in the correct running/stopped state (no leaked loop running during MainMenu/GameOver/Victory, no missing loop during Playing).
- Restart fully resets world state (new player, fresh bot/food population) rather than continuing stale state.
- No transition is reachable that isn't in the explicit list (e.g. MainMenu can't jump directly to GameOver).
