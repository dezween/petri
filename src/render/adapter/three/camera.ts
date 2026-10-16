import * as THREE from "three";
import type { Vector2 } from "@/world/domain/geometry";

/** How high above the arena the camera sits. Only affects perspective-free ortho rendering, not zoom. */
const CAMERA_HEIGHT = 500;

/**
 * Epic 3, task 001: elevation of the camera's look direction from horizontal. 90° would be the
 * old perfectly-top-down view; this tilts it so the scene reads as 3D (parallax, visible object
 * sides, angled shadows) without switching to a `PerspectiveCamera` — see
 * docs/epic-3/SPEC.md's Design Decision 1 for why tilting the existing `OrthographicCamera` was
 * chosen over a perspective switch. Confirmed (not retuned) in task 006's playtest: real
 * screenshots at all three arena sizes show visible shadow/parallax depth while entity-size
 * legibility stays intact (circles only compress to a measured ~8% ellipse at this angle —
 * `sin(67°) ≈ 0.92` — small enough that relative sizes are still easy to judge at a glance).
 */
const CAMERA_ELEVATION_DEGREES = 67;

/**
 * Horizontal offset (world -Z, i.e. "south" of whatever the camera is looking at) that produces
 * `CAMERA_ELEVATION_DEGREES` of elevation at `CAMERA_HEIGHT`: for a right triangle with the
 * camera at the top, `tan(elevation) = height / offset`, so `offset = height / tan(elevation)`.
 * At 67° this is `500 / tan(67°) ≈ 212`.
 */
const CAMERA_TILT_OFFSET = CAMERA_HEIGHT / Math.tan((CAMERA_ELEVATION_DEGREES * Math.PI) / 180);

/**
 * Near/far clipping planes along the camera's view direction. Under the old straight-down view
 * every ground-plane point was at the same depth (exactly `CAMERA_HEIGHT`), so a tight [1, 1000]
 * range was safe. Tilted, depth now varies with how far a point is "north" or "south" of the
 * look-at target: for a ground point offset by `dz` along world Z, depth ≈
 * `CAMERA_TILT_OFFSET*sin(elevation) + dz*cos(elevation)` (the forward vector's Y/Z components
 * scaled by the (height, offset) right triangle) — at 67° that's roughly `460 + 0.39*dz`.
 * Anything within the arena (radius ≤ 1000) stays within depth ≈ [70, 850], comfortably inside
 * a generous symmetric range; the lab-bench (radius 6000) extends further but, per its own doc
 * comment, is sized to always extend past the visible frustum anyway, so this only needs to
 * cover what the frustum's own top/bottom/left/right can actually show, not the bench's full
 * extent. [-1500, 3500] is generous relative to the arena's real depth range with ample margin
 * for the bench content that *is* actually visible at the frustum's edges.
 */
const CAMERA_NEAR = -1500;
const CAMERA_FAR = 3500;

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
 * Orthographic camera, tilted `CAMERA_ELEVATION_DEGREES` from horizontal (Epic 3, task 001 —
 * was perfectly top-down through Epic 1/2). Staying orthographic (not switching to
 * `PerspectiveCamera`) keeps apparent entity size independent of screen position, which
 * zoom-by-mass (`adjustZoomForPlayerRadius`) depends on; see docs/epic-3/SPEC.md's Design
 * Decision 1.
 */
export function createCamera(aspect: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(
    -BASE_VIEW_HALF_WIDTH * aspect,
    BASE_VIEW_HALF_WIDTH * aspect,
    BASE_VIEW_HALF_WIDTH,
    -BASE_VIEW_HALF_WIDTH,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(0, CAMERA_HEIGHT, -CAMERA_TILT_OFFSET);
  // The old straight-down view made the default up vector (0,1,0) parallel to the view
  // direction, which is degenerate for lookAt — that's why this used to be forced to (0,0,-1).
  // Once tilted, the view direction (toward the origin, down and forward) is no longer parallel
  // to (0,1,0) (their cross product is nonzero — verified in camera.test.ts), so the default up
  // vector works again and reads as the natural "up" on screen.
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Keeps the camera centered on the player's current position every frame, at the same tilted
 * offset `createCamera` establishes — the two must stay consistent with each other or the
 * camera would jump between its initial pose and its first follow-update. Without tracking the
 * player at all, the camera stays fixed on the arena's world-space origin — the player sails
 * off-screen the moment they move away from the center, since the orthographic frustum (±150
 * units at minimum zoom) is far smaller than the arena. This was missing end-to-end from the
 * design spec through task 012's own doc (which only ever specified "look at the arena center" +
 * zoom-by-mass, never follow-by-position) — caught by an actual browser playtest, not by
 * code review, since nothing in the docs flagged it as absent.
 */
export function updateCameraPosition(camera: THREE.OrthographicCamera, playerPosition: Vector2): void {
  camera.position.set(playerPosition.x, CAMERA_HEIGHT, playerPosition.z - CAMERA_TILT_OFFSET);
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
