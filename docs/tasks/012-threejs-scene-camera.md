# 012 — Three.js Scene & Camera Adapter

## Goal

Set up the Three.js scene, lighting, flat arena geometry, top-down camera, and the arena-edge visual treatment (petri-dish rim) — the static parts of the render adapter, before any dynamic entity meshes are added.

## Depends on / why it's next

Depends on 011 (implements `IRenderer`'s `init`/`resize`/`dispose`, though full `render()` with live entities lands in 015). Independent of the world/domain tasks (003-010) and the Blender models (002) except for needing the arena dimensions constant shared with `world/domain/rules.ts` (task 004) to size the arena mesh consistently.

## Detailed steps

- `scene.ts`: `THREE.Scene`, flat arena plane/disc sized to match the arena dimensions used in `world/domain/rules.ts`, petri-dish rim visual at the boundary (simple torus or extruded ring geometry with a distinct material — doesn't need a Blender model, can be built directly in Three.js).
- `camera.ts`: top-down `THREE.OrthographicCamera` or a steep perspective camera looking straight down at the arena center; expose a method to adjust zoom/height as the player's mass grows (hook point for task 027's balance pass — camera zoom-out as the player grows was discussed as desirable, implement the hook here even if the exact curve is tuned later).
- `lighting.ts`: a simple light rig (e.g. ambient + one directional light) sufficient to show the translucent/shaded materials from the Blender models without needing per-object custom lighting.
- Wire `scene.ts`/`camera.ts`/`lighting.ts` together in the `ThreeRenderer` class implementing `IRenderer.init()`.

## Files touched

- `src/render/adapter/three/scene.ts`
- `src/render/adapter/three/camera.ts`
- `src/render/adapter/three/lighting.ts`
- `src/render/adapter/three/three-renderer.ts` (implements `IRenderer`)

## Acceptance criteria

- `init()` mounts a canvas showing the flat arena with its rim, lit, viewed top-down, with no entities yet (empty scene).
- `resize()` correctly updates camera aspect/renderer size on window resize.
- Camera zoom/height adjustment hook exists and is callable, even if not yet wired to live player mass (that wiring happens in 015/017).
