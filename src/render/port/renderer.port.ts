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

  /**
   * Reconfigures the rendered arena's dimension after construction (Epic 2, task 001). The
   * renderer is a construction-time singleton (built once in `bootstrap.ts`, before any
   * menu/size choice exists) — unlike `WorldService`, which gets freshly reconstructed with a
   * chosen width on every Play/Restart, there was no way to keep the renderer's drawn arena in
   * sync with a size picked after startup until this method existed. Implementations must
   * rebuild only the arena-dimension-dependent visuals (the floor/rim) in place, not the whole
   * scene/camera/renderer.
   */
  setArenaWidth(width: number): void;

  /** Releases the renderer's resources (canvas, GPU buffers). */
  dispose(): void;
}
