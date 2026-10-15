import { describe, expect, it } from "vitest";
import {
  BotPopulationService,
  DEFAULT_POPULATION_CONFIG,
  INITIAL_BOT_MASS,
} from "./bot-population.service";
import type { Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";

function makePlayer(mass = 10): Player {
  return { id: "player", position: { x: 0, z: 0 }, mass, radius: massToRadius(mass) };
}

describe("BotPopulationService.spawnInitialBots", () => {
  it("spawns the configured initial count at the configured starting mass", () => {
    const service = new BotPopulationService();
    const bots = service.spawnInitialBots(1000, makePlayer());

    expect(bots).toHaveLength(DEFAULT_POPULATION_CONFIG.thresholds[0]!.totalCount);
    for (const bot of bots) expect(bot.mass).toBe(INITIAL_BOT_MASS);
  });

  it("respects hunterRatio deterministically across the roll range", () => {
    // A constant rng (rather than a cycling one) stays deterministic regardless of how
    // many internal calls (position retries, etc.) happen between behavior rolls.
    const behaviorFor = (constantRoll: number) => {
      const service = new BotPopulationService(
        { respawnDelaySeconds: 3, thresholds: [{ mass: 0, totalCount: 1, hunterRatio: 1 / 3 }] },
        () => constantRoll,
      );
      return service.spawnInitialBots(1000, makePlayer())[0]!.behavior;
    };

    expect(behaviorFor(0.05)).toBe("hunter"); // low roll, < hunterRatio
    expect(behaviorFor(0.5)).toBe("wanderer"); // mid roll
    expect(behaviorFor(0.95)).toBe("fleer"); // high roll
  });

  it("never spawns closer to the player than the configured minimum distance", () => {
    const service = new BotPopulationService();
    const player = makePlayer();

    const bots = service.spawnInitialBots(1000, player);

    for (const bot of bots) {
      const d = Math.hypot(bot.position.x - player.position.x, bot.position.z - player.position.z);
      expect(d).toBeGreaterThanOrEqual(150 - 1e-9);
    }
  });

  it("never spawns outside the arena's circular floor, even near the square bounding box's corners", () => {
    // Player far from the arena center so the min-distance-from-player retry logic
    // doesn't itself bias bots away from the corners — isolates the disk-sampling check.
    const service = new BotPopulationService(
      { respawnDelaySeconds: 3, thresholds: [{ mass: 0, totalCount: 100, hunterRatio: 1 / 3 }] },
    );
    const arenaWidth = 1000;
    const player = makePlayer();
    player.position = { x: -10000, z: -10000 };

    const bots = service.spawnInitialBots(arenaWidth, player);

    const arenaRadius = arenaWidth / 2;
    for (const bot of bots) {
      const distanceFromCenter = Math.hypot(bot.position.x, bot.position.z);
      expect(distanceFromCenter).toBeLessThanOrEqual(arenaRadius - bot.radius + 1e-9);
    }
  });
});

describe("BotPopulationService.update — respawn", () => {
  it("schedules a respawn on deficit and spawns it once the delay elapses", () => {
    const service = new BotPopulationService(
      { respawnDelaySeconds: 3, thresholds: [{ mass: 0, totalCount: 1, hunterRatio: 0 }] },
      () => 0.1, // hunterRatio is 0, and 0.1 < 0.5 -> deterministically "wanderer"
    );
    const player = makePlayer();

    expect(service.update([], player, 0.5, 1000)).toHaveLength(0); // deficit just detected
    expect(service.update([], player, 2, 1000)).toHaveLength(0); // 2.5s of 3s elapsed

    const ready = service.update([], player, 1, 1000); // tips it over the 3s delay
    expect(ready).toHaveLength(1);
    expect(ready[0]!.behavior).toBe("wanderer");
  });

  it("does not schedule more respawns than the current deficit", () => {
    const service = new BotPopulationService(
      { respawnDelaySeconds: 3, thresholds: [{ mass: 0, totalCount: 2, hunterRatio: 0 }] },
      () => 0.1,
    );
    const player = makePlayer();
    const existingBot = {
      id: "b1",
      position: { x: 0, z: 0 },
      mass: 5,
      radius: massToRadius(5),
      behavior: "wanderer" as const,
    };

    service.update([existingBot], player, 3, 1000); // schedules exactly 1 (deficit = 2-1-0)
    const spawned = service.update([existingBot], player, 3, 1000); // delay elapses

    expect(spawned).toHaveLength(1);
  });
});

describe("BotPopulationService.update — mass-based scaling", () => {
  it("targets a higher total count once the player crosses a mass threshold", () => {
    const config = {
      respawnDelaySeconds: 0, // resolves the whole deficit within a single update() call
      thresholds: [
        { mass: 0, totalCount: 5, hunterRatio: 0 },
        { mass: 100, totalCount: 10, hunterRatio: 0.5 },
      ],
    };

    const spawnedSmall = new BotPopulationService(config).update([], makePlayer(10), 1, 1000);
    const spawnedBig = new BotPopulationService(config).update([], makePlayer(150), 1, 1000);

    expect(spawnedSmall).toHaveLength(5);
    expect(spawnedBig).toHaveLength(10);
  });
});
