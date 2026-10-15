# 027 — Manual Playtest & Balance Pass

## Goal

Tune every numeric constant left deliberately loose in earlier tasks, by actually playing the finished game: food density, bot counts/speeds/aggressiveness curve, player growth rate, victory-cap size, camera zoom-out curve.

## Depends on / why it's next

Depends on 026 (the full game must be playable end-to-end first). This task touches no new structure — only constant values across files already built in 004, 005, 006-009, 010, 012.

## Detailed steps

- Play repeatedly, adjust, re-play:
  - `src/world/domain/rules.ts` (004): growth formula, victory-cap fraction.
  - `src/world/service/world.service.ts` (005): player base movement speed and its falloff with mass.
  - `src/world/domain/bot-ai/*.ts` (006-008): detection radii, bot movement speed.
  - `src/world/service/bot-population.service.ts` (009): initial bot count, mass thresholds, hunter-ratio scaling.
  - `src/world/service/food-spawner.service.ts` (010): target food density, respawn delay.
  - `src/render/adapter/three/camera.ts` (012): zoom-out curve as player mass grows.
- Target feel: early game has some tension (hunters are a real threat relative to a small player) without being unfair (a new player shouldn't die within a few seconds of starting); late game should feel earned, with the victory cap reachable in a reasonable session length, not either trivially fast or impractically grindy.
- Record final tuned values directly in their source files (no separate "config doc" — the constants are the documentation of the chosen balance).

## Files touched

- Constants only, across the files listed above — no structural changes.

## Acceptance criteria

- A full playthrough from MainMenu to either GameOver or Victory feels intentional, not arbitrary (deaths feel like they came from a visible threat, not an instant off-screen snipe; victory feels like an accomplishment, not a formality).
- No constant is left at an obviously-placeholder value (e.g. round numbers picked with no testing) by the end of this task.
