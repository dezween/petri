# 023 — SCSS Styling Pass

## Goal

Replace the minimal/unstyled markup from tasks 019-022 with a cohesive visual pass, using the lightweight ITCSS/7-1-inspired structure from `docs/SPEC.md`.

## Depends on / why it's next

Depends on 019-022 (all four screens must exist structurally before styling them) and 020 (HUD markup). This is the first purely-visual task — no new behavior, only presentation.

## Detailed steps

- `_tokens.scss`: CSS custom properties for colors, spacing, typography — matching the microbiology/petri-dish theme (soft organic colors, translucent/glassy surfaces echoing the 3D cell materials).
- `base/`: reset + base typography.
- `components/`: one partial per screen/component — `_menu.scss`, `_hud.scss`, `_game-over.scss`, `_victory.scss`.
- `layout/`: overlay positioning (HUD corners, centered modal screens over the canvas, responsive sizing).
- `main.scss`: imports all partials in the correct order (tokens → base → layout → components).
- Confirm Vite + `sass` package compiles `main.scss` correctly (dependency already added in task 001).

## Files touched

- `src/ui/styles/_tokens.scss`
- `src/ui/styles/base/*.scss`
- `src/ui/styles/components/_menu.scss`, `_hud.scss`, `_game-over.scss`, `_victory.scss`
- `src/ui/styles/layout/*.scss`
- `src/ui/styles/main.scss`

## Acceptance criteria

- All four screens and the HUD read as one consistent visual system (shared color/spacing tokens, not ad-hoc per-component values).
- No unstyled/default-browser-button look remains on any interactive element.
- Overlay elements don't block mouse input to the canvas when they shouldn't (e.g. HUD text shouldn't intercept cursor-direction input during Playing).
