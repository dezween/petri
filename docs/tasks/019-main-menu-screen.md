# 019 — Main Menu Screen

## Goal

Build the MainMenu screen: a Play button (and optional brief instructions text) that triggers the state machine's `MainMenu --Play--> Playing` transition.

## Depends on / why it's next

Depends on 018 (state machine must exist to wire the Play button into). First of the four screen tasks since it's the entry point.

## Detailed steps

- `menu.adapter.ts`: builds the MainMenu DOM (title, Play button, optional short instructions — e.g. "move with your cursor, eat smaller cells, avoid bigger ones").
- Play button click calls into `session-state.ts`'s `MainMenu --Play--> Playing` transition.
- Styled minimally for now using whatever's in `ui/styles/` so far — full styling pass is task 023; this task just needs correct structure/markup and functional wiring.

## Files touched

- `src/ui/adapter/dom/menu.adapter.ts`
- `index.html` (container element for the menu, if not already present from 001)

## Acceptance criteria

- Loading the app shows the MainMenu screen, not a blank page or the game directly.
- Clicking Play transitions to Playing and starts the game loop (verifiable via task 017's `start()` being called).
- No other screen's DOM is visible while MainMenu is active.
