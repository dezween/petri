# 022 — Victory Screen

## Goal

Show the Victory screen when the player's radius hits the cap defined in task 004: congratulatory message, Restart button, MainMenu button.

## Depends on / why it's next

Depends on 021 (mirrors its structure closely — same button wiring pattern, different trigger and message) and 004 (the victory-cap condition it's reacting to).

## Detailed steps

- `victory.adapter.ts`: builds the Victory DOM — congratulatory message fitting the petri-dish theme (e.g. "You've consumed the entire dish!"), Restart button (`Victory --Restart--> Playing`), MainMenu button (`Victory --MainMenu--> MainMenu`).
- Shown exactly when the state machine enters Victory (triggered by task 017's victory-cap event bubbling through task 018's transition, sourced from task 004/005's `isAtVictoryCap` check).
- Final mass/score at the moment of victory should be displayed too, same capture-before-reset consideration as task 021.

## Files touched

- `src/ui/adapter/dom/victory.adapter.ts`

## Acceptance criteria

- Reaching the victory-cap radius correctly transitions to Victory (not GameOver, not silently continuing to grow).
- Restart and MainMenu buttons behave identically to task 021's (same reset guarantees).
- Victory screen is visually distinct from GameOver (different message/tone at minimum, full styling in 023).
