import type { Vector2 } from "@/world/domain/geometry";
import type { IInputSource } from "@/input/port/input.port";

interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Pure direction math, exported so it's unit-testable without a real DOM element.
 *
 * Screen-right maps to world -x and screen-down maps to world -z. This is NOT the mapping you'd
 * guess by eye — it's been verified directly against `THREE.Camera.matrixWorld`'s actual basis
 * vectors (not hand-derived trig, which is easy to get subtly wrong with cross-product
 * handedness), both for the current tilted camera and the pre-Epic-3 straight-down one, by
 * running real `three` code:
 *
 *   old camera (up forced to (0,0,-1), used through Epic 1/2): local +X (screen-right) -> world
 *   +X, local +Y (screen-up) -> world -Z. That's where this function's ORIGINAL sign convention
 *   (screen-right -> +x, screen-down -> +z) came from, and it was correct for that camera.
 *
 *   current camera (Epic 3 task 001 tilted it to 67° elevation, up back to THREE's default
 *   (0,1,0) — see render/adapter/three/camera.ts): local +X (screen-right) -> world -X, local +Y
 *   (screen-up) -> world +Z. Both axes flipped relative to the old camera — not just one — which
 *   is why the tilt silently broke movement into feeling fully inverted (cursor-right drove the
 *   player left, cursor-up drove it down) until a player actually reported it.
 *
 * If the camera's tilt/position math in camera.ts ever changes again, re-derive this by running
 * `camera.matrixWorld.extractBasis(right, up, forward)` on the real camera and reading off
 * `right`'s and `up`'s world-space X/Z components — don't hand-derive it from the elevation
 * angle, and don't assume whichever sign convention "looks right" by inspection.
 */
export function computeDirectionFromPointer(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
): Vector2 {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const dx = clientX - centerX;
  const dz = clientY - centerY;

  const length = Math.hypot(dx, dz);
  if (length === 0) return { x: 0, z: 0 };

  return { x: -dx / length, z: -dz / length };
}

/**
 * Tracks the cursor via a single `pointermove` listener. Pointer Events already unify mouse,
 * pen, and touch-drag input in every supported browser, so this gives basic touch support for
 * free without a second `touchmove` handler — multi-touch gestures and tap-without-drag are
 * explicitly out of scope for this MVP, only single-pointer drag direction is read.
 *
 * No keyboard listeners anywhere in this class — this game has no skills to bind keys to.
 */
export class MouseInputAdapter implements IInputSource {
  private direction: Vector2 = { x: 0, z: 0 };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const rect = this.container.getBoundingClientRect();
    this.direction = computeDirectionFromPointer(event.clientX, event.clientY, rect);
  };

  constructor(private readonly container: HTMLElement) {
    this.container.addEventListener("pointermove", this.handlePointerMove);
  }

  getDirection(): Vector2 {
    return this.direction;
  }

  /**
   * Stops listening. Not part of IInputSource — session/UI calls this directly on teardown.
   * Intentionally unreachable in the current wiring (this app never tears down its one
   * long-lived instance) — kept alive by this class's own tests only, until the app gains a
   * real teardown path (HMR support, embeddable widget use case, etc.). Not dead code to
   * delete; a future lint/dead-code pass just won't have call-site context for it yet.
   */
  dispose(): void {
    this.container.removeEventListener("pointermove", this.handlePointerMove);
  }
}
