# 003 — Core Domain Entities

## Goal

Define the pure-TypeScript domain entities and shared math/geometry helpers that every later `world` task builds on. No Three.js, no DOM, no dependency on anything outside `src/world/domain/`.

## Depends on / why it's next

Depends on 001 (needs `src/world/domain/` to exist). Nothing in 002 (Blender) affects this — pure logic task, can run in parallel with 002 but strictly before 004.

## Detailed steps

- Define a `Vector2` (or reuse a minimal `{x: number, z: number}` shape) for position/velocity on the flat arena plane — no Three.js `Vector3` import here, keep domain free of rendering types.
- `cell.entity.ts`: shared base shape for anything that has mass and occupies space — `{ id, position, radius, mass }` plus a pure function `massToRadius(mass: number): number` (and its inverse) so radius is always derived from mass, never set independently.
- `food.entity.ts`: `Food` type — minimal, just position + fixed mass value.
- `bot.entity.ts`: `Bot` type extending the cell shape with a `behavior: 'wanderer' | 'hunter' | 'fleer'` discriminator and whatever per-behavior state fields tasks 006-008 will need (e.g. `targetId`, `fleeDirection` — stub fields are fine here, filled in later).
- A `Player` type (same cell shape, no behavior field).
- Geometry helpers: `distance(a, b)`, `isOverlapping(a, b)` (circle-circle overlap using position + radius).

## Files touched

- `src/world/domain/cell.entity.ts`
- `src/world/domain/food.entity.ts`
- `src/world/domain/bot.entity.ts`
- `src/world/domain/geometry.ts`

## Acceptance criteria

- Types compile with no imports from `render/`, `input/`, `ui/`, or `three`.
- `massToRadius` / its inverse round-trip correctly for a range of test values.
- `isOverlapping` correctly reports true/false for known circle pairs (unit-testable without a browser).
