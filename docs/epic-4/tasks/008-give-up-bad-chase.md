# 008 — Give Up on a Bad Chase

## Goal

A hunter shouldn't commit forever to a target it's failing to catch — counterpart to task 007's
commitment floor. If a long-held chase isn't making progress, abandon it early and look for an
easier target instead of elusive-chasing in place.

## Depends on / why it's next

Directly extends task 007's locked-target state — reuses `lockedTargetId`/`targetLockedUntil`
plus new progress-tracking fields on the same state, rather than inventing a parallel
mechanism.

## Detailed steps

- Extend the per-bot locked-target state from 007 with: the distance to the target at the
  moment the lock was acquired (`lockDistanceAtStart?: number`) and the time the lock was
  acquired (`lockAcquiredAt?: number` — distinct from `targetLockedUntil`, which is the
  commitment-floor expiry, not the acquisition time).
- Each tick a lock is held, check: has `currentTime - lockAcquiredAt` exceeded
  `CHASE_GIVEUP_SECONDS = 4.0`? If so, compare the current distance to the target against
  `lockDistanceAtStart`. If the distance hasn't decreased by at least
  `CHASE_GIVEUP_MIN_PROGRESS = 0.2` (20%) of `lockDistanceAtStart`, clear the lock immediately
  — this bypasses task 007's `targetLockedUntil` commitment floor entirely by design (that
  floor exists to prevent flip-flopping between good options; this check exists specifically
  to escape a chase that isn't working, so it must not be blocked by the floor it would
  otherwise still be inside).
- A target that IS closing (≥20% progress) keeps its lock exactly as task 007 already governs
  — this task only adds the give-up path, it doesn't change the keep-the-lock path at all.
- This only makes sense for hunting (closing distance on prey) — fleeing's "progress" would be
  the opposite (distance increasing is success, not failure), and SPEC.md scopes this
  explicitly as a hunter mechanic; don't apply give-up logic to a fleer's lock.

## Files touched

- `src/world/domain/bot.entity.ts` (new fields on the locked-target state)
- `src/world/domain/bot-ai/evaluate.ts` / `hunter.ts` (give-up check, hunter-only)
- Relevant `*.test.ts`

## Acceptance criteria

- A test proves a hunter chasing a target that hasn't closed distance by 20% after
  `CHASE_GIVEUP_SECONDS` clears its lock and is free to re-select a different target next tick.
- A test proves a hunter chasing a target that HAS closed distance by ≥20% keeps its lock past
  `CHASE_GIVEUP_SECONDS` (the give-up check doesn't fire for a chase that's actually working).
- A test proves give-up correctly bypasses task 007's commitment floor — i.e. a lock can clear
  via give-up even while `targetLockedUntil` hasn't passed yet.
- A test proves this logic doesn't apply to fleer locks (a fleer's lock duration/behavior is
  governed by task 007 alone, unaffected by give-up).
- All prior tasks' tests still pass.
