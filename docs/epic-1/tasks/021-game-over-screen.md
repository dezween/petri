# 021 — Game Over Screen

## Goal

Show the GameOver screen on player death: final score, Restart button, MainMenu button.

## Depends on / why it's next

Depends on 018 (state machine's `Playing --death--> GameOver` transition and the `Restart`/`MainMenu` transitions out of GameOver). Depends on 020 for the final mass/score value to display (reuse whatever the HUD was tracking at the moment of death).

## Detailed steps

- `game-over.adapter.ts`: builds the GameOver DOM — final score, Restart button (triggers `GameOver --Restart--> Playing`), MainMenu button (triggers `GameOver --MainMenu--> MainMenu`).
- Shown exactly when the state machine enters GameOver (triggered by task 017's death event bubbling through task 018's transition).
- Final score value should be captured at the moment of death, not read live after the fact (world state resets on Restart, so the score display must be frozen before that happens).

## Files touched

- `src/ui/adapter/dom/game-over.adapter.ts`

## Acceptance criteria

- Player death (eaten by a bigger bot) correctly transitions to GameOver and shows the final score.
- Restart correctly resets and restarts the game (new player, fresh world) rather than continuing stale state.
- MainMenu button correctly returns to the MainMenu screen with no game loop running.
