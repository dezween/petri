# 003 — Movement Prediction / Target Interception

## Goal

Steer toward (or away from) where a target is *heading*, not just where it currently is —
makes chasing and fleeing meaningfully harder to trivially out-maneuver.

## Depends on / why it's next

Needs 002's velocity data to exist on `PositionedMass`. Needs 001's shared evaluation core as
the place this plugs into (the "toward opportunity" / "away from threat" vector computation in
`evaluate.ts` is what changes here).

## Detailed steps

- In `evaluate.ts` (from 001), when computing the direction toward a chosen opportunity or
  away from a chosen threat, use a predicted position instead of the target's current
  position: `predictedPosition = target.position + target.velocity * PREDICTION_LOOKAHEAD_SECONDS`
  (SPEC.md's starting value: `PREDICTION_LOOKAHEAD_SECONDS = 0.5`). If `target.velocity` is
  undefined (an entity type that hasn't been wired into 002's tracking, or any other
  degradation case), fall back to the target's current position — this must never throw or
  silently break on missing velocity data.
- For fleeing specifically: "lead the escape" means steering away from the *predicted* threat
  position, which for a threat moving toward the bot is more directly away-from-current than
  a naive reading suggests — double check the vector math actually produces an escape
  direction that increases separation over the next several ticks for a threat with nonzero
  closing velocity, not just a direction that happens to point away from a single instant.
- For hunting: steering toward the predicted prey position is a straightforward intercept —
  verify it actually closes distance faster (or at least not slower) than the old
  current-position steering against a prey moving in a straight line, as a sanity check.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts`
- `src/world/domain/bot-ai/evaluate.test.ts`

## Acceptance criteria

- A test proves a hunter chasing a prey moving in a straight line at constant velocity closes
  the gap in fewer ticks than the pre-prediction (current-position-only) steering would have,
  for some concrete scenario (simulate N ticks of both versions, compare final distance).
- A test proves a fleer being approached by a threat moving in a straight line increases
  separation faster than pre-prediction steering, for a concrete scenario.
- A test proves missing/undefined `velocity` on a target degrades gracefully to current-
  position steering (no crash, same result as before this task for that case).
- All prior tasks' tests still pass.
