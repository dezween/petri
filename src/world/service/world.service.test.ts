import { describe, expect, it } from "vitest";
import { WorldService, DEFAULT_ARENA_WIDTH } from "./world.service";
import type { Player } from "../domain/cell.entity";
import { massToRadius } from "../domain/cell.entity";
import type { Bot } from "../domain/bot.entity";
import type { Food } from "../domain/food.entity";
import { VICTORY_CAP_FRACTION } from "../domain/rules";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player",
    position: { x: 0, z: 0 },
    mass: 10,
    radius: massToRadius(10),
    ...overrides,
  };
}

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "bot-1",
    position: { x: 0, z: 0 },
    mass: 10,
    radius: massToRadius(10),
    behavior: "wanderer",
    ...overrides,
  };
}

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    position: { x: 0, z: 0 },
    mass: 1,
    radius: massToRadius(1),
    ...overrides,
  };
}

describe("WorldService.tick — movement", () => {
  it("moves the player smoothly toward the input direction with no bots/food", () => {
    const player = makePlayer({ position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], []);

    world.tick(1 / 60, { x: 1, z: 0 });
    const afterOneTick = world.getSnapshot().player.position.x;
    expect(afterOneTick).toBeGreaterThan(0);

    for (let i = 0; i < 59; i++) world.tick(1 / 60, { x: 1, z: 0 });
    const afterOneSecond = world.getSnapshot().player.position.x;
    expect(afterOneSecond).toBeGreaterThan(afterOneTick);
  });

  it("keeps the player within arena bounds even when driven toward the edge for a long time", () => {
    const player = makePlayer({ position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], []);

    for (let i = 0; i < 1000; i++) world.tick(1 / 60, { x: 1, z: 0 });

    const { player: snapshot, arenaWidth } = world.getSnapshot();
    const half = arenaWidth / 2;
    expect(snapshot.position.x).toBeLessThanOrEqual(half - snapshot.radius + 1e-9);
  });

  it("does nothing when the input direction has zero length", () => {
    const player = makePlayer({ position: { x: 5, z: -5 } });
    const world = new WorldService(player, [], []);

    world.tick(1 / 60, { x: 0, z: 0 });

    expect(world.getSnapshot().player.position).toEqual({ x: 5, z: -5 });
  });
});

describe("WorldService.tick — collisions", () => {
  it("removes a smaller bot the player overlaps and grows the player's mass", () => {
    const player = makePlayer({ mass: 20, position: { x: 0, z: 0 } });
    const bot = makeBot({ mass: 5, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [bot], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    const snapshot = world.getSnapshot();
    expect(result.playerEaten).toBe(false);
    expect(snapshot.bots).toHaveLength(0);
    expect(snapshot.player.mass).toBe(25);
  });

  it("reports playerEaten when the overlapping bot is larger", () => {
    const player = makePlayer({ mass: 5, position: { x: 0, z: 0 } });
    const bot = makeBot({ mass: 50, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [bot], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.playerEaten).toBe(true);
  });

  it("removes overlapping food and grows the player's mass", () => {
    const player = makePlayer({ mass: 10, position: { x: 0, z: 0 } });
    const food = makeFood({ position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], [food]);

    world.tick(1 / 60, { x: 0, z: 0 });

    const snapshot = world.getSnapshot();
    expect(snapshot.food).toHaveLength(0);
    expect(snapshot.player.mass).toBe(11);
  });

  it("lets a bot eat a smaller bot and a smaller food particle", () => {
    const player = makePlayer({ position: { x: 500, z: 500 } }); // far away, uninvolved
    const bigBot = makeBot({ id: "big", mass: 20, position: { x: -400, z: 0 } });
    const smallBot = makeBot({ id: "small", mass: 5, position: { x: -400, z: 0 } });
    const food = makeFood({ position: { x: -400, z: 0 } });
    const world = new WorldService(player, [bigBot, smallBot], [food]);

    world.tick(1 / 60, { x: 0, z: 0 });

    const snapshot = world.getSnapshot();
    expect(snapshot.bots).toHaveLength(1);
    expect(snapshot.bots[0]!.id).toBe("big");
    expect(snapshot.bots[0]!.mass).toBe(26); // 20 + 5 (small bot) + 1 (food)
    expect(snapshot.food).toHaveLength(0);
  });

  it("does not resolve collisions between non-overlapping entities", () => {
    const player = makePlayer({ mass: 20, position: { x: 0, z: 0 } });
    const bot = makeBot({ mass: 5, position: { x: 500, z: 500 } });
    const world = new WorldService(player, [bot], []);

    world.tick(1 / 60, { x: 0, z: 0 });

    expect(world.getSnapshot().bots).toHaveLength(1);
  });
});

describe("WorldService.tick — victory cap", () => {
  it("reports victoryReached once the player's radius hits the cap", () => {
    const cap = DEFAULT_ARENA_WIDTH * VICTORY_CAP_FRACTION;
    const massAtCap = (cap / 2) ** 2; // inverse of massToRadius with RADIUS_PER_MASS_SQRT=2
    const player = makePlayer({ mass: massAtCap, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.victoryReached).toBe(true);
    expect(world.getSnapshot().player.radius).toBeLessThanOrEqual(cap);
  });

  it("reports victoryReached: false for a small player", () => {
    const player = makePlayer({ mass: 1, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.victoryReached).toBe(false);
  });
});

describe("WorldService.getSnapshot", () => {
  it("returns plain data that does not alias live internal state", () => {
    const player = makePlayer({ position: { x: 1, z: 1 } });
    const bot = makeBot({ position: { x: 2, z: 2 } });
    const world = new WorldService(player, [bot], []);

    const snapshot = world.getSnapshot();
    snapshot.player.position.x = 9999;
    snapshot.bots[0]!.position.x = 9999;

    const second = world.getSnapshot();
    expect(second.player.position.x).toBe(1);
    expect(second.bots[0]!.position.x).toBe(2);
  });
});
