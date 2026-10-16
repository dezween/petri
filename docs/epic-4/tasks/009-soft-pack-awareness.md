# 009 — Soft Pack Awareness (No Inter-Bot Coordination)

## Goal

Two hunters converging on the same prey should tend to approach from different angles — an
emergent "flanking" look — without any new shared state, messaging, or coordination channel
between bots. This is explicitly NOT the pack-hunting idea marked Out of Scope in SPEC.md;
see that section for why this is in-scope and that isn't.

## Depends on / why it's next

Conceptually grouped with 007/008 (target-selection refinements) and ordered after them for
narrative flow, though it doesn't technically depend on their locked-target state — it only
needs other hunters' positions (and, from task 002, velocities), which are already ordinary
`PositionedMass` entries every bot already receives. No new dependency beyond 001 (evaluation
core) and 002 (velocity, for reading another hunter's heading).

## Detailed steps

- In `hunterMove`'s (or `evaluate.ts`'s hunter-specific path) target-selection/steering step:
  among `nearbyEntities`, identify other bots with `behavior === "hunter"` within this
  hunter's own `HUNTER_DETECTION_RADIUS` (reuse the existing radius, no new one needed).
  For each such other hunter, check whether it appears to be converging on the same candidate
  target this hunter is about to pick — e.g. the other hunter is closer to that candidate than
  this hunter is, or (using task 002's velocity data) the other hunter's velocity points
  toward that candidate.
- If such a hunter is found, bias this hunter's own steering vector away from the other
  hunter's approach by `PACK_ANGLE_BIAS_STRENGTH = 0.3` — rotate/blend the steering vector
  toward whichever side keeps more separation from the other hunter's heading (e.g. compute
  the perpendicular to the other hunter's velocity/approach-direction that increases distance
  between the two hunters' predicted paths, blend that in at the given strength).
- This changes the APPROACH ANGLE only — it must not change which target gets picked (that's
  007/008's job) or whether the chase happens at all; it's purely a steering-vector nudge on
  top of whatever target was already selected.
- Must degrade cleanly to zero effect when no other hunter is converging on the same target —
  existing single-hunter-chasing-single-prey tests should be unaffected.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts` / `hunter.ts`
- `src/world/domain/bot-ai/hunter.test.ts`

## Acceptance criteria

- A test proves two hunters converging on the same prey from similar starting angles end up
  with measurably different steering directions after the bias is applied (not identical
  beelines).
- A test proves a lone hunter with no other hunter nearby is completely unaffected (identical
  output to pre-task-009 behavior) — confirms the bias only activates when actually relevant.
- A test proves the bias doesn't change the selected target itself, only the approach vector —
  same target id chosen with or without another hunter present.
- All prior tasks' tests still pass.
