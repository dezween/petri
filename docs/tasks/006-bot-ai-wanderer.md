# 006 — Bot AI: Wanderer Behavior

## Goal

Implement the passive wanderer bot: moves around loosely, eats nearby food, ignores the player and other bots entirely.

## Depends on / why it's next

Depends on 005 (needs the world service's state shape and tick hook to plug movement logic into). Independent of 007/008 (different behavior branches) but numbered first since it's the simplest — establishes the pattern the other two follow.

## Detailed steps

- `src/world/domain/bot-ai/wanderer.ts`: pure function `wandererMove(bot, nearbyFood, deltaTime): Vector2` (returns a movement direction/delta, doesn't mutate).
- Movement pattern: gentle random-walk (e.g. periodically pick a new random direction, or steer toward the nearest food within a detection radius if any is in range — simplest version: ignore the player/bots, no fleeing or chasing logic at all).
- Wire into `world.service.ts`'s tick: bots with `behavior === 'wanderer'` call this function instead of the placeholder movement from 005.

## Files touched

- `src/world/domain/bot-ai/wanderer.ts`
- `src/world/service/world.service.ts` (replace wanderer placeholder with real call)

## Acceptance criteria

- A wanderer bot with no food nearby still moves (doesn't sit frozen).
- A wanderer bot with food within its detection radius trends toward it over several ticks.
- A wanderer bot never changes direction in response to the player's or another bot's position.
