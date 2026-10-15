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
 * Screen-right maps to world +x and screen-down maps to world +z — this matches the
 * top-down camera's up=(0,0,-1) orientation (see render/adapter/three/camera.ts), where
 * screen-up corresponds to world -z.
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

  return { x: dx / length, z: dz / length };
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

  /** Stops listening. Not part of IInputSource — session/UI calls this directly on teardown. */
  dispose(): void {
    this.container.removeEventListener("pointermove", this.handlePointerMove);
  }
}
