# 006 — Panic / Urgency Escalation When a Threat Is Imminent

## Goal

Make fleeing feel urgent, not flat — a bot with a threat genuinely closing in should visibly
speed up and prioritize raw escape over "running nicely along the rim."

## Depends on / why it's next

Builds on 004 (multi-threat away-vector) and 005 (edge-bias fade/tangential blend) — this task
changes how those compose when a threat crosses into a tighter "imminent danger" sub-radius,
and changes the bot-ai return contract (direction + speed multiplier) that later tasks should
build on, not diverge from.

## Detailed steps

- Compute `IMMINENT_DANGER_RADIUS = IMMINENT_DANGER_RADIUS_FRACTION * arenaRadius` where
  `IMMINENT_DANGER_RADIUS_FRACTION = 0.4 * FLEER_DETECTION_RADIUS_FRACTION` (per SPEC.md
  Design Decision 4a — derived from the fleer detection fraction task 001 already established,
  not an independent magic number).
- Change `bot-ai` functions' return type from a bare `Vector2` to `{ direction: Vector2,
  speedMultiplier: number }` (default `speedMultiplier: 1` for hunter/wanderer and any
  non-panicking fleer). Update every call site: `evaluate.ts`'s internals, and
  `world.service.ts`'s `computeBotDirection`/`moveBots`/`applyMovement` — `applyMovement`
  currently takes a `baseSpeed` and derives actual speed from mass; thread the returned
  multiplier through so a panicking fleer's actual per-tick speed is
  `normalSpeedForMass * speedMultiplier`.
- When the nearest threat (or, after 004, the nearest contributor to the weighted multi-threat
  sum) is within `IMMINENT_DANGER_RADIUS`: set `speedMultiplier = PANIC_SPEED_MULTIPLIER =
  1.5`, and scale down whatever edge-bias/tangential contribution task 005 would otherwise add
  by a proximity factor (e.g. `1 - (imminentThreatDistance / IMMINENT_DANGER_RADIUS)`, so a
  threat right on top of the bot drives the edge/tangential contribution to ~0 and a threat
  just inside the imminent-danger boundary only lightly dampens it) — raw away-from-threat
  urgency fills in whatever weight the edge/tangential terms give up, so the output vector
  stays normalized/sane, not just "add urgency on top and renormalize blindly."
- Outside `IMMINENT_DANGER_RADIUS`, behavior is exactly task 004/005's existing output,
  unchanged — this task only kicks in inside the tighter sub-radius.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts`, `fleer.ts`, `hunter.ts`, `wanderer.ts` (return-type
  change propagates to all three, even though only fleer ever returns `speedMultiplier !== 1`)
- `src/world/domain/bot-ai/types.ts` (if a shared result type is introduced here)
- `src/world/service/world.service.ts` (`moveBots`/`applyMovement` consume the multiplier)
- `src/world/domain/bot-ai/fleer.test.ts`, `src/world/service/world.service.test.ts`

## Acceptance criteria

- A test proves a fleer with a threat inside `IMMINENT_DANGER_RADIUS` returns
  `speedMultiplier === PANIC_SPEED_MULTIPLIER` (1.5); a test proves a fleer with a threat
  only in the wider (but not imminent) detection range returns `speedMultiplier === 1`.
- A test proves the actual per-tick displacement of a panicking fleer (via `applyMovement` or
  equivalent) is measurably greater than a non-panicking fleer of the same mass over the same
  deltaTime — confirms the multiplier actually reaches real movement, not just the returned
  struct.
- A test proves a fleer trapped near the rim WITH an imminent threat produces a steering vector
  dominated by raw away-from-threat direction, not the edge/tangential blend task 005 would
  otherwise apply at that position — i.e. the override is actually live, not just computed and
  discarded.
- A test proves hunter/wanderer always return `speedMultiplier === 1` regardless of
  circumstances (panic is fleer-only, per SPEC.md).
- All prior tasks' tests still pass (updated for the new return shape where mechanically
  necessary, not for new expected behavior).
