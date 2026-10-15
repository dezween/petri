import { describe, expect, it } from "vitest";
import {
  FoodSpawnerService,
  MIN_SPAWN_DISTANCE_FROM_ENTITY,
} from "./food-spawner.service";
import type { Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";
import type { Bot } from "../domain/bot.entity";

function makePlayer(position = { x: 0, z: 0 }): Player {
  return { id: "player", position, mass: 10, radius: massToRadius(10) };
}

function makeBot(position: { x: number; z: number }): Bot {
  return { id: "b1", position, mass: 5, radius: massToRadius(5), behavior: "wanderer" };
}

describe("FoodSpawnerService.spawnInitialFood", () => {
  it("scatters the configured target count immediately, with no delay", () => {
    const service = new FoodSpawnerService({ targetCount: 20, respawnDelaySeconds: 3 });
    const food = service.spawnInitialFood(1000, makePlayer(), []);

    expect(food).toHaveLength(20);
  });

  it("never spawns closer to the player or a bot than the configured minimum distance", () => {
    const service = new FoodSpawnerService({ targetCount: 30, respawnDelaySeconds: 3 });
    const player = makePlayer();
    const bots = [makeBot({ x: 100, z: 0 }), makeBot({ x: -100, z: 50 })];

    const food = service.spawnInitialFood(1000, player, bots);

    for (const f of food) {
      const dPlayer = Math.hypot(f.position.x - player.position.x, f.position.z - player.position.z);
      expect(dPlayer).toBeGreaterThanOrEqual(MIN_SPAWN_DISTANCE_FROM_ENTITY - 1e-9);
      for (const bot of bots) {
        const dBot = Math.hypot(f.position.x - bot.position.x, f.position.z - bot.position.z);
        expect(dBot).toBeGreaterThanOrEqual(MIN_SPAWN_DISTANCE_FROM_ENTITY - 1e-9);
      }
    }
  });
});

describe("FoodSpawnerService.spawnInitialFood — exhausted retries", () => {
  it("falls back to the last attempted candidate (not a crash/hang) once all spawn retries fail the min-distance-from-blockers check", () => {
    // An arena small enough that no point in the disk can ever be >= 150 units (the
    // configured MIN_SPAWN_DISTANCE_FROM_ENTITY) from a centered player — every one of the
    // 10 retry attempts must fail the distance check, exercising the documented fallback.
    const service = new FoodSpawnerService({ targetCount: 3, respawnDelaySeconds: 3 });
    const player = makePlayer({ x: 0, z: 0 });
    const tinyArenaWidth = 60; // max sample radius (~30) well under the 150 min distance

    const food = service.spawnInitialFood(tinyArenaWidth, player, []);

    expect(food).toHaveLength(3);
    for (const f of food) {
      expect(Number.isFinite(f.position.x)).toBe(true);
      expect(Number.isFinite(f.position.z)).toBe(true);
    }
  });
});

describe("FoodSpawnerService.spawnInitialFood — circular arena bound", () => {
  it("never spawns outside the arena's circular floor, even near the square bounding box's corners", () => {
    // Player/bots far from the arena center so the min-distance-from-blockers retry
    // logic doesn't itself bias food away from the corners — isolates the disk-sampling check.
    const service = new FoodSpawnerService({ targetCount: 150, respawnDelaySeconds: 3 });
    const arenaWidth = 1000;
    const player = makePlayer({ x: -10000, z: -10000 });

    const food = service.spawnInitialFood(arenaWidth, player, []);

    const arenaRadius = arenaWidth / 2;
    for (const f of food) {
      const distanceFromCenter = Math.hypot(f.position.x, f.position.z);
      expect(distanceFromCenter).toBeLessThanOrEqual(arenaRadius - f.radius + 1e-9);
    }
  });
});

describe("FoodSpawnerService.update — respawn", () => {
  it("schedules a respawn on deficit and spawns it once the delay elapses", () => {
    const service = new FoodSpawnerService({ targetCount: 1, respawnDelaySeconds: 3 });
    const player = makePlayer();

    expect(service.update([], player, [], 0.5, 1000)).toHaveLength(0); // deficit just detected
    expect(service.update([], player, [], 2, 1000)).toHaveLength(0); // 2.5s of 3s elapsed

    const ready = service.update([], player, [], 1, 1000); // tips it over the 3s delay
    expect(ready).toHaveLength(1);
  });

  it("does not schedule more respawns than the current deficit", () => {
    const service = new FoodSpawnerService({ targetCount: 2, respawnDelaySeconds: 3 });
    const player = makePlayer();
    const existingFood = [
      { id: "f1", position: { x: 0, z: 0 }, mass: 1, radius: massToRadius(1) },
    ];

    service.update(existingFood, player, [], 3, 1000); // schedules exactly 1 (deficit = 2-1-0)
    const spawned = service.update(existingFood, player, [], 3, 1000); // delay elapses

    expect(spawned).toHaveLength(1);
  });

  it("holds density roughly constant over many ticks of steady eating", () => {
    const service = new FoodSpawnerService({ targetCount: 10, respawnDelaySeconds: 1 });
    const player = makePlayer();
    let food = service.spawnInitialFood(1000, player, []);
    expect(food).toHaveLength(10);

    // Simulate 50 ticks of 0.5s each, eating one food item every tick — density should
    // never trend to zero (always catching up via scheduled respawns) nor runaway-grow
    // (update() only ever tops up to exactly the deficit).
    for (let tick = 0; tick < 50; tick++) {
      if (food.length > 0) food = food.slice(1); // "eat" one
      const spawned = service.update(food, player, [], 0.5, 1000);
      food = [...food, ...spawned];
      expect(food.length).toBeLessThanOrEqual(10);
    }

    expect(food.length).toBeGreaterThan(0);
  });
});
