# 017 — Update README for Epic 2

## Goal

Bring the root `README.md` up to date once Epic 2 is actually shipped: mention the new
features and point at `docs/epic-2/SPEC.md`.

## Depends on / why it's next

Depends on everything else (001-016) — describes what actually shipped, written last so it
doesn't describe aspirational features that changed during implementation.

## Detailed steps

- Add a short mention of Epic 2's shipped features (arena size selection, audio + settings,
  background scenery, visual polish) to the README, in the same understated style as the
  existing sections — not a marketing pitch, just what's there and how to use it (e.g. "three
  arena sizes, selectable from the Main Menu").
- Update the Architecture section to mention the new `src/audio/` module alongside the existing
  `world`/`render`/`input`/`ui`/`session` list.
- Confirm the `docs/epic-1/SPEC.md` / `docs/epic-2/SPEC.md` links (already corrected when the
  epic-1 reorg landed) are still accurate.
- If `make blender-models` now regenerates 8 models instead of 5, make sure that's still
  accurately described (the README's current wording says "five game models" — update the
  count).

## Files touched

- `README.md`

## Acceptance criteria

- README accurately reflects the shipped Epic 2 feature set and current model count, with no
  stale references to pre-Epic-2 state.
