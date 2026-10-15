# 011 — Render Port

## Goal

Define the `IRenderer` interface — the contract the `session` module will call, kept free of any Three.js types so the domain/session layers never import rendering code directly.

## Depends on / why it's next

Depends on 001 (needs `src/render/port/` to exist). Independent of 003-010 (world/domain work) — can run in parallel with those, but must land before 012-015 (the Three.js adapter implements this interface) and before 017 (the game loop calls through it).

## Detailed steps

- `renderer.port.ts`: define `IRenderer` with at minimum:
  - `init(container: HTMLElement): void` — mounts the renderer's canvas.
  - `render(snapshot: WorldSnapshot): void` — called once per frame with the world state snapshot from task 005's `getSnapshot()`.
  - `resize(width: number, height: number): void`.
  - `dispose(): void`.
- `WorldSnapshot` type should be imported from `world/domain` (plain data, no Three.js types) — this is the shape the renderer translates into meshes.

## Files touched

- `src/render/port/renderer.port.ts`

## Acceptance criteria

- `renderer.port.ts` has zero imports from `three` or any `render/adapter/*` path.
- The interface is implementable by a trivial no-op mock (useful for testing `session` logic without a real WebGL context).
