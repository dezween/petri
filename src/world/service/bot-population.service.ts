import type { Vector2 } from "../domain/geometry";
import { randomPointInDisk } from "../domain/geometry";
import { massToRadius } from "../domain/cell.entity";
import type { Player } from "../domain/cell.entity";
import type { Bot, BotBehavior } from "../domain/bot.entity";

/** Starting mass for every freshly spawned bot. Not revisited during the 027 balance pass — still a rough guess, revisit if real playtesting suggests otherwise. */
export const INITIAL_BOT_MASS = 5;

/**
 * Minimum distance a freshly (re)spawned bot must land from the player, so a respawn never
 * ambushes someone standing still. Balance pass (027): bumped from 150 — RADIUS_PER_MASS_SQRT
 * (cell.entity.ts) settled at 8 (an intermediate overshoot attempt during 027 briefly tried 24,
 * see cell.entity.ts for the full history), at which starting player + bot radii alone
 * (massToRadius(INITIAL_PLAYER_MASS) + massToRadius(INITIAL_BOT_MASS)) sum to ~58 units,
 * leaving almost no buffer at the old value.
 */
export const MIN_SPAWN_DISTANCE_FROM_PLAYER = 250;

export interface PopulationThreshold {
  /** Player mass at/above which this tier applies. */
  mass: number;
  totalCount: number;
  /** Fraction of the population that should be hunters; the remainder splits evenly between wanderer/fleer. */
  hunterRatio: number;
}

export interface PopulationConfig {
  respawnDelaySeconds: number;
  /** Must be sorted ascending by `mass`. The highest tier whose `mass` the player has reached applies. */
  thresholds: PopulationThreshold[];
}

/**
 * Named, tunable thresholds per task 009. Not revisited during the 027 balance pass — these
 * specific numbers are still a rough guess, revisit if real playtesting suggests otherwise.
 * Three tiers: a light start, a mid-game bump in both count and hunter aggressiveness, and a
 * late-game tier for a maxed-out player.
 */
export const DEFAULT_POPULATION_CONFIG: PopulationConfig = {
  respawnDelaySeconds: 3,
  thresholds: [
    { mass: 0, totalCount: 15, hunterRatio: 1 / 3 },
    { mass: 50, totalCount: 20, hunterRatio: 0.4 },
    { mass: 150, totalCount: 25, hunterRatio: 0.5 },
  ],
};

/**
 * Owns bot spawn/despawn decisions: initial population, respawn-after-eaten (with a
 * delay), and scaling count/hunter-ratio as the player's mass crosses thresholds.
 * `world.service.ts` holds live bot state; this service only decides what to add.
 */
export class BotPopulationService {
  private pendingRespawnTimers: number[] = [];
  private nextId = 0;

  constructor(
    private readonly config: PopulationConfig = DEFAULT_POPULATION_CONFIG,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Immediate, delay-free spawn for session start — no reason to make the player wait out the respawn delay just to see the initial population. */
  spawnInitialBots(arenaWidth: number, player: Player): Bot[] {
    const target = this.targetFor(player.mass);
    const bots: Bot[] = [];
    for (let i = 0; i < target.totalCount; i++) {
      bots.push(this.spawnOne(this.pickBehavior(target.hunterRatio), arenaWidth, player));
    }
    return bots;
  }

  /**
   * Call once per tick. Advances pending respawn timers, tops up the pending queue
   * whenever live+pending falls short of the current target, and returns any bots whose
   * timer has elapsed this call (for the caller to append to its live bot list).
   */
  update(currentBots: Bot[], player: Player, deltaTime: number, arenaWidth: number): Bot[] {
    this.pendingRespawnTimers = this.pendingRespawnTimers.map((t) => t - deltaTime);

    const target = this.targetFor(player.mass);
    const deficit = target.totalCount - currentBots.length - this.pendingRespawnTimers.length;
    for (let i = 0; i < deficit; i++) {
      this.pendingRespawnTimers.push(this.config.respawnDelaySeconds);
    }

    const readyCount = this.pendingRespawnTimers.filter((t) => t <= 0).length;
    this.pendingRespawnTimers = this.pendingRespawnTimers.filter((t) => t > 0);

    const spawned: Bot[] = [];
    for (let i = 0; i < readyCount; i++) {
      spawned.push(this.spawnOne(this.pickBehavior(target.hunterRatio), arenaWidth, player));
    }
    return spawned;
  }

  private targetFor(playerMass: number): PopulationThreshold {
    let best = this.config.thresholds[0]!;
    for (const tier of this.config.thresholds) {
      if (playerMass >= tier.mass && tier.mass >= best.mass) best = tier;
    }
    return best;
  }

  private pickBehavior(hunterRatio: number): BotBehavior {
    const roll = this.rng();
    if (roll < hunterRatio) return "hunter";
    return roll < hunterRatio + (1 - hunterRatio) / 2 ? "wanderer" : "fleer";
  }

  private spawnOne(behavior: BotBehavior, arenaWidth: number, player: Player): Bot {
    return {
      id: `bot-${this.nextId++}`,
      position: this.randomSpawnPosition(arenaWidth, player),
      mass: INITIAL_BOT_MASS,
      radius: massToRadius(INITIAL_BOT_MASS),
      behavior,
    };
  }

  /**
   * Samples within the arena's circular floor (not its bounding square) — see
   * `randomPointInDisk`'s doc comment for why a bot spawned in a square "corner" would
   * visually float outside the rendered dish.
   */
  private randomSpawnPosition(arenaWidth: number, player: Player): Vector2 {
    const maxRadius = Math.max(arenaWidth / 2 - massToRadius(INITIAL_BOT_MASS), 0);
    let candidate: Vector2 = { x: 0, z: 0 };
    for (let attempt = 0; attempt < 10; attempt++) {
      candidate = randomPointInDisk(this.rng, maxRadius);
      const dx = candidate.x - player.position.x;
      const dz = candidate.z - player.position.z;
      if (Math.hypot(dx, dz) >= MIN_SPAWN_DISTANCE_FROM_PLAYER) return candidate;
    }
    // Exhausted retries (tiny arena or a maxed-out player eating most of the map) — accept
    // the last attempt rather than looping forever.
    return candidate;
  }
}
