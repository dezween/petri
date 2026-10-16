import * as THREE from "three";

/**
 * Epic 3, task 002: shadow-map resolution for the directional light below. 2048×2048 — large
 * enough to avoid obviously blocky edges on the mostly-empty pale floor, not so large it's a
 * measurable frame-time cost for a single directional light. Confirmed (not retuned) in task
 * 006's playtest — real screenshots at all three arena sizes show soft, clean shadow edges with
 * no visible acne/blockiness/peter-panning, and no observed stutter.
 */
const SHADOW_MAP_SIZE = 2048;

/**
 * The shadow camera's orthographic frustum only needs to cover the arena's fixed world-space
 * footprint (radius 1000 at the Large arena size, per `src/ui/adapter/dom/menu.adapter.ts`'s
 * `ARENA_WIDTH_LARGE`) — not the lab-bench's much larger `BENCH_RADIUS` (6000, `scene.ts`),
 * which is sized for the *camera's* viewport worst-case and has nothing to do with what the
 * shadow camera needs to see (entities can never be positioned outside the arena's radius, no
 * matter how the player's camera is zoomed). ±1200 = 1000 radius plus a ~20% margin for the
 * frustum's projection skew under the light's tilt.
 */
const SHADOW_FRUSTUM_HALF_SIZE = 1200;

/**
 * Simple ambient + directional rig — enough to read the translucent/shaded materials from
 * the Blender models without per-object custom lighting. The directional light additionally
 * casts shadows (Epic 3, task 002).
 */
export function addLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  // Epic 3, task 002: moved 3x further out along the same direction from the original
  // (100, 300, 150) — a DirectionalLight's position only matters for where its shadow camera
  // sits (a directional light's actual *lighting* is direction-only), so this is a shadow-depth
  // fix, not a lighting-angle change. The original position put much of the Large arena's
  // ground plane outside Three.js's default shadow-camera near/far ([-165, 865] real depth
  // range vs. the default [0.5, 500]) — moving the light back shifts that range to
  // [535, 1565], which `shadow.camera.near`/`.far` below are set to cover with margin. See
  // docs/epic-3/tasks/002-shadow-mapping-setup.md for the full derivation.
  directional.position.set(300, 900, 450);
  directional.castShadow = true;
  directional.shadow.mapSize.width = SHADOW_MAP_SIZE;
  directional.shadow.mapSize.height = SHADOW_MAP_SIZE;
  directional.shadow.camera.left = -SHADOW_FRUSTUM_HALF_SIZE;
  directional.shadow.camera.right = SHADOW_FRUSTUM_HALF_SIZE;
  directional.shadow.camera.top = SHADOW_FRUSTUM_HALF_SIZE;
  directional.shadow.camera.bottom = -SHADOW_FRUSTUM_HALF_SIZE;
  directional.shadow.camera.near = 400;
  directional.shadow.camera.far = 1700;
  directional.shadow.camera.updateProjectionMatrix();
  scene.add(directional);
}
