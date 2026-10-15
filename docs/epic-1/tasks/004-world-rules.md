# 004 — World Rules (Eating, Growth, Victory Cap)

## Goal

Encode the game's core business rules as pure functions: who eats whom on overlap, how mass grows, and when the victory cap is reached.

## Depends on / why it's next

Depends on 003 (needs the entity types and geometry helpers). Must land before 005 (the world service applies these rules every tick).

## Detailed steps

- `resolveEating(a, b)`: given two overlapping cells, return which one is eaten (strictly larger mass wins; define and document the tie-break rule for equal mass, e.g. no one eats).
- `growMass(eaterMass, eatenMass): number`: mass transfer formula on a successful eat. Keep it simple for MVP — direct addition is fine; leave a comment only if the formula has a non-obvious tuning reason to not be 1:1.
- `isAtVictoryCap(radius, arenaWidth): boolean`: radius capped at roughly 35-40% of arena width, per `docs/SPEC.md`. Expose the fraction as a named constant, not a magic number.
- `clampRadiusToCap(radius, arenaWidth): number`: once at cap, radius growth is clamped (mass can still be tracked/display as score, but radius must not exceed the cap — this is what makes the cap also double as a hard ceiling on space used).

## Files touched

- `src/world/domain/rules.ts`

## Acceptance criteria

- Given two overlapping cells of different mass, `resolveEating` always picks the larger one, never the smaller.
- `isAtVictoryCap` returns true once radius crosses the configured fraction of arena width, false below it.
- `clampRadiusToCap` never returns a value above the cap, regardless of how far over it the input is.
- All functions are pure (no mutation of inputs, no I/O) — unit-testable without a browser.
