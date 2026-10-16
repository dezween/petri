# 002 — Velocity Tracking Infrastructure

## Goal

Add per-entity velocity tracking to `WorldService` so bot AI can know not just where
something is, but where it's *heading* — the data task 003 (prediction) needs, and that
`PositionedMass` has never carried before.

## Depends on / why it's next

Independent of 001's internal refactor (velocity is a data-plumbing concern, not a steering-
logic one), but must land before 003 (prediction), which consumes it. Placed here, right after
001, so 003 can follow immediately.

## Detailed steps

- `src/world/domain/bot-ai/types.ts`: add `velocity?: Vector2` to `PositionedMass` (optional —
  any consumer not yet updated, or any entity without tracked history yet, degrades gracefully
  to the old current-position-only behavior, per SPEC.md's Design Decision 2).
- `src/world/service/world.service.ts`: track each entity's position from the *previous* tick
  (player, every bot, every food item — food's velocity will always compute to `{0,0}` since
  it doesn't move, which is fine, it's the same field for interface uniformity per SPEC.md).
  Derive `velocity = (currentPosition - previousPosition) / deltaTime` once per tick, guard
  against `deltaTime === 0` (the first-ever tick has no prior timestamp — see
  `game-loop.service.ts`'s existing `deltaTime === 0` first-frame convention — don't divide by
  zero, just report `{0,0}` velocity for that tick). Populate this into the `PositionedMass`-
  shaped objects `othersFor(bot)` and the `this.food` array already build each tick.
- Food/bot entities that are removed (eaten) or newly spawned mid-game have no "previous tick"
  position yet — a freshly spawned entity's velocity for its first tick should be `{0,0}`, not
  a divide-by-zero or a garbage value from reusing a stale map entry from a different entity
  that happened to reuse the same id slot (ids are unique per spawn — verify this is actually
  true by checking `bot-population.service.ts`/`food-spawner.service.ts`'s id-generation, don't
  assume).
- Decide the storage mechanism yourself (a `Map<string, Vector2>` of last-tick positions keyed
  by entity id, cleared of stale entries for despawned entities so it doesn't grow unbounded
  over a long session, is the obvious approach — but your call on the exact shape).

## Files touched

- `src/world/domain/bot-ai/types.ts`
- `src/world/service/world.service.ts`
- `src/world/service/world.service.test.ts`

## Acceptance criteria

- A test proves an entity moving at a known constant velocity across two ticks produces a
  `PositionedMass.velocity` matching that known velocity (within floating-point tolerance).
- A test proves a freshly spawned entity (no prior-tick history) reports `{0,0}` velocity on
  its first tick, not a crash or a garbage value.
- A test proves the first-ever world tick (`deltaTime === 0`) doesn't divide by zero anywhere.
- A test proves the stale-entity map doesn't grow unbounded — spawn and despawn many entities
  across many ticks, confirm the tracked-position map's size stays bounded by the current
  live-entity count, not the cumulative count of everything that has ever existed.
- All 001's tests (and everything before it) still pass unmodified.
