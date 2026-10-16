# 007 — Target Persistence / Hysteresis

## Goal

Stop bots from flip-flopping between near-tied targets frame to frame — once a bot commits to
a target, it should keep chasing/fleeing it for a short window unless something meaningfully
better appears, reading as deliberate rather than erratic.

## Depends on / why it's next

Builds on 001 (shared evaluation core, where target selection happens) and 006 (the richer
per-tick bot-ai return shape this task's own state additions should stay consistent with).
Independent of 002-005's specific mechanics but ordered after all of them since it changes
*how a target gets chosen and kept*, which should be stable before later tasks (008, 009) that
build directly on this task's new persistent state.

## Detailed steps

- `src/world/domain/bot.entity.ts`: `Bot` gains new persistent per-bot AI state — a locked
  target id and a lock-expiry time (e.g. `lockedTargetId?: string`, `targetLockedUntil?:
  number`, using whatever time representation `world.service.ts` already tracks — check
  whether it has an accumulated elapsed-time clock already, likely from task 006's or an
  earlier task's needs, rather than introducing a second one). This is the first
  behavior-specific state `Bot` has ever carried (its own doc comment currently states the
  opposite — update that comment, don't leave it contradicting reality).
- In `evaluate.ts`'s target-selection step: if the bot has a `lockedTargetId` that's still
  present among `nearbyEntities` AND still a valid target (threat still bigger / opportunity
  still smaller, per whichever selection is in play) AND `targetLockedUntil` hasn't passed,
  keep steering at that locked target instead of re-selecting from scratch — UNLESS a
  candidate beats the locked target's score by more than `COMMITMENT_OVERRIDE_MARGIN = 1.3`
  (30% better by distance and/or value, whichever scoring metric selection already uses),
  in which case switch immediately regardless of the remaining lock duration.
- A locked target that's no longer present in `nearbyEntities` at all (eaten, left detection
  range) clears the lock immediately on detection, regardless of `targetLockedUntil` —
  commitment is about not flip-flopping between *live* candidates, never about persisting a
  lock onto something that's already gone.
- New lock acquisition sets `targetLockedUntil = currentTime + TARGET_COMMITMENT_SECONDS`
  (1.5, per SPEC.md).

## Files touched

- `src/world/domain/bot.entity.ts` (new persistent fields + corrected doc comment)
- `src/world/domain/bot-ai/evaluate.ts` (lock-check/lock-acquire logic)
- `src/world/service/world.service.ts` (if it owns the elapsed-time clock this task reads)
- `src/world/domain/bot-ai/evaluate.test.ts`, `bot.entity.test.ts` if one exists or should

## Acceptance criteria

- A test proves a bot with two near-tied candidates keeps its originally-locked target across
  several ticks rather than switching every tick (the flip-flopping this task exists to fix).
- A test proves a bot DOES switch targets immediately when a new candidate beats the locked
  one by more than `COMMITMENT_OVERRIDE_MARGIN`, even mid-lock.
- A test proves a locked target that disappears (not in `nearbyEntities` anymore) clears the
  lock immediately, even if `targetLockedUntil` hasn't passed yet.
- A test proves a lock naturally expires and allows re-selection once `targetLockedUntil`
  passes with no override-margin candidate having appeared.
- All prior tasks' tests still pass.
