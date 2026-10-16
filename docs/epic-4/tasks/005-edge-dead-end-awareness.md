# 005 — Dead-End / Edge Awareness While Fleeing

## Goal

Stop fleeing bots from running themselves into a corner against the arena rim with a threat
behind them and nowhere left to go — the existing `EDGE_BIAS` (always biasing the flee vector
toward the nearest edge) actively causes this near the boundary.

## Depends on / why it's next

Builds on 001 (shared core) and 004 (multi-threat away-vector) — this task changes how the
existing edge-bias blend combines with whatever away-vector 004 just produced.

## Detailed steps

- `fleerMove` already receives `arenaRadius` as of task 001 (threaded through for the
  arena-relative detection-radius work — see task 001's Design Decision 1a); this task is the
  first to actually *use* that parameter for something beyond detection-radius math, not the
  first to add it. No new plumbing needed here.
- Compute `distanceFromCenterRatio = distance(bot.position, origin) / arenaRadius` (0 at
  center, 1 at the rim). Fade `EDGE_BIAS` linearly from its current value (0.35) at
  `distanceFromCenterRatio <= 0.7` down to 0 at `distanceFromCenterRatio >= 1.0` (SPEC.md's
  Design Decision 4's starting thresholds — tune in 011 if they feel wrong).
- When near the rim (faded bias approaching 0), blend in a tangential component instead — a
  vector perpendicular to the radial direction (rotate the radially-outward unit vector 90°),
  picking whichever of the two perpendicular directions (clockwise/counterclockwise) better
  aligns with the away-from-threat vector already computed, so a trapped bot runs *along* the
  rim toward safety rather than stalling with a zero/near-zero net vector at the boundary.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts`
- `src/world/domain/bot-ai/fleer.ts`
- `src/world/domain/bot-ai/fleer.test.ts`

## Acceptance criteria

- A test proves a fleer near the arena center (small `distanceFromCenterRatio`) still gets the
  old ~0.35 edge bias (no regression for the common case away from the rim).
- A test proves a fleer very close to the rim (`distanceFromCenterRatio` near 1) gets near-zero
  radially-outward bias and a nonzero tangential component instead.
- A test proves a fleer trapped near the rim with a threat directly between itself and the
  center still produces a *nonzero, non-degenerate* steering vector (not a zero vector / stall)
  — this is the actual "don't get cornered and freeze" guarantee this task exists for.
- All prior tasks' tests still pass.
