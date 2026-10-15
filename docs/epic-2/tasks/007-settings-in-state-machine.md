# 007 — Wire Settings Screen into the UI State Machine

## Goal

Make the Settings screen actually reachable: a button on the Main Menu opens it, and a way
back to the Main Menu from it — without disturbing any of Epic 1's existing 7 transitions
(Play, death, victory-cap, the two Restart/MainMenu pairs).

## Depends on / why it's next

Depends on 006 (the screen must exist to be wired in). Touches `src/ui/session-state.ts`,
the one place Epic 1 deliberately concentrated all transition logic — extend it, don't bypass
it with ad-hoc DOM show/hide calls elsewhere.

## Detailed steps

- Add a `Settings` state (or treat it as a modal overlay on top of `MainMenu` — whichever fits
  this codebase's existing state-machine shape better; read `session-state.ts`'s current state
  enum/union before deciding, don't assume a sibling top-level state is correct if the existing
  design favors something else).
- Transitions: `MainMenu` → `Settings` (via a new button) → back to `MainMenu`. No path from
  `Settings` to `Playing` directly (user must return to the menu and press Play, matching how
  the size-picker from task 002 also only applies at that point).
- Make sure this doesn't introduce a new way to reach `GameOver`/`Victory` or otherwise widen
  the state machine's reachable-states graph beyond what's needed — Epic 1's doc comment on
  `session-state.ts` explicitly calls out that exactly 7 transitions are reachable; update that
  comment to reflect the new count once Settings is added, don't leave it stale and wrong.

## Files touched

- `src/ui/session-state.ts`
- `index.html` (Main Menu gets a Settings button)
- `src/ui/adapter/dom/menu.adapter.ts`

## Acceptance criteria

- Settings is reachable from Main Menu and returns to Main Menu cleanly.
- All of Epic 1's original 7 transitions still work exactly as before (regression check, not
  just "new transition works").
- The state-machine doc comment in `session-state.ts` accurately describes the new transition
  count/graph.
