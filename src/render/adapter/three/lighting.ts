import * as THREE from "three";

/**
 * Epic 3, task 002: shadow-map resolution for the directional light below. 2048×2048 — large
 * enough to avoid obviously blocky edges on the mostly-empty pale floor, not so large it's a
 * measurable frame-time cost for a single directional light. Confirmed (not retuned) in task
 * 006's playtest — real screenshots at all three (then-only-three) arena sizes show soft, clean
 * shadow edges with no visible acne/blockiness/peter-panning, and no observed stutter.
 */
const SHADOW_MAP_SIZE = 2048;

/**
 * Fixed light position — a DirectionalLight's position only matters for where its shadow camera
 * sits (the light's actual *lighting* is direction-only), so this is independent of arena size.
 * Epic 3, task 002 moved it 3x further out along the original (100, 300, 150) direction to push
 * the shadow-camera's depth range to somewhere Three.js's default near/far wouldn't clip the
 * (then only) Large arena. Now that arena width is no longer fixed (10 sizes, up to 3250 —
 * src/ui/adapter/dom/menu.adapter.ts's `ARENA_SIZES`), `configureShadowFrustum` below derives
 * near/far generically from this fixed position for whatever `arenaWidth` is actually in play,
 * rather than hardcoding one depth range for one no-longer-true "biggest" size.
 */
const LIGHT_POSITION = new THREE.Vector3(300, 900, 450);

/**
 * Margin added on both sides of the shadow camera's exact computed depth range, in the same
 * spirit as the original task 002 derivation's ~135-unit margin (near=400 vs. exact 535;
 * far=1700 vs. exact 1565) — rounded to a clean number since the exact margin was never load-
 * bearing, just headroom against the depth-range math being slightly off in practice.
 */
const SHADOW_DEPTH_MARGIN = 150;

/**
 * Extra fraction of the arena's radius added to the shadow camera's orthographic frustum
 * half-size, so the frustum's projection skew under the light's tilt doesn't clip shadows right
 * at the arena's edge. Matches task 002's original "±1200 = 1000 radius + ~20% margin" ratio.
 */
const SHADOW_FRUSTUM_MARGIN_FRACTION = 0.2;

/**
 * Sets the shadow camera's orthographic frustum (left/right/top/bottom) and depth range
 * (near/far) to cover the ground-plane disc of radius `arenaWidth / 2`, for `light`'s fixed
 * `LIGHT_POSITION` looking at the world origin. Called once at construction and again from
 * `ThreeRenderer.setArenaWidth` whenever the player picks a different arena size, so the two
 * never fall out of sync with each other the way they would if this were one-time-only setup
 * (exactly the class of bug Epic 2's arena-size review caught for the renderer's floor/rim —
 * see `IRenderer.setArenaWidth`'s doc comment).
 *
 * Depth-range derivation: for a ground point P at distance r from the origin, depth along the
 * light's view direction D = normalize(target - L) = normalize(-L) (target is the origin) is
 * `dot(P - L, D)`. Since P varies only in X/Z (the ground plane) and D's X/Z components are
 * `-L.x/|L|`/`-L.z/|L|`, this works out to `|L| ± r * sqrt(L.x² + L.z²) / |L|` — i.e. the depth
 * to the origin itself (`|L|`), plus or minus a term that grows linearly with the arena's
 * radius. Verified against task 002's original hand-derived numbers: at r=1000 (the former
 * fixed Large arena), this formula gives [535, 1565] — exactly what that task's doc already
 * documented from its own by-hand derivation.
 */
export function configureShadowFrustum(light: THREE.DirectionalLight, arenaWidth: number): void {
  const arenaRadius = arenaWidth / 2;

  const frustumHalfSize = arenaRadius * (1 + SHADOW_FRUSTUM_MARGIN_FRACTION);
  light.shadow.camera.left = -frustumHalfSize;
  light.shadow.camera.right = frustumHalfSize;
  light.shadow.camera.top = frustumHalfSize;
  light.shadow.camera.bottom = -frustumHalfSize;

  const distanceToOrigin = LIGHT_POSITION.length();
  const horizontalSpread = Math.hypot(LIGHT_POSITION.x, LIGHT_POSITION.z) / distanceToOrigin;
  const depthSwing = arenaRadius * horizontalSpread;
  light.shadow.camera.near = Math.max(1, distanceToOrigin - depthSwing - SHADOW_DEPTH_MARGIN);
  light.shadow.camera.far = distanceToOrigin + depthSwing + SHADOW_DEPTH_MARGIN;

  light.shadow.camera.updateProjectionMatrix();
}

/**
 * Simple ambient + directional rig — enough to read the translucent/shaded materials from
 * the Blender models without per-object custom lighting. The directional light additionally
 * casts shadows (Epic 3, task 002). Returns the directional light so `ThreeRenderer` can
 * reconfigure its shadow frustum later via `configureShadowFrustum` when the arena size changes.
 */
export function addLighting(scene: THREE.Scene, arenaWidth: number): THREE.DirectionalLight {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.copy(LIGHT_POSITION);
  directional.castShadow = true;
  directional.shadow.mapSize.width = SHADOW_MAP_SIZE;
  directional.shadow.mapSize.height = SHADOW_MAP_SIZE;
  configureShadowFrustum(directional, arenaWidth);
  scene.add(directional);

  return directional;
}
