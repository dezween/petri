import type { Vector2 } from "../domain/geometry";
import { isOverlapping } from "../domain/geometry";
import type { Cell, Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";
import type { Bot } from "../domain/bot.entity";
import type { Food } from "../domain/food.entity";
import {
  clampRadiusToCap,
  growMass,
  isAtVictoryCap,
  resolveEating,
} from "../domain/rules";
import type { PositionedMass } from "../domain/bot-ai/types";
import { wandererMove } from "../domain/bot-ai/wanderer";
import { hunterMove } from "../domain/bot-ai/hunter";
import { fleerMove } from "../domain/bot-ai/fleer";
import { BotPopulationService } from "./bot-population.service";
import { FoodSpawnerService } from "./food-spawner.service";

export const DEFAULT_ARENA_WIDTH = 1000;

/** Tunable: base player movement speed (units/sec) at mass=1. Tuned for real in task 027. */
const BASE_SPEED = 120;

/** Tunable: base bot movement speed (units/sec) at mass=1 — slightly slower than the player so an equal-mass chase is survivable. Tuned for real in task 027. */
const BOT_BASE_SPEED = 100;

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
    private readonly populationService?: BotPopulationService,
    private readonly foodSpawnerService?: FoodSpawnerService,
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

    if (this.populationService) {
      const spawned = this.populationService.update(
        this.bots,
        this.player,
        deltaTime,
        this.arenaWidth,
      );
      if (spawned.length > 0) this.bots.push(...spawned);
    }

    if (this.foodSpawnerService) {
      const spawned = this.foodSpawnerService.update(
        this.food,
        this.player,
        this.bots,
        deltaTime,
        this.arenaWidth,
      );
      if (spawned.length > 0) this.food.push(...spawned);
    }

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
    this.applyMovement(this.player, direction, deltaTime, BASE_SPEED);
  }

  private moveBots(deltaTime: number): void {
    for (const bot of this.bots) {
      const direction = this.computeBotDirection(bot, deltaTime);
      this.applyMovement(bot, direction, deltaTime, BOT_BASE_SPEED);
    }
  }

  private computeBotDirection(bot: Bot, deltaTime: number): Vector2 {
    switch (bot.behavior) {
      case "wanderer":
        return wandererMove(bot, this.food, deltaTime);
      case "hunter":
        return hunterMove(bot, this.othersFor(bot), deltaTime);
      case "fleer":
        return fleerMove(bot, this.othersFor(bot), this.arenaWidth, deltaTime);
    }
  }

  /** Player + every other bot + all food, as the generic PositionedMass shape bot AI steers against. */
  private othersFor(bot: Bot): PositionedMass[] {
    return [this.player, ...this.bots.filter((b) => b.id !== bot.id), ...this.food];
  }

  /** Speed decreases as mass grows — simple inverse-sqrt relationship, tuned for real in 027. Shared by player and bot movement so both scale the same way. */
  private applyMovement(
    entity: Cell,
    direction: Vector2,
    deltaTime: number,
    baseSpeed: number,
  ): void {
    const length = Math.hypot(direction.x, direction.z);
    if (length === 0) return;

    const normalized = { x: direction.x / length, z: direction.z / length };
    const speed = baseSpeed / Math.sqrt(Math.max(entity.mass, 1));

    entity.position.x += normalized.x * speed * deltaTime;
    entity.position.z += normalized.z * speed * deltaTime;
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
