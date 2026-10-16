import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import type { EatenEvent, WorldService, WorldSnapshot } from "@/world/service/world.service";

export interface GameLoopCallbacks {
  onPlayerEaten?: () => void;
  onVictoryReached?: () => void;
  /** Fired every frame with the same snapshot passed to the renderer — e.g. for a HUD to read live mass. */
  onTick?: (snapshot: WorldSnapshot) => void;
  /** Fired once per eat occurrence reported by a tick's TickResult.eatenEvents — includes every eater/eaten pair (player or bot), not just the player's own eats, so SFX (Epic 2 task 004) and particle triggers (task 009) can share one hook instead of each building a competing one. */
  onEntityEaten?: (event: EatenEvent) => void;
}

/**
 * Abstraction over requestAnimationFrame/cancelAnimationFrame so tests can drive the loop with
 * a fake clock instead of depending on a real browser frame scheduler.
 */
export interface AnimationScheduler {
  requestFrame(callback: (timestamp: number) => void): number;
  cancelFrame(handle: number): void;
}

const browserScheduler: AnimationScheduler = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

/**
 * The first point where input, world, and render meet. Each frame: read input -> tick the
 * world -> render the result. Doesn't own UI state transitions (task 018's job) — it only
 * reports a death/victory-cap occurrence once each via callbacks and keeps running until the
 * caller explicitly calls stop() (e.g. from inside one of those callbacks).
 */
export class GameLoopService {
  private rafHandle: number | null = null;
  private lastTimestamp: number | null = null;
  private hasFiredPlayerEaten = false;
  private hasFiredVictory = false;

  constructor(
    private readonly inputSource: IInputSource,
    private readonly worldService: WorldService,
    private readonly renderer: IRenderer,
    private readonly callbacks: GameLoopCallbacks = {},
    private readonly scheduler: AnimationScheduler = browserScheduler,
  ) {}

  start(): void {
    if (this.rafHandle !== null) return; // already running
    this.lastTimestamp = null;
    this.hasFiredPlayerEaten = false;
    this.hasFiredVictory = false;
    this.rafHandle = this.scheduler.requestFrame(this.tick);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      this.scheduler.cancelFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastTimestamp = null;
  }

  get isRunning(): boolean {
    return this.rafHandle !== null;
  }

  private readonly tick = (timestamp: number): void => {
    // No prior frame to diff against yet — tick with zero movement rather than guessing.
    const deltaTime = this.lastTimestamp === null ? 0 : (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const direction = this.inputSource.getDirection();
    const result = this.worldService.tick(deltaTime, direction);
    const snapshot = this.worldService.getSnapshot();
    this.renderer.render(snapshot);
    this.callbacks.onTick?.(snapshot);
    for (const event of result.eatenEvents) this.callbacks.onEntityEaten?.(event);

    // Structurally exclusive regardless of what TickResult says: today this is unreachable
    // in practice (playerEaten requires the player to be the smaller cell in a collision,
    // victoryReached requires the player's radius to already be at the arena cap — an
    // implicit game-rule invariant WorldService enforces, not something this loop or the
    // state machine itself guarantees). Guarding here too means a future WorldService change
    // that violates that invariant can't silently fire both callbacks in the same tick and
    // transition GameOver -> Victory within one synchronous call.
    if (result.playerEaten && !this.hasFiredPlayerEaten) {
      this.hasFiredPlayerEaten = true;
      this.callbacks.onPlayerEaten?.();
    } else if (result.victoryReached && !this.hasFiredVictory) {
      this.hasFiredVictory = true;
      this.callbacks.onVictoryReached?.();
    }

    this.rafHandle = this.scheduler.requestFrame(this.tick);
  };
}
