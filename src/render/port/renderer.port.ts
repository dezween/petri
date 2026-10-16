import type { WorldSnapshot } from "@/world/service/world.service";
import type { Vector2 } from "@/world/domain/geometry";

/**
 * Contract the `session` module calls through. Deliberately free of any `three` import so
 * domain/session code never depends on rendering internals, and a no-op mock can stand in
 * for tests that don't need a real WebGL context.
 */
export interface IRenderer {
  /** Mounts the renderer's canvas into `container`. Called once, before the first `render()`. */
  init(container: HTMLElement): void;

  /** Called once per frame with the latest world state and the frame's deltaTime in seconds
   * (the same value just passed to `WorldService.tick()` — reused rather than the renderer
   * keeping its own clock, so a particle system's aging can't drift from the game's own
   * timing). */
  render(snapshot: WorldSnapshot, deltaTime: number): void;

  /** Spawns a short-lived particle burst at `position`, tinted `color` (a `0xRRGGBB` hex
   * integer — Epic 2, task 008/009). Fire-and-forget: the renderer owns the burst's whole
   * lifecycle internally from here, aged out automatically on subsequent `render()` calls. */
  spawnEatBurst(position: Vector2, color: number): void;

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
