# 007 — Bot AI: Hunter Behavior

## Goal

Implement the aggressive hunter bot: actively chases the nearest entity (player or other bot) smaller than itself.

## Depends on / why it's next

Depends on 006 (follows the same wiring pattern into `world.service.ts` established there — reads cleanest as the second behavior after the simplest one).

## Detailed steps

- `src/world/domain/bot-ai/hunter.ts`: pure function `hunterMove(bot, nearbyEntities, deltaTime): Vector2`.
- Logic: find the nearest entity (player, bot, or food) within detection radius whose mass is less than the hunter's own mass; steer directly toward it. If nothing qualifies, fall back to wanderer-style random movement (reuse `wandererMove` from 006 rather than duplicating it).
- Wire into `world.service.ts`'s tick for `behavior === 'hunter'` bots.

## Files touched

- `src/world/domain/bot-ai/hunter.ts`
- `src/world/service/world.service.ts`

## Acceptance criteria

- A hunter bot with a smaller entity in range steers toward it over several ticks, closing the distance.
- A hunter bot never steers toward an entity equal or larger in mass.
- A hunter bot with nothing in range behaves like a wanderer (no frozen/stuck state).
