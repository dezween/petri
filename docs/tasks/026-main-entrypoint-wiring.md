# 026 — main.ts Entrypoint + index.html Wiring

## Goal

Replace the placeholder entrypoint from task 001 with the real one, calling into the composition root from task 025.

## Depends on / why it's next

Depends on 025 (needs `bootstrap.ts` to call). Last purely-structural task before the balance pass (027) — this is the point where the full game is wired and runnable top-to-bottom for the first time.

## Detailed steps

- `src/main.ts`: imports and calls `bootstrap.ts`'s setup function, passing in the DOM container element from `index.html`.
- `index.html`: final structure — canvas container, menu/HUD/game-over/victory containers (if not already finalized in earlier UI tasks), `<link>` to compiled `main.scss` (or Vite's handling of it), `<script type="module" src="/src/main.ts">`.
- Remove the task-001 placeholder content entirely — this task supersedes it, not layers on top of it.

## Files touched

- `src/main.ts`
- `index.html`

## Acceptance criteria

- `make dev` serves the full game: MainMenu loads, Play starts a working session, eating/growth/death/victory all function, Restart and MainMenu buttons work.
- No leftover placeholder text/markup from task 001 remains anywhere in `index.html` or `main.ts`.
- `make build` produces a production build with no errors.
