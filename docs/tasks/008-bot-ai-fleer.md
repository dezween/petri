# 008 — Bot AI: Fleer Behavior

## Goal

Implement the skittish fleer bot: runs away from anything bigger than itself, tends toward arena edges.

## Depends on / why it's next

Depends on 007 (completes the three-behavior set using the same per-behavior wiring pattern; needs `world.service.ts`'s tick hook already extended twice before this).

## Detailed steps

- `src/world/domain/bot-ai/fleer.ts`: pure function `fleerMove(bot, nearbyEntities, deltaTime): Vector2`.
- Logic: find the nearest entity within detection radius whose mass is greater than the fleer's own mass; steer directly away from it. If nothing threatening is in range, fall back to wanderer-style random movement (reuse `wandererMove` from 006).
- "Tends toward arena edges" per `docs/SPEC.md`: when fleeing, bias the away-vector slightly toward the nearest arena boundary rather than a pure straight-line retreat (keeps it readable as a distinct silhouette/behavior on screen, not just "hunter in reverse").
- Wire into `world.service.ts`'s tick for `behavior === 'fleer'` bots.

## Files touched

- `src/world/domain/bot-ai/fleer.ts`
- `src/world/service/world.service.ts`

## Acceptance criteria

- A fleer bot with a bigger entity in range moves away from it over several ticks, increasing the distance.
- A fleer bot never moves toward an entity larger than itself.
- A fleer bot with nothing threatening in range behaves like a wanderer.
