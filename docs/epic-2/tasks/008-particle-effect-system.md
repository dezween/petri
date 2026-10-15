# 008 — Particle Effect System (Render Module)

## Goal

A generic, reusable particle-burst effect in `render/`, not yet wired to any trigger (that's
task 009). Build the mechanism first, prove it renders a burst correctly, then hook it up.

## Depends on / why it's next

Depends on nothing new — pure addition to `src/render/adapter/three/`, same module Epic 1
already built `scene.ts`/`camera.ts`/`cell-mesh-factory.ts` in. Independent of the audio tasks
(003-007); could be built in parallel with them, sequenced after here for a linear read order.

## Detailed steps

- `src/render/adapter/three/particles.ts`: a small, cheap particle system (e.g. a `THREE.Points`
  cloud or a handful of short-lived sprite meshes) that can be told "burst at position X with
  color Y" and animates/fades out over a short, fixed duration, cleaning up its own GPU
  resources when done (no leaked geometries/materials accumulating over a long play session —
  this matters since eating happens frequently).
- Expose a simple method on `ThreeRenderer` (or a method this module exposes that
  `ThreeRenderer` composes) like `spawnEatBurst(position, color)` that task 009 will call.
- Keep it cheap: this fires potentially dozens of times per minute during active play, so avoid
  anything that allocates heavily per-burst (reuse buffers/pools where reasonable, following
  the instancing discipline Epic 1's `cell-mesh-factory.ts` already established for a similar
  performance concern).

## Files touched

- `src/render/adapter/three/particles.ts`
- `src/render/adapter/three/three-renderer.ts` (exposes the new method)

## Acceptance criteria

- Calling the burst method doesn't throw and the particle system cleans itself up after its
  fixed lifetime (no unbounded growth in scene object count over repeated calls — test this
  with a loop of many calls and assert the tracked object count returns to baseline).
- No real WebGL rendering assertions needed (matches Epic 1's existing judgment on what's
  testable without a browser) — but the lifecycle/bookkeeping logic should be unit-tested.
