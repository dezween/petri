# 024 — Map Boundary Enforcement

## Goal

Finish hard-wall boundary behavior at the arena edge — task 005 added basic position clamping, this task makes it feel correct (no jitter/sticking) and ties it to task 012's visual edge.

## Depends on / why it's next

Depends on 005 (basic clamping already exists) and 012 (the visual rim it should align with pixel/world-unit-perfect). Placed late since it's a refinement, not new structural work — easiest to get right once the full render pipeline (through 015) is in place to visually verify against.

## Detailed steps

- Revisit `world.service.ts`'s boundary clamping from task 005: confirm it clamps the *entity's edge* (`position ± radius`) to the arena bounds, not just the center point — otherwise large cells visually clip through the rim.
- Confirm bot AI (006-008) doesn't get stuck oscillating against a wall (e.g. a fleer cornered against the edge with a hunter approaching should still have a valid escape direction along the wall, not freeze).
- Verify the visual rim from task 012 lines up exactly with the enforced boundary (no gap or overlap between where movement stops and where the rim renders).

## Files touched

- `src/world/service/world.service.ts`
- `src/world/domain/bot-ai/fleer.ts` (only if the cornering issue above requires a fix here)

## Acceptance criteria

- No entity's visible mesh ever crosses the rendered rim, at any mass/radius.
- A fleer bot cornered at the edge by a bigger entity still finds a valid escape direction (doesn't freeze or glitch).
- The player cannot push through or past the boundary regardless of input direction/speed.
