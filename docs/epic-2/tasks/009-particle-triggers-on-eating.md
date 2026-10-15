# 009 — Wire Particle Triggers to Eating Events

## Goal

Every time the player eats something (food or a bot), spawn a particle burst at the eaten
entity's position.

## Depends on / why it's next

Depends on 008 (the burst effect must exist) and needs the same finer-grained "entity eaten"
hook task 004 may have already introduced. **If task 004 already added this hook, reuse it
exactly — do not build a second, competing eat-event mechanism.** Check `src/world/service/
world.service.ts`'s `tick()`/`TickResult` shape and `src/session/game-loop.service.ts`'s
callbacks first; Epic 1's `TickResult` may already surface which entities were eaten this tick
(check before assuming it needs to be added from scratch).

**Already checked (code review, pre-Epic-2):** the answer is no — `TickResult` is currently
exactly `{ playerEaten: boolean; victoryReached: boolean }`, no per-entity data at all.
`resolveCollisions()` *does* compute `eatenBotIds`/`eatenFoodIds`/`eatenBotIds2` locally each
tick, but only to drive the `.filter()` calls that remove eaten entities from the live arrays —
none of that (which entity, its position, its type/color) is retained or exposed anywhere.
Building this hook is a real, non-trivial change to `tick()`/`TickResult`'s shape — capturing
id + position + (bot behavior or food, for burst-color choice) for every entity eaten that
tick, across all four collision sub-loops (player-vs-bot, player-vs-food, bot-vs-bot,
bot-vs-food) — not a small wiring change on top of an existing hook. Whichever of 004/009 lands
first should budget for that, not assume there's a shortcut already in place.

## Detailed steps

- Identify (or add, if task 004 didn't already) the point where `WorldService.tick()` knows
  which entities were just eaten and at what position.
- Wire that into `ThreeRenderer`/`particles.ts`'s burst method from task 008, called once per
  eaten entity per tick (not once per frame regardless of events — a burst should correspond
  1:1 with an eat, never fire spuriously).
- Pick a burst color per entity type eaten (e.g. match the eaten bot's own color, or the food
  particle's color) so it reads as "that thing specifically got eaten," not a generic flash.

## Files touched

- `src/world/service/world.service.ts` (only if the eaten-entities-this-tick data isn't already
  exposed — check first)
- `src/render/adapter/three/three-renderer.ts`

## Acceptance criteria

- Eating N entities in one tick produces exactly N bursts, not fewer (missed) or more
  (duplicated) — unit-testable by asserting the burst method's call count against a controlled
  `WorldService` tick that's set up to eat a known number of entities.
- No bursts fire when nothing was eaten in a tick.
