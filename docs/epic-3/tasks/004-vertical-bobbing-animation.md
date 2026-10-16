# 004 — Vertical Bobbing Animation

## Goal

Give the player, bots, and food a small, continuous, per-entity-phase-offset vertical bob —
reads as buoyancy/volume rather than flat sprites locked to one Y plane. Static arena geometry
(floor/rim/bench/props) does NOT bob — only things that are meant to read as floating/living.

## Depends on / why it's next

Independent of 001-003 (camera tilt and shadows don't interact with this). Grouped here because
it's the next-highest-impact, still-contained change per SPEC.md's prioritization.

## Detailed steps

- `src/render/adapter/three/cell-mesh-factory.ts`: `updatePlayer`/`updateFood`/`updateBots`
  currently hardcode `y = 0` (player: `this.playerMesh.position.set(x, 0, z)`; food/bots: the
  `composeAt` helper's `Vector3(x, 0, z)`). Replace the hardcoded `0` with
  `amplitude * sin(frequency * elapsedTime + phaseOffset)`.
- `elapsedTime` needs to come from somewhere — `ThreeRenderer.render(snapshot, deltaTime)`
  already receives `deltaTime` every frame (added for Epic 2's particle system, see
  `ParticleSystem.update(deltaTime)` for the established pattern of accumulating a running clock
  from per-frame deltaTime rather than adding a second independent timer). Thread `deltaTime`
  into `CellMeshFactory.updateFromSnapshot` (or accumulate it in `ThreeRenderer` and pass the
  running total down) — follow whichever of those two shapes is more consistent with how
  `ParticleSystem` already does it, don't invent a third pattern.
- Per-entity phase offset: derive a stable value by hashing the food/bot's `id` string (e.g.
  `food-${n}` / `bot-${n}` per `food-spawner.service.ts`/`bot-population.service.ts`) — this is
  the one approach actually grounded in existing domain data. (A "use its spawn position"
  alternative was considered and dropped: `Cell`/`Food`'s `position` field is mutated every tick
  as the entity moves, there's no tracked spawn-time position anywhere in the domain layer, so
  that would require adding new state-tracking this task doesn't scope — the `id`-hash is
  already fully supported by existing data and simpler.) Must be stable across frames for the
  same entity (don't re-roll it every frame, that would look like jitter, not a bob) and
  different enough between entities that they visibly don't all bob in unison. The player, being
  singular, doesn't need phase variation — only food/bots (multiple same-type entities bobbing
  in lockstep is the specific thing this requirement avoids).
- Starting constants (SPEC.md's Design Decision 4): amplitude 2-4 world units, frequency
  ~0.5-1 Hz. Name them clearly for task 006's balance pass to tune.
- Static arena/bench/props (`scene.ts`, `static-props.ts`) are explicitly excluded — don't touch
  their Y positions.

## Files touched

- `src/render/adapter/three/cell-mesh-factory.ts`
- `src/render/adapter/three/three-renderer.ts` (if elapsed-time accumulation lives here rather
  than inside `CellMeshFactory`)
- Corresponding `*.test.ts` files — verify the bob math itself (pure function, testable without
  WebGL: given a time and phase, does it produce the expected Y offset within the expected
  amplitude range?) and that different entities get different phases.

## Acceptance criteria

- Player, bots, and food all have a continuous small Y-offset that varies smoothly over time,
  not a fixed `0`.
- Static scene geometry (floor/rim/bench/props) is unaffected — still flat at `y = 0`
  (floor/rim) or their own fixed placement (props).
- Entities of the same type don't visibly bob in perfect unison (phase offset verified either
  by test or by eye in a real browser — ideally both).
- `npx vitest run` passes.
- Manually verified in a real browser: the bob reads as a gentle float, not a jarring or overly
  fast bounce.
