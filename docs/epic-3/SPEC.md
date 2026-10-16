# SPEC — Epic 3: Make It Feel Like 3D

Builds on the shipped Epic 1 (`docs/epic-1/SPEC.md`) and Epic 2 (`docs/epic-2/SPEC.md`) MVPs.
This epic is **visual-only**. It does not touch the domain model, game rules, bot AI, audio,
UI state machine, or arena-size/settings systems Epic 1/2 built and balance-tuned. If a change
here ever seems to require touching anything outside `src/render/adapter/three/` and
`tools/blender/`, stop and flag it — that's a sign it's out of scope for this epic.

## Why this epic exists

The user asked what could be changed to make the game feel more genuinely 3D. The camera is a
perfectly top-down `THREE.OrthographicCamera` (`src/render/adapter/three/camera.ts`, chosen
deliberately in Epic 1 task 012 for gameplay clarity — no perspective distortion, no up-vector
singularity when looking straight down). That choice is sound for gameplay but reads visually
closer to a flat 2D minimap than a 3D scene, despite every entity being a real 3D model.

## Stack

Unchanged — no new dependencies. Everything in this epic is available in the already-installed
`three` package (`^0.169.0`):

- **Shadows**: `THREE.WebGLRenderer.shadowMap`, `THREE.DirectionalLight.castShadow` +
  `.shadow.camera`, `Mesh.castShadow`/`.receiveShadow` — all core Three.js, no
  `three/addons` import needed.
- **Fresnel/glass look**: `THREE.MeshPhysicalMaterial`'s built-in `transmission`/`ior`/
  `iridescence`/`thickness` properties — a standard core material, not a custom shader. Task
  005 should confirm at implementation time that `MeshPhysicalMaterial`'s transmission path
  actually renders as expected in this project's non-WebGPU `WebGLRenderer` setup (transmission
  historically has WebGL-renderer quirks around transparent-object sorting); if it doesn't give
  an acceptable result, the fallback is a small custom `onBeforeCompile` rim-light injection on
  `MeshStandardMaterial` — noted as a fallback, not the default plan.
- **Post-processing**: already has `three/addons/postprocessing/{EffectComposer,RenderPass,
  ShaderPass,UnrealBloomPass}` wired up (`post-processing.ts`, Epic 2 tasks 013-014) — this
  epic's tasks don't add new passes, they change what's already rendered into that pipeline.

## Architecture

Touches **only**:

```
src/render/adapter/three/
  camera.ts            # tilted instead of perfectly top-down
  lighting.ts           # directional light becomes shadow-casting, with a shadow-camera
                         # frustum sized to the arena
  scene.ts               # arena floor/rim/lab-bench gain receiveShadow = true
  cell-mesh-factory.ts   # entity meshes gain castShadow = true; player/bot meshes gain a
                          # per-frame vertical bobbing offset
  three-renderer.ts       # wires shadowMap.enabled on the WebGLRenderer; threads deltaTime
                          # into whatever bobbing needs it (render() already receives
                          # deltaTime as of Epic 2's particle system — reuse it, don't add a
                          # second clock)
  membrane-material.ts    # NEW — builds the player membrane's fresnel/glass material,
                          # applied as a post-load swap onto the loaded glTF material (see
                          # task 005)

tools/blender/
  (no changes — the membrane's base color/alpha stays Blender-authored; the fresnel look is
  applied in Three.js on top of it, not baked into the exported glTF)
```

No changes to `src/world/`, `src/session/`, `src/ui/`, `src/audio/`, or any `*.port.ts`
interface's method signatures — `IRenderer`'s contract (`init`/`render`/`resize`/`dispose`/
`setArenaWidth`/`spawnEatBurst`) is unchanged; everything in this epic is an internal
implementation detail of the one class (`ThreeRenderer`) and its private helpers that already
implements it.

## Design decisions (final — agreed with the user)

### 1. Tilt the camera (not a perspective-camera switch)

A full switch to `THREE.PerspectiveCamera` was considered and explicitly **rejected** in favor
of tilting the existing `OrthographicCamera`. Reasoning: camera-follow (`updateCameraPosition`),
zoom-by-mass (`adjustZoomForPlayerRadius`), and arena-size threading (Epic 2 task 001's
`setArenaWidth`) were all built and balance-tuned assuming an orthographic projection — apparent
entity size being independent of screen position is load-bearing for how zoom-by-mass currently
reads. Switching to perspective would require re-deriving and re-tuning all of that for a less
certain visual gain. Tilting the orthographic camera gets most of the "it looks flat" complaint
fixed (parallax, visible object sides, shadows read as angled rather than directly-overhead)
while keeping every existing camera-math constant meaningful.

**Concrete approach**: look-direction elevation of **65-70° from horizontal** (currently 90° —
straight down). Implemented by offsetting the camera's position away from the player along one
horizontal axis (world -Z, i.e. visually "south" of the player) by
`CAMERA_HEIGHT / tan(elevationDegrees)` while keeping `lookAt(player)` — at `CAMERA_HEIGHT = 500`
and a 67° elevation, that's an offset of roughly `500 / tan(67°) ≈ 212` units. `camera.up` can
likely return to the natural `(0, 1, 0)` once the view direction is no longer parallel to it —
the existing `up.set(0, 0, -1)` hack in `createCamera` exists specifically to dodge the
straight-down degenerate case (see that function's comment); re-verify whether it's still needed
once tilted, don't assume either way without checking.

Exact elevation angle is a starting value, not final — task 006 (balance pass) tunes it by
actually looking at the result, not just trusting this math.

### 2. Shadow mapping

- `renderer.shadowMap.enabled = true`, `renderer.shadowMap.type = THREE.PCFSoftShadowMap` (soft
  edges — a game about translucent organic cells shouldn't have hard-edged shadows).
- The existing `DirectionalLight` (`lighting.ts`) becomes the shadow-casting light:
  `light.castShadow = true`, with its `shadow.camera` (an orthographic shadow frustum, since
  it's a directional light) sized to cover the arena at its largest configured width (2000, per
  Epic 2's Large size) rather than a fixed guess — reuse the same kind of worst-case sizing
  reasoning `scene.ts`'s `BENCH_RADIUS` comment already documents for a similar problem, don't
  recompute it from scratch with different assumptions.
- Starting shadow map resolution: **2048×2048** — large enough to avoid obviously blocky shadow
  edges on a mostly-empty pale floor, not so large it's a measurable frame-time cost for a
  single directional light. Tuned for real in task 006 if it turns out too soft/blocky/slow.
- `scene.ts`'s arena floor, rim, and lab-bench all get `receiveShadow = true`. The lab-bench and
  floor also make sense as `castShadow = true` candidates only if something could shadow *onto*
  them from below, which nothing does here — leave them shadow-receivers only, not casters.

### 3. Entity meshes cast shadows

- Player mesh, all three bot `InstancedMesh`es, the food `InstancedMesh`, and the static
  decorative props (`static-props.ts`, Epic 2 task 012) all get `castShadow = true`.
- `InstancedMesh` shadow-casting is supported natively by Three.js (each instance casts its own
  shadow using its own instance matrix) — no per-instance special-casing needed beyond setting
  the flag once on the `InstancedMesh` itself.

### 4. Vertical bobbing animation

- Each rendered entity (player, bots, food — not the static arena/bench/props, which should
  read as fixed solid objects, not floating) gets a small sinusoidal Y-offset applied on top of
  its ground-plane position (`y` is currently hardcoded to `0` everywhere in
  `cell-mesh-factory.ts`'s `updatePlayer`/`updateFood`/`updateBots` — this becomes
  `amplitude * sin(frequency * elapsedTime + phaseOffset)`).
- Starting amplitude: **2-4 world units** — small relative to a freshly-spawned player's radius
  (~40 units at starting mass, per Epic 1/2's balance-tuned `RADIUS_PER_MASS_SQRT = 8` and
  `INITIAL_PLAYER_MASS = 25`), so it reads as a gentle float, not a visible pop up and down.
- Starting frequency: **~0.5-1 Hz** (a slow, calm bob — this is a petri dish, not a trampoline).
- **Per-entity phase offset is required**, not optional: if every entity bobs perfectly in sync
  it reads as one mechanical animation applied to a flat scene, defeating the point. Derive a
  stable per-entity phase from something already unique per entity (e.g. a hash of the food/bot
  array index, or — simpler and already available — each entity's world-space spawn position)
  rather than `Math.random()` at render time, so a given entity's bob phase doesn't visibly jump
  between frames.
- This needs a running clock. `ThreeRenderer.render(snapshot, deltaTime)` already receives
  `deltaTime` every frame (added for Epic 2's particle system) — accumulate it into an elapsed-
  time value inside `CellMeshFactory` (or wherever the bobbing math lives) rather than adding a
  second independent timer.

### 5. Fresnel / glass membrane shader — player only

- Scope: **player cell's membrane only**, not bots. Verified against the actual
  `tools/blender/generate_bot_*.py` scripts: all three bot materials are fully opaque
  (`alpha=1.0`) — there's no translucent "membrane" concept on bots to begin with, only on the
  player (`generate_player_cell.py`'s `MembraneMat`, `alpha=0.45`). Applying a glass/fresnel
  look to an opaque material wouldn't read as glass, it would just look like an odd rim-light on
  a solid color — there's nothing to extend.
- Implementation: after `GLTFLoader` resolves `player_cell.glb` (in `model-loader.ts` /
  consumed by `cell-mesh-factory.ts`'s `buildStaticObject`), identify the membrane's material
  specifically (not the nucleus's — `player_cell.glb` is one joined mesh with 2 material slots,
  membrane first per `generate_player_cell.py`'s join order, but verify by material name/color
  rather than assuming array position) and swap or augment it with a `THREE.MeshPhysicalMaterial`
  configured for a translucent, faintly reflective "cell membrane" look: `transmission` in the
  0.3-0.6 range, `ior` around 1.33 (water's index of refraction — thematically correct for an
  aqueous membrane), `thickness` a small positive value, low `roughness` (sharper highlights
  read as "wet/glassy"), keep the existing base color/alpha from the Blender-authored material
  rather than replacing it outright.
- New file `src/render/adapter/three/membrane-material.ts` for this — keeps the swap logic out
  of `cell-mesh-factory.ts`'s already-large constructor, matching how `post-processing.ts` and
  `particles.ts` are each their own file for one cohesive piece of rendering logic.

## Out of Scope (Epic 3) — considered and resolved, not just deferred

- **Full `PerspectiveCamera` switch** — considered as the alternative to tilting the existing
  `OrthographicCamera`, resolved in favor of tilting (see Design Decision 1's reasoning). Not
  ruled out forever the way Epic 2 ruled out split/eject, but not planned — would need its own
  re-justification if ever revisited, given the re-tuning cost documented above.
- **Any domain/gameplay change** — this epic is visual-only by definition. If tilting the camera
  or adding shadows surfaces a gameplay-clarity complaint (e.g. "I can't tell entity sizes apart
  as easily now"), that's balance-pass (task 006) territory to tune the *visual* parameters
  (tilt angle, shadow softness), not a reason to touch `world/domain/rules.ts`.
- **Textures / image-based materials** — everything above stays within flat-color + physical-
  material-property territory (transmission, iridescence, roughness), matching this project's
  existing "procedural, no downloaded assets" ethos (3D models via Blender scripts, audio via
  Python stdlib synthesis — see Epic 1/2). No image textures, normal maps, or environment maps
  are introduced. `disposeMaterial`'s existing "no live leak today, no textures to dispose"
  comment in `cell-mesh-factory.ts` should remain true after this epic, not need revisiting.
- **Per-bot fresnel/glass variants** — resolved above (player-only; bots are opaque, nothing to
  extend).
- **Mobile/low-end GPU shadow-quality fallback** (e.g. detecting a weak device and disabling
  shadows) — not addressed here. If task 006's playtest finds a real performance problem, that's
  a finding to report, not something pre-solved by a scope item in this spec.

## Task breakdown

See `docs/epic-3/TASKS.md` for the ordered, numbered task list (3-digit padded, restarting at
001 — a separate numbering namespace from Epic 1's 001-028 and Epic 2's 001-017).
