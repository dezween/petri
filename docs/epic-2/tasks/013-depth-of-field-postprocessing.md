# 013 — Depth-of-Field / Blur Post-Processing

## Goal

Blur everything beyond the main dish (the bench + props from tasks 010-012), so the dish reads
as "in focus" and the background reads as out-of-focus context — standard microscopy-photo
framing.

## Depends on / why it's next

Depends on 010-012 (there must be a background to blur). First task in this epic to introduce
Three.js post-processing (`EffectComposer`) — task 014 (bloom) will reuse the same composer
pipeline, so get the composer setup right here since it's shared infrastructure.

## Detailed steps

- Set up `EffectComposer` in `src/render/adapter/three/post-processing.ts`, wired into
  `ThreeRenderer`'s render loop (replacing the direct `renderer.render(scene, camera)` call
  with the composer's render pass, or layering on top of it — whichever the implementer judges
  cleaner).
- Apply a depth-of-field/bokeh pass (Three.js's bundled bokeh/DOF example pass) focused on the
  dish, defocusing the bench/props beyond the rim. If a real DOF pass proves too expensive or
  fiddly to tune well for this scene's geometry, a cheaper faked approach (e.g. a pre-blurred
  background render target, or simply reduced material detail + fog) is an acceptable
  substitute — this was explicitly left as a judgment call in `docs/epic-2/SPEC.md`, don't
  force a specific technique if it's not working out.
- Make sure this doesn't blur the dish itself, the player, bots, or food — only the background
  layer.

## Files touched

- `src/render/adapter/three/post-processing.ts`
- `src/render/adapter/three/three-renderer.ts`

## Acceptance criteria

- The dish and all gameplay entities (player, bots, food) remain sharp; the bench and props
  beyond the rim are visibly softer.
- No measurable frame-time regression that makes the game feel sluggish during normal play
  (this is a judgment call verified in task 016's playtest, not something to over-engineer a
  benchmark for here).
