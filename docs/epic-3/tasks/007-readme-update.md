# 007 — README Update for Epic 3

## Goal

Document Epic 3's shipped visual changes in the root `README.md`, pointing at
`docs/epic-3/SPEC.md` for the full design rationale — same pattern Epic 2's task 017 used.

## Depends on / why it's next

Depends on 006 (nothing to accurately document until the balance pass has settled the final
parameters).

## Detailed steps

- Add a short section (or extend the existing feature summary) describing: the tilted camera
  view, shadows, the gentle bobbing animation, and the glassy player-membrane look.
- Link `docs/epic-3/SPEC.md` the same way the README already links `docs/epic-1/SPEC.md` and
  `docs/epic-2/SPEC.md`.
- Don't restate implementation details already covered in SPEC.md — keep this to what a player
  or new contributor skimming the README would want to know, same tone as the existing Epic 2
  summary in README.md.

## Files touched

- `README.md`

## Acceptance criteria

- README accurately reflects what actually shipped (cross-check against the real final state of
  tasks 001-006, not the original SPEC.md proposal, in case anything was retuned or changed
  during implementation).
- Link to `docs/epic-3/SPEC.md` present and correct.
