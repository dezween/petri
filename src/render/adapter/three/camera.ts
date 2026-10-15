import * as THREE from "three";
import type { Vector2 } from "@/world/domain/geometry";

/** How high above the arena the camera sits. Only affects perspective-free ortho rendering, not zoom. */
const CAMERA_HEIGHT = 500;

/**
 * Balance pass (027): scaled alongside cell.entity.ts's RADIUS_PER_MASS_SQRT (currently 8,
 * i.e. 4x the original 2) so on-screen framing is unchanged — these three constants only
 * make sense relative to that one, not as absolute values.
 */
/** Half-width of the view frustum when the player is at minimum size. */
const BASE_VIEW_HALF_WIDTH = 600;
/** Extra view half-width gained per unit of player radius, so the camera pulls back as the player grows. */
const ZOOM_OUT_PER_RADIUS = 2.2 / 4;
/** Never zoom in tighter than this, even for a freshly-spawned player. */
const MIN_VIEW_HALF_WIDTH = 400;

/**
 * Orthographic top-down camera: no perspective distortion, which suits a flat arena viewed
 * straight down better than a perspective camera (avoids the up-vector singularity of looking
 * straight down a perspective lens, and keeps apparent entity size independent of screen position).
 */
export function createCamera(aspect: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(
    -BASE_VIEW_HALF_WIDTH * aspect,
    BASE_VIEW_HALF_WIDTH * aspect,
    BASE_VIEW_HALF_WIDTH,
    -BASE_VIEW_HALF_WIDTH,
    1,
    CAMERA_HEIGHT * 2,
  );
  camera.position.set(0, CAMERA_HEIGHT, 0);
  // Looking straight down -Y makes the default up vector (0,1,0) parallel to the view
  // direction, which is degenerate for lookAt. Point "up" along -Z instead so screen-up
  // stays a sensible, stable direction.
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Keeps the camera centered on the player's current position every frame. Without this the
 * camera stays fixed on the arena's world-space origin — the player sails off-screen the
 * moment they move away from the center, since the orthographic frustum (±150 units at
 * minimum zoom) is far smaller than the arena. This was missing end-to-end from the design
 * spec through task 012's own doc (which only ever specified "look at the arena center" +
 * zoom-by-mass, never follow-by-position) — caught by an actual browser playtest, not by
 * code review, since nothing in the docs flagged it as absent.
 */
export function updateCameraPosition(camera: THREE.OrthographicCamera, playerPosition: Vector2): void {
  camera.position.set(playerPosition.x, CAMERA_HEIGHT, playerPosition.z);
  camera.lookAt(playerPosition.x, 0, playerPosition.z);
}

export function updateCameraAspect(camera: THREE.OrthographicCamera, aspect: number): void {
  const halfHeight = (camera.top - camera.bottom) / 2;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.updateProjectionMatrix();
}

/**
 * Zoom hook for task 027's balance pass: widens the view frustum as the player's radius
 * grows, so the player doesn't visually outgrow the screen. The exact curve (base/slope/min
 * above) is a placeholder tuned for real in 027 — the hook just needs to exist and work.
 */
export function adjustZoomForPlayerRadius(
  camera: THREE.OrthographicCamera,
  playerRadius: number,
): void {
  const aspect = (camera.right - camera.left) / (camera.top - camera.bottom);
  const halfHeight = Math.max(
    MIN_VIEW_HALF_WIDTH,
    BASE_VIEW_HALF_WIDTH + playerRadius * ZOOM_OUT_PER_RADIUS,
  );
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.updateProjectionMatrix();
}
