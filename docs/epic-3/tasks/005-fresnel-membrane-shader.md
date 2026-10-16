# 005 — Fresnel / Glass Membrane Shader (Player Only)

## Goal

Make the player cell's translucent membrane read as a glassy/liquid surface (brighter and more
reflective at grazing viewing angles) rather than a flat alpha-blended disc. Player-only — see
SPEC.md's Design Decision 5 for why bots are explicitly excluded (all three bot materials are
fully opaque, there's no membrane concept to extend).

## Depends on / why it's next

Independent of 002-004; benefits from (and its acceptance criteria require) task 001's tilt
already being in place to judge the grazing-angle effect. Grouped last among the "feature" tasks
(before the balance pass) since it's the most speculative/judgment-call-heavy of the five and
benefits from the rest of the scene's new look (tilt, shadows, bobbing) already being in place to
judge it against.

## Detailed steps

- Read `tools/blender/generate_player_cell.py` as it currently is (already fixed in Epic 2's
  review pass to join membrane+nucleus into one mesh with 2 material slots, exporting correctly
  as `alphaMode: BLEND` — verify this is still true before building on it, don't assume from
  this doc alone). The membrane material is `MembraneMat` (color `(0.35, 0.75, 0.95)`,
  alpha 0.45); the nucleus is `NucleusMat` (opaque). Do not touch the Blender script — the base
  color/alpha stays Blender-authored, this task only affects how Three.js renders it.
- New file `src/render/adapter/three/membrane-material.ts`: after `GLTFLoader` resolves
  `player_cell.glb` (consumed in `cell-mesh-factory.ts`'s `buildStaticObject`, which — per its
  own doc comment — turns a multi-primitive model into a `THREE.Group` of one `Mesh` per
  primitive), identify the membrane's `Mesh` specifically (by material name/color — the
  Blender-authored name `MembraneMat` likely survives the glTF export as the material's `.name`,
  verify this rather than assuming array order) and replace or augment its material with a
  `THREE.MeshPhysicalMaterial`: `transmission` 0.3-0.6, `ior` ≈ 1.33, a small positive
  `thickness`, low `roughness` — carry over the existing base color and (if not fully superseded
  by `transmission`) alpha from the Blender-authored material rather than hardcoding new values
  that drift from what Blender exports.
- Confirm `MeshPhysicalMaterial`'s `transmission` actually renders acceptably in this project's
  plain `WebGLRenderer` setup (no WebGPU renderer, no explicit transmission-render-target pass
  configured anywhere in `three-renderer.ts`/`post-processing.ts` currently) — `transmission`
  has known WebGL-renderer quirks around sorting and background-sampling that can look wrong
  without extra setup. If it doesn't look acceptable after real testing, SPEC.md's documented
  fallback is a small custom `onBeforeCompile` rim-light injection on the existing
  `MeshStandardMaterial` instead of a full material swap — try the simpler built-in approach
  first, only reach for the fallback if it demonstrably doesn't work, and document which path
  was taken and why in a comment.
- Wire the new material into `cell-mesh-factory.ts`'s player-mesh construction path (likely
  inside `buildStaticObject`'s call site for the player specifically, or a small post-processing
  step right after it in `CellMeshFactory`'s constructor — don't make `buildStaticObject` itself
  player-specific, it's shared with static props too).

## Files touched

- `src/render/adapter/three/membrane-material.ts` (new)
- `src/render/adapter/three/cell-mesh-factory.ts`
- New `membrane-material.test.ts` — test what's reasonably testable without real WebGL/shader
  compilation (e.g. that the right material properties get set, that the membrane mesh is
  correctly identified and the nucleus mesh is left untouched) and note what can't be verified
  without a real browser, same as every other render-module task in this project's history.

## Acceptance criteria

- The player membrane visibly reads as glassy/reflective at grazing angles in a real browser —
  this requires the camera to actually be tilted (task 001) to judge properly; verify after 001
  is in place, not against the old straight-down view.
- The nucleus's material is unaffected — only the membrane changes.
- `npx vitest run` passes.
- Whichever approach (built-in `MeshPhysicalMaterial` transmission, or the custom shader
  fallback) was actually used is documented in a comment explaining why.
