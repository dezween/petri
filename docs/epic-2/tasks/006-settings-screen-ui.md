# 006 — Settings Screen UI + localStorage Persistence

## Goal

A Settings screen with volume controls (and/or mute toggles) for SFX and music independently,
with the chosen values persisted across page reloads via `localStorage`.

## Depends on / why it's next

Depends on 003 (controls something real) and benefits from 004/005 existing (so there's
something audible to test the controls against), though it could technically be built against
003 alone with 004/005 landing in either order. Sequenced after both here for a meaningful
manual-test loop.

## Detailed steps

- UI: two volume sliders (or mute toggles, or both) — SFX and music — on a new screen.
- Persist to `localStorage` under a clearly namespaced key (e.g. `petri:audio-settings`) as a
  small JSON blob. This is the *only* persistence in Epic 2 — do not add any score/leaderboard
  storage alongside it, and do not reuse this key or mechanism for anything beyond audio
  preferences.
- On app load, read persisted settings (if present) and apply them to `IAudioPlayer` before any
  sound plays, so the user's last choice is respected from the first frame, not just after they
  revisit Settings.
- Handle the "no saved settings yet" case (first-ever visit) with sensible defaults (e.g. both
  unmuted, moderate volume) — don't require `localStorage` to have data to function.

## Files touched

- `index.html` (new settings screen markup)
- `src/ui/adapter/dom/settings.adapter.ts`
- `src/ui/port/` (extend `hud.port.ts` or add a dedicated settings port — match whatever
  Epic 1's `IHud`/screen-port pattern already established, read it first rather than guessing)

## Acceptance criteria

- Changing a slider/toggle immediately affects live audio (if music/SFX is currently playing)
  and is saved to `localStorage`.
- Reloading the page restores the last-saved settings and applies them before Playing starts.
- A completely fresh browser profile (no `localStorage` entry) doesn't throw and falls back to
  sensible defaults.
