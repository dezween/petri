# 010 — Food Spawning System

## Goal

Keep the arena populated with food at a steady density, respawning consumed food so the player always has an ambient mass source available (per the agreed design: food is the steady source, bots are the risk/reward source).

## Depends on / why it's next

Depends on 005 (needs `world.service.ts`'s state/tick to hook into) and conceptually pairs with 009, but is independent of bot behaviors — numbered after the bot tasks only to keep "entities that move" (006-009) grouped before "entities that don't" (010).

## Detailed steps

- `src/world/service/food-spawner.service.ts`: maintains food count at a target density across the arena.
- Initial spawn: scatter the target count of food at random positions at session start.
- Respawn: when food is eaten (removed in task 005's eating resolution), spawn a replacement at a random position elsewhere after a short delay — avoid spawning on top of the player or a bot.
- Expose target density as a named constant (tunable in 027).

## Files touched

- `src/world/service/food-spawner.service.ts`
- `src/world/service/world.service.ts` (calls into the food spawner)

## Acceptance criteria

- Session start populates the arena with the configured food count.
- Eating food results in a replacement appearing elsewhere within the configured respawn delay.
- Food density stays roughly constant over an extended play session (doesn't trend to zero or runaway-accumulate).
