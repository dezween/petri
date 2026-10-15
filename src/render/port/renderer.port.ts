import type { WorldSnapshot } from "@/world/service/world.service";

/**
 * Contract the `session` module calls through. Deliberately free of any `three` import so
 * domain/session code never depends on rendering internals, and a no-op mock can stand in
 * for tests that don't need a real WebGL context.
 */
export interface IRenderer {
  /** Mounts the renderer's canvas into `container`. Called once, before the first `render()`. */
  init(container: HTMLElement): void;

  /** Called once per frame with the latest world state. */
  render(snapshot: WorldSnapshot): void;

  /** Called when the host element's size changes. */
  resize(width: number, height: number): void;

  /** Releases the renderer's resources (canvas, GPU buffers). */
  dispose(): void;
}
