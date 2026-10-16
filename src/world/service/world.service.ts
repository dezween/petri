import type { Vector2 } from "../domain/geometry";
import { isOverlapping } from "../domain/geometry";
import type { Cell, Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";
import type { Bot, BotBehavior } from "../domain/bot.entity";
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

/**
 * Tunable: base player movement speed (units/sec) at mass=1. Raised 20x (120 -> 2400) after a
 * real player reported the original value made the game feel like "watching a cartoon" (see
 * the commit that shipped that change for the measured before/after crossing-time numbers),
 * then halved again (2400 -> 1200) after the same player found 2400 too fast in real play.
 * Net ~10x over the original.
 */
const BASE_SPEED = 1200;

/** Tunable: base bot movement speed (units/sec) at mass=1 — kept at the same ~83% ratio to
 * BASE_SPEED as before the speed-up, so an equal-mass chase is still survivable. */
const BOT_BASE_SPEED = 1000;

export interface WorldSnapshot {
  player: Player;
  bots: Bot[];
  food: Food[];
  arenaWidth: number;
}

/**
 * One eat occurrence this tick, generic across who ate whom — not just the player's own eats —
 * so a future consumer (e.g. particle triggers) doesn't need a second, competing hook.
 * `position` is the eaten entity's position at the moment it was eaten (for spawning an effect
 * there); `eatenBehavior` is set only when `eatenType === "bot"`, so a consumer can color/style
 * the effect per bot personality rather than a single generic look.
 */
export interface EatenEvent {
  eaterId: string;
  eaterType: "player" | "bot";
  eatenId: string;
  eatenType: "player" | "bot" | "food";
  position: Vector2;
  eatenBehavior?: BotBehavior;
}

export interface TickResult {
  playerEaten: boolean;
  victoryReached: boolean;
  eatenEvents: EatenEvent[];
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

    const { playerEaten, eatenEvents } = this.resolveCollisions();

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

    return { playerEaten, victoryReached, eatenEvents };
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

  /** Speed decreases as mass grows — simple inverse-sqrt relationship. Not revisited during the 027 balance pass — still a rough guess, revisit if real playtesting suggests otherwise. Shared by player and bot movement so both scale the same way. */
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
   * 24 (an intermediate overshoot attempt made during the 027 balance pass — the value that
   * actually settled is 8, see cell.entity.ts for the full tuning history; a ~5 unit gain per
   * food at R=24) it became a severe correctness bug: a Playwright playtest showed a fresh bot
   * reaching mass 30+ within about a second of session start, purely from chain-eating a food
   * cluster, nowhere near real movement time.
   *
   * Bug fix (follow-up): the same cascade risk existed on the *mass* side and was missed by
   * the original 027 fix — `resolveEating()` was still being called with live, already-mutated
   * `mass`, so a simultaneous multi-entity overlap (e.g. two bots overlapping the player in one
   * tick) had an eat/die outcome that depended on iteration order of `this.bots` (whichever bot
   * got evaluated first could tip the player's mass over the second bot's mass, or not, purely
   * by array order). `mass` is now frozen alongside `radius` and the frozen snapshot is used
   * for every `resolveEating()` *decision* — growth is still applied to the live object so mass
   * correctly accumulates across multiple eats within the same tick, that part was never wrong.
   *
   * Bug fix (second follow-up): the `playerEaten` boolean above was order-independent (fixed),
   * but the *final mass* shown on Game Over and *which* `EatenEvent`s fire were not — the old
   * single-pass loop applied growth/events for bots processed before the fatal one was reached,
   * then `break`d, so `bots = [smaller, bigger]` grew the player's mass (and fired an eat-bot
   * event) before dying, while `bots = [bigger, smaller]` died immediately with neither. Fixed
   * by splitting into two passes over the frozen snapshot: first, determine (without mutating
   * anything) whether *any* bot defeats the player this tick; if so, the player dies with no
   * growth/events applied at all this tick, regardless of array order. Only if no bot kills the
   * player does the second pass apply growth — which was already order-independent on its own,
   * since each decision and `growMass` are already commutative given the frozen snapshot.
   */
  private resolveCollisions(): { playerEaten: boolean; eatenEvents: EatenEvent[] } {
    const eatenEvents: EatenEvent[] = [];
    const startRadius = new Map<string, number>();
    const startMass = new Map<string, number>();
    startRadius.set(this.player.id, this.player.radius);
    startMass.set(this.player.id, this.player.mass);
    for (const bot of this.bots) {
      startRadius.set(bot.id, bot.radius);
      startMass.set(bot.id, bot.mass);
    }
    const frozen = (entity: Cell): Cell => {
      const radius = startRadius.get(entity.id);
      const mass = startMass.get(entity.id);
      return radius === undefined || mass === undefined
        ? entity
        : { ...entity, radius, mass };
    };

    // Player vs bots. Eating decisions use the frozen (start-of-tick) mass/radius snapshot
    // so the outcome can't depend on which bot happens to be evaluated first; growth is still
    // applied to the live `this.player`/`bot` objects so it accumulates across multiple eats.
    //
    // First pass (read-only): does any bot defeat the player this tick? Checked before any
    // mutation so that, for a simultaneous multi-bot overlap, the player's death — and the
    // fact that no growth/eat-events are applied this tick — never depends on `this.bots`'
    // iteration order.
    const frozenPlayer = frozen(this.player);
    const killerBot = this.bots.find((bot) => {
      const frozenBot = frozen(bot);
      if (!isOverlapping(frozenPlayer, frozenBot)) return false;
      const result = resolveEating(frozenPlayer, frozenBot);
      return result?.eaten.id === this.player.id;
    });
    if (killerBot) {
      return { playerEaten: true, eatenEvents: [] };
    }

    // Second pass: no bot kills the player this tick, so it's safe to apply growth for every
    // bot the player overlaps and beats. This was already order-independent on its own (each
    // decision reads the frozen snapshot, and growMass is commutative), so a single pass here
    // is fine now that the fatal case above is handled separately.
    const eatenBotIds = new Set<string>();
    for (const bot of this.bots) {
      const frozenBot = frozen(bot);
      if (!isOverlapping(frozenPlayer, frozenBot)) continue;
      const result = resolveEating(frozenPlayer, frozenBot);
      if (!result) continue;
      this.player.mass = growMass(this.player.mass, bot.mass);
      this.player.radius = massToRadius(this.player.mass);
      eatenBotIds.add(bot.id);
      eatenEvents.push({
        eaterId: this.player.id,
        eaterType: "player",
        eatenId: bot.id,
        eatenType: "bot",
        position: { ...bot.position },
        eatenBehavior: bot.behavior,
      });
    }
    this.bots = this.bots.filter((bot) => !eatenBotIds.has(bot.id));

    // Player vs food (food has no entry in startRadius, so frozen() passes it through as-is
    // — food's radius never changes mid-resolution, only the eater's does).
    const eatenFoodIds = new Set<string>();
    for (const food of this.food) {
      if (!isOverlapping(frozenPlayer, food)) continue;
      this.player.mass = growMass(this.player.mass, food.mass);
      this.player.radius = massToRadius(this.player.mass);
      eatenFoodIds.add(food.id);
      eatenEvents.push({
        eaterId: this.player.id,
        eaterType: "player",
        eatenId: food.id,
        eatenType: "food",
        position: { ...food.position },
      });
    }

    // Bot vs bot. Indices stay stable for the whole loop — removal is deferred to a
    // single filter at the end, since reassigning this.bots mid-loop would desync i/j.
    const eatenBotIds2 = new Set<string>();
    for (let i = 0; i < this.bots.length; i++) {
      for (let j = i + 1; j < this.bots.length; j++) {
        const a = this.bots[i];
        const b = this.bots[j];
        if (eatenBotIds2.has(a.id) || eatenBotIds2.has(b.id)) continue;
        const frozenA = frozen(a);
        const frozenB = frozen(b);
        if (!isOverlapping(frozenA, frozenB)) continue;
        const result = resolveEating(frozenA, frozenB);
        if (!result) continue;
        // Map the frozen eater/eaten back to the live `a`/`b` objects by id so growth is
        // applied to (and future ticks see) the real mutable entity, not the frozen copy.
        const eater = result.eater.id === a.id ? a : b;
        const eaten = result.eater.id === a.id ? b : a;
        eater.mass = growMass(eater.mass, eaten.mass);
        eater.radius = clampRadiusToCap(massToRadius(eater.mass), this.arenaWidth);
        eatenBotIds2.add(eaten.id);
        eatenEvents.push({
          eaterId: eater.id,
          eaterType: "bot",
          eatenId: eaten.id,
          eatenType: "bot",
          position: { ...eaten.position },
          eatenBehavior: eaten.behavior,
        });
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
        bot.radius = clampRadiusToCap(massToRadius(bot.mass), this.arenaWidth);
        eatenFoodIds.add(food.id);
        eatenEvents.push({
          eaterId: bot.id,
          eaterType: "bot",
          eatenId: food.id,
          eatenType: "food",
          position: { ...food.position },
        });
      }
    }

    this.bots = this.bots.filter((bot) => !eatenBotIds2.has(bot.id));
    this.food = this.food.filter((food) => !eatenFoodIds.has(food.id));

    return { playerEaten: false, eatenEvents };
  }
}
