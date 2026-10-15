# 009 — Bot Population Manager

## Goal

Manage bot count over time: initial spawn, respawn after a bot is eaten or despawned, and scaling count/aggressiveness as the player's mass grows.

## Depends on / why it's next

Depends on 006-008 (all three behaviors must exist so this manager has something to assign when spawning). Needed before 017 (game loop needs a populated world to start a session with).

## Detailed steps

- `src/world/service/bot-population.service.ts`: owns spawn/despawn decisions, called from `world.service.ts`'s tick (or on a slower interval than every frame — bot count doesn't need per-frame recalculation).
- Initial spawn: fixed starting count split roughly evenly across the three behaviors, placed at random valid (non-overlapping-with-player) positions.
- Respawn: when a bot is eaten (removed in task 005's eating resolution) or otherwise despawned, spawn a replacement elsewhere after a short delay.
- Scaling: as player mass crosses defined thresholds, increase total bot count and/or shift the wanderer/hunter/fleer ratio toward more hunters (exact numbers are a balancing task — 027 — leave the thresholds/ratios as named, easily-tunable constants here, not hardcoded inline).

## Files touched

- `src/world/service/bot-population.service.ts`
- `src/world/service/world.service.ts` (calls into the population service)

## Acceptance criteria

- Starting a session spawns the configured initial bot count with a mix of all three behaviors.
- Eating a bot results in a replacement appearing within the configured respawn delay.
- Crossing a mass threshold visibly increases bot count and/or hunter ratio without requiring a restart.
