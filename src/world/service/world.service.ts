import type { Vector2 } from "../domain/geometry";
import { isOverlapping } from "../domain/geometry";
import type { Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";
import type { Bot } from "../domain/bot.entity";
import type { Food } from "../domain/food.entity";
import {
  clampRadiusToCap,
  growMass,
  isAtVictoryCap,
  resolveEating,
} from "../domain/rules";

export const DEFAULT_ARENA_WIDTH = 1000;

/** Tunable: base player movement speed (units/sec) at mass=1. Tuned for real in task 027. */
const BASE_SPEED = 120;

export interface WorldSnapshot {
  player: Player;
  bots: Bot[];
  food: Food[];
  arenaWidth: number;
}

export interface TickResult {
  playerEaten: boolean;
  victoryReached: boolean;
}

/**
 * Owns the live, mutable game state and advances it one frame at a time.
 * The only module in this codebase with real domain orchestration — render/input/ui
 * never touch this state directly, they only ever see getSnapshot()'s plain copies.
 */
export class WorldService {
  private player: Player;
  private bots: Bot[];
  private food: Food[];
  private readonly arenaWidth: number;

  constructor(
    player: Player,
    bots: Bot[] = [],
    food: Food[] = [],
    arenaWidth: number = DEFAULT_ARENA_WIDTH,
  ) {
    this.player = player;
    this.bots = bots;
    this.food = food;
    this.arenaWidth = arenaWidth;
  }

  tick(deltaTime: number, playerInputDirection: Vector2): TickResult {
    this.movePlayer(deltaTime, playerInputDirection);
    this.moveBots(deltaTime);

    this.clampToArena(this.player);
    for (const bot of this.bots) this.clampToArena(bot);

    const playerEaten = this.resolveCollisions();

    this.player.radius = clampRadiusToCap(
      massToRadius(this.player.mass),
      this.arenaWidth,
    );
    const victoryReached = isAtVictoryCap(this.player.radius, this.arenaWidth);

    return { playerEaten, victoryReached };
  }

  getSnapshot(): WorldSnapshot {
    return {
      player: { ...this.player, position: { ...this.player.position } },
      bots: this.bots.map((bot) => ({ ...bot, position: { ...bot.position } })),
      food: this.food.map((f) => ({ ...f, position: { ...f.position } })),
      arenaWidth: this.arenaWidth,
    };
  }

  private movePlayer(deltaTime: number, direction: Vector2): void {
    const length = Math.hypot(direction.x, direction.z);
    if (length === 0) return;

    const normalized = { x: direction.x / length, z: direction.z / length };
    // Speed decreases as mass grows — simple inverse-sqrt relationship, tuned for real in 027.
    const speed = BASE_SPEED / Math.sqrt(Math.max(this.player.mass, 1));

    this.player.position.x += normalized.x * speed * deltaTime;
    this.player.position.z += normalized.z * speed * deltaTime;
  }

  private moveBots(_deltaTime: number): void {
    // Placeholder: real wanderer/hunter/fleer behaviors land in tasks 006-008.
    // Bots stay stationary for now — collision/eating logic below already works
    // correctly against stationary bots, so this is safe to defer.
  }

  private clampToArena(entity: { position: Vector2; radius: number }): void {
    const half = this.arenaWidth / 2;
    const min = -half + entity.radius;
    const max = half - entity.radius;
    entity.position.x = Math.min(Math.max(entity.position.x, min), max);
    entity.position.z = Math.min(Math.max(entity.position.z, min), max);
  }

  /** Returns true if the player was eaten this tick (caller should trigger Game Over). */
  private resolveCollisions(): boolean {
    let playerEaten = false;

    // Player vs bots.
    const eatenBotIds = new Set<string>();
    for (const bot of this.bots) {
      if (!isOverlapping(this.player, bot)) continue;
      const result = resolveEating(this.player, bot);
      if (!result) continue;
      if (result.eaten.id === this.player.id) {
        playerEaten = true;
        break;
      }
      this.player.mass = growMass(this.player.mass, bot.mass);
      this.player.radius = massToRadius(this.player.mass);
      eatenBotIds.add(bot.id);
    }
    this.bots = this.bots.filter((bot) => !eatenBotIds.has(bot.id));

    if (playerEaten) return true;

    // Player vs food.
    const eatenFoodIds = new Set<string>();
    for (const food of this.food) {
      if (!isOverlapping(this.player, food)) continue;
      this.player.mass = growMass(this.player.mass, food.mass);
      this.player.radius = massToRadius(this.player.mass);
      eatenFoodIds.add(food.id);
    }

    // Bot vs bot. Indices stay stable for the whole loop — removal is deferred to a
    // single filter at the end, since reassigning this.bots mid-loop would desync i/j.
    const eatenBotIds2 = new Set<string>();
    for (let i = 0; i < this.bots.length; i++) {
      for (let j = i + 1; j < this.bots.length; j++) {
        const a = this.bots[i];
        const b = this.bots[j];
        if (eatenBotIds2.has(a.id) || eatenBotIds2.has(b.id)) continue;
        if (!isOverlapping(a, b)) continue;
        const result = resolveEating(a, b);
        if (!result) continue;
        result.eater.mass = growMass(result.eater.mass, result.eaten.mass);
        result.eater.radius = massToRadius(result.eater.mass);
        eatenBotIds2.add(result.eaten.id);
      }
    }

    // Bot vs food.
    for (const bot of this.bots) {
      if (eatenBotIds2.has(bot.id)) continue;
      for (const food of this.food) {
        if (eatenFoodIds.has(food.id)) continue;
        if (!isOverlapping(bot, food)) continue;
        bot.mass = growMass(bot.mass, food.mass);
        bot.radius = massToRadius(bot.mass);
        eatenFoodIds.add(food.id);
      }
    }

    this.bots = this.bots.filter((bot) => !eatenBotIds2.has(bot.id));
    this.food = this.food.filter((food) => !eatenFoodIds.has(food.id));

    return false;
  }
}
