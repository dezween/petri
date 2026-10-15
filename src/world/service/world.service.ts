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
        return fleerMove(bot, this.othersFor(bot), deltaTime);
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

  /**
   * The arena is a circular dish (see render/adapter/three/scene.ts's floor/rim), not a
   * square, so the boundary must be enforced radially from the center — clamping x and z
   * independently would let an entity sit in a square "corner" that's outside the visible
   * circular floor, with its mesh floating past the rendered rim. Clamps the entity's
   * *edge* (center distance + radius), not just its center point, so large cells don't
   * visually clip through the rim either.
   */
  private clampToArena(entity: { position: Vector2; radius: number }): void {
    const arenaRadius = this.arenaWidth / 2;
    const maxDistanceFromCenter = Math.max(arenaRadius - entity.radius, 0);
    const distanceFromCenter = Math.hypot(entity.position.x, entity.position.z);
    if (distanceFromCenter > maxDistanceFromCenter && distanceFromCenter > 0) {
      const scale = maxDistanceFromCenter / distanceFromCenter;
      entity.position.x *= scale;
      entity.position.z *= scale;
    }
  }

  /**
   * Returns true if the player was eaten this tick (caller should trigger Game Over).
   *
   * Bug fix (027): every `isOverlapping` check below uses a `radius` captured at the *start*
   * of this call (`startRadius`/frozen `Circle`s), never an entity's live, already-updated
   * radius. Originally each sub-loop grew `entity.radius` immediately after an eat and kept
   * scanning the same list with that larger radius — letting one bot's growing reach cascade
   * through a whole cluster of food in a single tick. That was mostly invisible at the old
   * RADIUS_PER_MASS_SQRT=2 (a radius gain of ~0.4 units per food), but after retuning it to
   * 24 for the 027 balance pass (a ~5 unit gain per food) it became a severe correctness bug:
   * a Playwright playtest showed a fresh bot reaching mass 30+ within about a second of
   * session start, purely from chain-eating a food cluster, nowhere near real movement time.
   * Mass still accumulates correctly across multiple eats in one tick (that part was never
   * wrong) — only the radius used for *this tick's* overlap checks is now stable throughout.
   */
  private resolveCollisions(): boolean {
    let playerEaten = false;
    const startRadius = new Map<string, number>();
    startRadius.set(this.player.id, this.player.radius);
    for (const bot of this.bots) startRadius.set(bot.id, bot.radius);
    const frozen = (entity: Cell): Cell => {
      const radius = startRadius.get(entity.id);
      return radius === undefined ? entity : { ...entity, radius };
    };

    // Player vs bots.
    const eatenBotIds = new Set<string>();
    const frozenPlayer = frozen(this.player);
    for (const bot of this.bots) {
      if (!isOverlapping(frozenPlayer, frozen(bot))) continue;
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

    // Player vs food (food has no entry in startRadius, so frozen() passes it through as-is
    // — food's radius never changes mid-resolution, only the eater's does).
    const eatenFoodIds = new Set<string>();
    for (const food of this.food) {
      if (!isOverlapping(frozenPlayer, food)) continue;
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
        if (!isOverlapping(frozen(a), frozen(b))) continue;
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
      const frozenBot = frozen(bot);
      for (const food of this.food) {
        if (eatenFoodIds.has(food.id)) continue;
        if (!isOverlapping(frozenBot, food)) continue;
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
