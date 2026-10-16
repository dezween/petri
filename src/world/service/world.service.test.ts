import { describe, expect, it } from "vitest";
import { WorldService, DEFAULT_ARENA_WIDTH } from "./world.service";
import type { Player } from "../domain/cell.entity";
import { massToRadius, radiusToMass } from "../domain/cell.entity";
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

  it("keeps the player within the arena's circular boundary (not its bounding square) when driven diagonally for a long time", () => {
    const player = makePlayer({ position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], []);

    for (let i = 0; i < 1000; i++) world.tick(1 / 60, { x: 1, z: 1 });

    const { player: snapshot, arenaWidth } = world.getSnapshot();
    const arenaRadius = arenaWidth / 2;
    const distanceFromCenter = Math.hypot(snapshot.position.x, snapshot.position.z);
    // A square clamp would let this reach ~sqrt(2) * (half - radius), i.e. past the
    // circular rim — must stay within the circle instead.
    expect(distanceFromCenter).toBeLessThanOrEqual(arenaRadius - snapshot.radius + 1e-9);
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

  it("resolves a simultaneous multi-entity overlap deterministically, independent of array order", () => {
    // Player (mass 10) is simultaneously overlapped by a smaller bot (8) and a bigger bot
    // (15) in the same tick. The outcome must depend only on the frozen start-of-tick
    // masses, never on which bot happens to be evaluated first in `this.bots`.
    const run = (bots: Bot[]) => {
      const player = makePlayer({ mass: 10, position: { x: 0, z: 0 } });
      const world = new WorldService(player, bots, []);
      const result = world.tick(1 / 60, { x: 0, z: 0 });
      return { result, snapshot: world.getSnapshot() };
    };

    const smaller = () => makeBot({ id: "smaller", mass: 8, position: { x: 0, z: 0 } });
    const bigger = () => makeBot({ id: "bigger", mass: 15, position: { x: 0, z: 0 } });

    const orderAB = run([smaller(), bigger()]);
    const orderBA = run([bigger(), smaller()]);

    expect(orderAB.result.playerEaten).toBe(true);
    expect(orderBA.result.playerEaten).toBe(true);
    expect(orderAB.result.playerEaten).toBe(orderBA.result.playerEaten);
  });

  it("resolves a simultaneous multi-entity overlap with identical final mass and eaten-events, independent of array order (WR-01 regression)", () => {
    // Same setup as above, but this asserts the OUTCOME (final player mass, eaten-events),
    // not just the playerEaten boolean. Before the fix, bots = [smaller, bigger] let the
    // player eat `smaller` (growing mass, firing an eat-bot event) before dying to `bigger`,
    // while bots = [bigger, smaller] killed the player immediately with neither — same
    // boolean, different mass/events, purely from this.bots' iteration order.
    const run = (bots: Bot[]) => {
      const player = makePlayer({ mass: 10, position: { x: 0, z: 0 } });
      const world = new WorldService(player, bots, []);
      const result = world.tick(1 / 60, { x: 0, z: 0 });
      return { result, snapshot: world.getSnapshot() };
    };

    const smaller = () => makeBot({ id: "smaller", mass: 8, position: { x: 0, z: 0 } });
    const bigger = () => makeBot({ id: "bigger", mass: 15, position: { x: 0, z: 0 } });

    const orderAB = run([smaller(), bigger()]);
    const orderBA = run([bigger(), smaller()]);

    expect(orderAB.result.playerEaten).toBe(true);
    expect(orderBA.result.playerEaten).toBe(true);
    // Final mass must match regardless of order — no growth should be applied in either case
    // since the player died this tick.
    expect(orderAB.snapshot.player.mass).toBe(10);
    expect(orderBA.snapshot.player.mass).toBe(10);
    expect(orderAB.snapshot.player.mass).toBe(orderBA.snapshot.player.mass);
    // No eat-bot event should fire in either order when the player dies the same tick.
    expect(orderAB.result.eatenEvents).toHaveLength(0);
    expect(orderBA.result.eatenEvents).toHaveLength(0);
  });

  it("caps a bot's radius at the victory-cap fraction, instead of letting it grow past the arena and snap to center", () => {
    const player = makePlayer({ position: { x: 500, z: 500 } }); // far away, uninvolved
    // Bot already near the cap; eating one more large bot should clamp its radius rather
    // than let it exceed the arena's own radius.
    const cap = DEFAULT_ARENA_WIDTH * VICTORY_CAP_FRACTION;
    const nearCapMass = radiusToMass(cap) - 1;
    const bigBot = makeBot({ id: "big", mass: nearCapMass, position: { x: 0, z: 0 } });
    const smallBot = makeBot({ id: "small", mass: 1, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [bigBot, smallBot], []);

    world.tick(1 / 60, { x: 0, z: 0 });

    const snapshot = world.getSnapshot();
    expect(snapshot.bots).toHaveLength(1);
    expect(snapshot.bots[0]!.radius).toBeLessThanOrEqual(cap);
  });
});

describe("WorldService.tick — eaten events", () => {
  it("reports a player-eats-food event with the correct eater/eaten ids and types", () => {
    const player = makePlayer({ id: "player", mass: 10, position: { x: 0, z: 0 } });
    const food = makeFood({ id: "food-1", position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], [food]);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.eatenEvents).toEqual([
      {
        eaterId: "player",
        eaterType: "player",
        eatenId: "food-1",
        eatenType: "food",
        position: { x: 0, z: 0 },
      },
    ]);
  });

  it("reports a player-eats-bot event, distinct in eatenType from a player-eats-food event", () => {
    const player = makePlayer({ id: "player", mass: 20, position: { x: 0, z: 0 } });
    const bot = makeBot({ id: "bot-1", mass: 5, position: { x: 0, z: 0 }, behavior: "hunter" });
    const world = new WorldService(player, [bot], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    // The eaten bot moves under its own AI before collisions resolve this tick (every bot
    // behavior moves every tick, there's no "stationary" one), so its captured eat-position
    // isn't exactly its spawn point — only the non-position fields are asserted exactly here;
    // position correctness (it reflects *some* real, finite coordinate) is checked separately.
    expect(result.eatenEvents).toMatchObject([
      {
        eaterId: "player",
        eaterType: "player",
        eatenId: "bot-1",
        eatenType: "bot",
        eatenBehavior: "hunter",
      },
    ]);
    expect(Number.isFinite(result.eatenEvents[0]!.position.x)).toBe(true);
    expect(Number.isFinite(result.eatenEvents[0]!.position.z)).toBe(true);
  });

  it("reports no eatenEvents when the player is eaten instead of eating", () => {
    const player = makePlayer({ mass: 5, position: { x: 0, z: 0 } });
    const bot = makeBot({ mass: 50, position: { x: 0, z: 0 } });
    const world = new WorldService(player, [bot], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.eatenEvents).toEqual([]);
  });

  it("reports bot-eats-food and bot-eats-bot events too, not just the player's own eats", () => {
    const player = makePlayer({ position: { x: 500, z: 500 } }); // far away, uninvolved
    const bigBot = makeBot({ id: "big", mass: 20, position: { x: -400, z: 0 } });
    const smallBot = makeBot({ id: "small", mass: 5, position: { x: -400, z: 0 }, behavior: "fleer" });
    const food = makeFood({ id: "food-1", position: { x: -400, z: 0 } });
    const world = new WorldService(player, [bigBot, smallBot], [food]);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    // `small`'s eat-position reflects post-movement coordinates (bots move every tick, see the
    // comment in the player-eats-bot test above) — assert the other fields exactly, position
    // only loosely (it's generated near -400,0, the shared spawn point, not exactly on it).
    expect(result.eatenEvents).toContainEqual(
      expect.objectContaining({
        eaterId: "big",
        eaterType: "bot",
        eatenId: "small",
        eatenType: "bot",
        eatenBehavior: "fleer",
      }),
    );
    // `food-1` never moves on its own, so its eat-position is exactly its spawn point.
    expect(result.eatenEvents).toContainEqual({
      eaterId: "big",
      eaterType: "bot",
      eatenId: "food-1",
      eatenType: "food",
      position: { x: -400, z: 0 },
    });
  });

  it("reports an empty eatenEvents array when nothing overlaps", () => {
    const player = makePlayer({ mass: 20, position: { x: 0, z: 0 } });
    const bot = makeBot({ mass: 5, position: { x: 500, z: 500 } });
    const world = new WorldService(player, [bot], []);

    const result = world.tick(1 / 60, { x: 0, z: 0 });

    expect(result.eatenEvents).toEqual([]);
  });
});

describe("WorldService.tick — victory cap", () => {
  it("reports victoryReached once the player's radius hits the cap", () => {
    const cap = DEFAULT_ARENA_WIDTH * VICTORY_CAP_FRACTION;
    const massAtCap = radiusToMass(cap); // inverse of massToRadius at the real constant
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
