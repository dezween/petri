# 012 — README Update for Epic 4

## Goal

Document Epic 4's bot-intelligence improvements in the project README, matching the existing
Epic 1/2/3 sections' style.

## Depends on / why it's last

Needs 011 finished so the README describes what actually shipped (post-tuning), not the
pre-balance starting values.

## Detailed steps

- Add an "Epic 4 adds" paragraph to `README.md` (matching the existing Epic 2/Epic 3
  paragraphs' tone/length) summarizing: unified threat/opportunity evaluation, arena-relative
  detection radii, hunter patrol behavior, movement prediction, multi-threat-aware and
  panic-escalating fleeing, edge/dead-end awareness, target persistence with give-up, soft
  pack awareness, and food-vs-prey utility weighing.
- Link `docs/epic-4/SPEC.md`, matching the existing links to `docs/epic-1/SPEC.md`,
  `docs/epic-2/SPEC.md`, `docs/epic-3/SPEC.md`.

## Files touched

- `README.md`

## Acceptance criteria

- README's Epic 4 section accurately reflects what's actually in `main` at the time this task
  is done (cross-check against the real shipped behavior, not just this task list's intentions
  — if task 011's playtest dropped or significantly changed something from the original plan,
  the README should reflect what actually shipped).
- Link to `docs/epic-4/SPEC.md` is present and correct.
