# 005 — World Service: Tick Loop

## Goal

Build the orchestration layer that owns the live game state (player, bots, food) and advances it one frame at a time by applying the pure rules from 004.

## Depends on / why it's next

Depends on 003 (entities) and 004 (rules). This is the first task that assembles them into a stateful service. Bot AI (006-008) and food spawning (010) both plug into this service's tick, so it must exist first — but this task only needs movement/collision wiring, not actual AI behavior yet (stub bot movement as "do nothing" or a trivial straight-line placeholder is fine here).

## Detailed steps

- `world.service.ts`: holds the authoritative game state — `player: Player`, `bots: Bot[]`, `food: Food[]`, arena dimensions.
- `tick(deltaTime, playerInputDirection)`:
  1. Move the player toward `playerInputDirection` (speed should decrease slightly as mass grows — simple inverse relationship, tune later in 027).
  2. Move each bot (placeholder movement for now — real behaviors land in 006-008).
  3. Clamp all positions to arena bounds (hard walls — full wall behavior is task 024, but basic clamping belongs here so nothing escapes the arena even before 024 lands).
  4. Check all pairwise overlaps (player-vs-bot, player-vs-food, bot-vs-bot, bot-vs-food) and resolve eating via `resolveEating`/`growMass` from 004.
  5. Remove eaten entities from state.
  6. Apply `clampRadiusToCap` to the player; expose whether the player just hit the cap (for task 022's Victory trigger) and whether the player was just eaten (for task 021's Game Over trigger).
- Expose a read-only snapshot method (`getSnapshot()`) returning plain data — this is what task 015 (render sync) and task 020 (HUD) will consume, so render/UI never touch live mutable state directly.

## Files touched

- `src/world/service/world.service.ts`

## Acceptance criteria

- Calling `tick()` repeatedly with no bots/food and a fixed input direction moves the player smoothly and keeps it within arena bounds.
- A manually-constructed overlap between two cells results in the correct one being removed from state after `tick()`.
- `getSnapshot()` returns immutable/plain data, not live references into internal state.
