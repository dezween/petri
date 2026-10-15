# 002 — Main Menu Size-Picker UI

## Goal

Add a Small/Medium/Large arena-size picker to the Main Menu screen, wired to the threading
task 001 built.

## Depends on / why it's next

Depends on 001 (needs a real "start game with width X" path to call). Touches the same
`menu.adapter.ts` Epic 1 already built — extends it, doesn't replace it.

## Detailed steps

- Add three buttons (or a segmented control) to `index.html`'s menu-screen markup: Small /
  Medium / Large, with one selected by default (Small, matching task 001's default).
- `src/ui/adapter/dom/menu.adapter.ts`: track the selected size, expose it to whatever calls
  "Play" so `SessionState` receives the chosen width via task 001's new entry point.
- Keep the existing Play button behavior intact — this is an additional control on the same
  screen, not a new screen/state.
- There's no separate SCSS-polish task in this epic's breakdown (unlike Epic 1's task 023) —
  style the new control reasonably presentably as part of this task rather than leaving it
  bare, but don't over-invest; it's a secondary control on an existing screen.

## Files touched

- `index.html`
- `src/ui/adapter/dom/menu.adapter.ts`
- `src/ui/styles/components/_menu.scss` (minimal styling for the new control)

## Acceptance criteria

- Selecting Medium or Large and clicking Play starts a game with that arena width (verify via
  a duck-typed-mock unit test on the adapter, following this codebase's established pattern of
  testing DOM adapters without jsdom).
- Default selection (no interaction) still plays Small, matching Epic 1 behavior exactly.
