# 010 — Food-vs-Prey Utility Weighing

## Goal

Replace the hunter's hard "prey first, food only as fallback" priority with a basic utility
comparison, so a hunter doesn't always detour for a distant, marginal prey when solid food is
right next to it (or vice versa).

## Depends on / why it's next

Lower priority bonus per SPEC.md — builds on 001's evaluation core and composes with 007/008's
target-locking (a utility-selected target still gets locked/given-up-on the same way any other
target does) without needing anything from 002-006/009 specifically.

## Detailed steps

- In the hunter's opportunity-selection step: instead of "pick nearest prey, or nearest food
  only if no prey qualifies", compute `value = candidateMass / (1 + distance /
  UTILITY_DISTANCE_SCALE)` (SPEC.md: `UTILITY_DISTANCE_SCALE = 50`) for the best available
  prey candidate AND the best available food candidate within detection range, and pick
  whichever scores higher. Both food and prey already share the `PositionedMass` shape
  (`mass`/`position`), so the same formula applies to either without special-casing.
- This replaces the opportunity-selection step specifically for `hunter` — wanderer's
  food-only behavior and fleer's threat-dominated behavior are unaffected (this is purely
  about how a hunter chooses *what kind* of opportunity to pursue when both are available).

## Files touched

- `src/world/domain/bot-ai/evaluate.ts` / `hunter.ts`
- `src/world/domain/bot-ai/hunter.test.ts`

## Acceptance criteria

- A test proves a hunter prefers a close, substantial food pellet over a far, barely-qualifying
  prey when the utility math favors food.
- A test proves a hunter still prefers a close, substantial prey over far food when the math
  favors prey (confirms this isn't accidentally food-only now).
- A test proves the old "prey always wins if present" behavior is gone — construct a case where
  the old priority and the new utility comparison would disagree, and assert the new (utility)
  outcome.
- All prior tasks' tests still pass.
