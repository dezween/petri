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

  it("does not tunnel two closing near-minimum-mass bots through each other during a stalled frame (WR-03 regression)", () => {
    // The one realistic pairing in this game's actual numbers where a single end-of-tick
    // position check can miss a collision: two bots near INITIAL_BOT_MASS (5, the smallest
    // mass any live bot has) closing head-on. Each has speed BOT_BASE_SPEED / sqrt(5) ≈ 447.2
    // units/sec, so closing speed ≈ 894.4 units/sec; combined radius
    // massToRadius(5) * 2 ≈ 35.8. Starting 45 units apart (just outside combined radius) and
    // ticking once at MAX_DELTA_TIME (0.1s, the worst a real stall is ever simulated as): a
    // single un-split 0.1s move would send each bot its own full 44.7-unit distance toward the
    // other, ending ~44.4 units apart on the *opposite* sides from where they started — still
    // outside combined radius, a clean miss, despite having swapped positions and so
    // necessarily crossed paths somewhere in between. Substepping (this file's
    // MAX_SUBSTEP_DELTA_TIME) must catch the crossing instead.
    //
    // `hunter` chases `prey` directly (prey's mass is a hair under hunter's, to satisfy
    // resolveEating's strict "<" prey filter while staying numerically indistinguishable from
    // the real worst case of two equal-mass-5 bots). `prey` is a plain wanderer pulled toward
    // `lure`, a food pellet placed beyond `hunter`'s position — its direction is therefore
    // straight at (and through) `hunter`, giving a true head-on closing pair without either
    // bot's direction depending on the other.
    const hunterMass = 5;
    const preyMass = 4.999;
    const hunter = makeBot({
      id: "hunter",
      mass: hunterMass,
      radius: massToRadius(hunterMass),
      behavior: "hunter",
      position: { x: -22.5, z: 0 },
    });
    const prey = makeBot({
      id: "prey",
      mass: preyMass,
      radius: massToRadius(preyMass),
      behavior: "wanderer",
      position: { x: 22.5, z: 0 },
    });
    const lure = makeFood({ id: "lure", position: { x: -120, z: 0 } });
    const player = makePlayer({ position: { x: 5000, z: 5000 } }); // far away, uninvolved
    const world = new WorldService(player, [hunter, prey], [lure]);

    world.tick(0.1, { x: 0, z: 0 });

    const snapshot = world.getSnapshot();
    // `prey` must have actually been caught (eaten by `hunter`), not passed through
    // undetected — the direct symptom of the tunneling bug this substep fix addresses.
    expect(snapshot.bots.map((bot) => bot.id)).not.toContain("prey");
    expect(snapshot.bots).toHaveLength(1);
    expect(snapshot.bots[0]!.id).toBe("hunter");
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

describe("WorldService — velocity tracking (Epic 4, task 002)", () => {
  it("a moving entity's tracked velocity matches its actual measured displacement over that tick", () => {
    const player = makePlayer({ position: { x: 0, z: 0 } });
    const world = new WorldService(player, [], [], DEFAULT_ARENA_WIDTH);
    const dt = 1 / 60;

    world.tick(dt, { x: 1, z: 0 });

    const endX = world.getSnapshot().player.position.x;
    const velocity = world.getVelocityFor("player");

    expect(endX).toBeGreaterThan(0);
    expect(velocity.x).toBeCloseTo(endX / dt, 5);
    expect(velocity.z).toBeCloseTo(0, 5);
  });

  it("an id with no tracked prior-tick position reports {0,0}, not a crash or garbage value", () => {
    const world = new WorldService(makePlayer(), [], [], DEFAULT_ARENA_WIDTH);
    world.tick(1 / 60, { x: 0, z: 0 });

    expect(world.getVelocityFor("never-existed")).toEqual({ x: 0, z: 0 });
  });

  it("the very first tick (deltaTime 0) never divides by zero", () => {
    const world = new WorldService(makePlayer(), [], [], DEFAULT_ARENA_WIDTH);

    expect(() => world.tick(0, { x: 1, z: 0 })).not.toThrow();

    const velocity = world.getVelocityFor("player");
    expect(Number.isFinite(velocity.x)).toBe(true);
    expect(Number.isFinite(velocity.z)).toBe(true);
  });

  it("a despawned entity's velocity is not retained — the tracking map is rebuilt per-tick from whoever's currently alive, not accumulated", () => {
    const player = makePlayer({ mass: 1_000_000 }); // always wins any overlap this test sets up
    const bot = makeBot({ id: "doomed", position: { x: 0, z: 0 }, mass: 1 });
    const world = new WorldService(player, [bot], [], DEFAULT_ARENA_WIDTH);

    world.tick(1 / 60, { x: 0, z: 0 }); // player overlaps and eats "doomed" this tick

    expect(world.getSnapshot().bots.find((b) => b.id === "doomed")).toBeUndefined();
    expect(world.getVelocityFor("doomed")).toEqual({ x: 0, z: 0 });
  });

  it("food always reports {0,0} velocity (it never moves)", () => {
    const player = makePlayer({ position: { x: 1000, z: 1000 } }); // far away, never interacts
    const food = makeFood({ id: "f1" });
    const world = new WorldService(player, [], [food], DEFAULT_ARENA_WIDTH);

    world.tick(1 / 60, { x: 0, z: 0 });

    expect(world.getVelocityFor("f1")).toEqual({ x: 0, z: 0 });
  });
});
