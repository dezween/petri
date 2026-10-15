import type { Vector2 } from "../domain/geometry";
import type { Player } from "../domain/cell.entity";
import type { Bot } from "../domain/bot.entity";
import type { Food } from "../domain/food.entity";
import { createFood } from "../domain/food.entity";

/** Target food count across the arena — the steady-density knob. Tuned for real in task 027. */
export const TARGET_FOOD_COUNT = 150;

/** Seconds between a food particle being eaten and its replacement appearing. Tuned for real in task 027. */
export const FOOD_RESPAWN_DELAY_SECONDS = 2;

/** Minimum distance a freshly spawned food particle must land from the player or any bot, so it never spawns already-overlapping something that would eat it instantly off-screen. */
export const MIN_SPAWN_DISTANCE_FROM_ENTITY = 40;

export interface FoodSpawnerConfig {
  targetCount: number;
  respawnDelaySeconds: number;
}

export const DEFAULT_FOOD_SPAWNER_CONFIG: FoodSpawnerConfig = {
  targetCount: TARGET_FOOD_COUNT,
  respawnDelaySeconds: FOOD_RESPAWN_DELAY_SECONDS,
};

/**
 * Owns food spawn/respawn decisions: initial scatter at session start, and a steady
 * trickle of replacements as food gets eaten, so density stays roughly constant instead
 * of trending to zero. `world.service.ts` holds the live food array; this service only
 * decides what to add.
 */
export class FoodSpawnerService {
  private pendingRespawnTimers: number[] = [];
  private nextId = 0;

  constructor(
    private readonly config: FoodSpawnerConfig = DEFAULT_FOOD_SPAWNER_CONFIG,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Immediate, delay-free scatter for session start — no reason to make the player wait out the respawn delay just to see the initial food. */
  spawnInitialFood(arenaWidth: number, player: Player, bots: Bot[]): Food[] {
    const food: Food[] = [];
    for (let i = 0; i < this.config.targetCount; i++) {
      food.push(this.spawnOne(arenaWidth, player, bots));
    }
    return food;
  }

  /**
   * Call once per tick. Advances pending respawn timers, tops up the pending queue
   * whenever live+pending falls short of the target density, and returns any food whose
   * timer has elapsed this call (for the caller to append to its live food list).
   */
  update(currentFood: Food[], player: Player, bots: Bot[], deltaTime: number, arenaWidth: number): Food[] {
    this.pendingRespawnTimers = this.pendingRespawnTimers.map((t) => t - deltaTime);

    const deficit = this.config.targetCount - currentFood.length - this.pendingRespawnTimers.length;
    for (let i = 0; i < deficit; i++) {
      this.pendingRespawnTimers.push(this.config.respawnDelaySeconds);
    }

    const readyCount = this.pendingRespawnTimers.filter((t) => t <= 0).length;
    this.pendingRespawnTimers = this.pendingRespawnTimers.filter((t) => t > 0);

    const spawned: Food[] = [];
    for (let i = 0; i < readyCount; i++) {
      spawned.push(this.spawnOne(arenaWidth, player, bots));
    }
    return spawned;
  }

  private spawnOne(arenaWidth: number, player: Player, bots: Bot[]): Food {
    return createFood(`food-${this.nextId++}`, this.randomSpawnPosition(arenaWidth, player, bots));
  }

  private randomSpawnPosition(arenaWidth: number, player: Player, bots: Bot[]): Vector2 {
    const half = arenaWidth / 2;
    let candidate: Vector2 = { x: 0, z: 0 };
    for (let attempt = 0; attempt < 10; attempt++) {
      candidate = {
        x: (this.rng() * 2 - 1) * half,
        z: (this.rng() * 2 - 1) * half,
      };
      if (this.isClearOfBlockers(candidate, player, bots)) return candidate;
    }
    // Exhausted retries (tiny arena or a very crowded one) — accept the last attempt
    // rather than looping forever.
    return candidate;
  }

  private isClearOfBlockers(position: Vector2, player: Player, bots: Bot[]): boolean {
    if (distance(position, player.position) < MIN_SPAWN_DISTANCE_FROM_ENTITY) return false;
    for (const bot of bots) {
      if (distance(position, bot.position) < MIN_SPAWN_DISTANCE_FROM_ENTITY) return false;
    }
    return true;
  }
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
