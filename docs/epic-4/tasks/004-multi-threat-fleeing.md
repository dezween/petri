# 004 — Multi-Threat-Aware Fleeing

## Goal

A fleer surrounded by two or more threats should weigh all of them, not just blindly react to
whichever happens to be nearest while a second threat closes in from another angle.

## Depends on / why it's next

Builds on 001's shared evaluation core (the "away from threat" term is what changes from
single-nearest to a weighted sum). Independent of 002/003 (prediction) in principle, but
ordered after them since it's a smaller, more contained follow-up refinement to the same
threat-handling code path 003 just touched.

## Detailed steps

- In `evaluate.ts`'s threat-handling path (fleer-weighted calls specifically — SPEC.md's
  Design Decision 3 scopes this to fleeing, not hunting/opportunity-seeking), replace the
  single-nearest-threat lookup with: for every threat within `FLEER_DETECTION_RADIUS`, compute
  an away-vector weighted by `1 / distance²` (closer threats dominate much more strongly than
  farther ones), sum them, normalize the result.
- Must degrade to the existing single-nearest-threat behavior when only one threat is present
  (the existing `fleer.test.ts` tests asserting that case should keep passing without
  modification — if they need to change, that's a signal something's wrong with the
  degradation, not an expected outcome).
- Use predicted positions (from 003) for each threat in the weighted sum, not raw current
  positions — the two tasks should compose, not conflict.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts`
- `src/world/domain/bot-ai/fleer.test.ts`

## Acceptance criteria

- A test proves a fleer with two threats on opposite sides moves in a direction that increases
  distance from *both*, not just one (e.g. roughly perpendicular to the line between them, not
  directly away from only the nearer one).
- A test proves the single-threat case produces the same result as the old nearest-threat-only
  logic (within floating-point tolerance) — confirms no regression for the common case.
- A test proves a much closer, much weaker-weighted-by-distance threat still dominates the
  result over a farther, equally-sized threat (the inverse-square weighting is actually having
  an effect, not just summing unweighted).
- All prior tasks' tests still pass.
