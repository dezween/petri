import { describe, expect, it, vi } from "vitest";
import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import type { TickResult, WorldService, WorldSnapshot } from "@/world/service/world.service";
import { GameLoopService, type AnimationScheduler } from "./game-loop.service";

/** A controllable fake rAF scheduler: frames only fire when the test asks for them. */
function createFakeScheduler() {
  let nextHandle = 1;
  const pending = new Map<number, (timestamp: number) => void>();

  const scheduler: AnimationScheduler = {
    requestFrame: vi.fn((callback: (timestamp: number) => void) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    }),
    cancelFrame: vi.fn((handle: number) => {
      pending.delete(handle);
    }),
  };

  return {
    scheduler,
    /** Fires the most recently scheduled frame, as if the browser had invoked it. */
    fireNextFrame(timestamp: number) {
      const entries = [...pending.entries()];
      const last = entries[entries.length - 1];
      if (!last) throw new Error("no frame was scheduled");
      const [handle, callback] = last;
      pending.delete(handle);
      callback(timestamp);
    },
    pendingCount() {
      return pending.size;
    },
  };
}

const fakeSnapshot: WorldSnapshot = {
  player: { id: "p1", position: { x: 0, z: 0 }, radius: 10, mass: 25 },
  bots: [],
  food: [],
  arenaWidth: 1000,
};

function createFakeWorldService(
  result: TickResult = { playerEaten: false, victoryReached: false, eatenEvents: [] },
) {
  return {
    tick: vi.fn(() => result),
    getSnapshot: vi.fn(() => fakeSnapshot),
  } as unknown as WorldService;
}

function createFakeInput(direction = { x: 0, z: 0 }): IInputSource {
  return { getDirection: vi.fn(() => direction) };
}

function createFakeRenderer(): IRenderer {
  return {
    init: vi.fn(),
    render: vi.fn(),
    spawnEatBurst: vi.fn(),
    resize: vi.fn(),
    setArenaWidth: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("GameLoopService", () => {
  it("reads input, ticks the world, and renders the resulting snapshot each frame", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const input = createFakeInput({ x: 1, z: 0 });
    const world = createFakeWorldService();
    const renderer = createFakeRenderer();
    const loop = new GameLoopService(input, world, renderer, {}, scheduler);

    loop.start();
    fireNextFrame(16);

    expect(input.getDirection).toHaveBeenCalled();
    expect(world.tick).toHaveBeenCalledWith(0, { x: 1, z: 0 });
    // First-ever frame has no prior timestamp to diff against, so deltaTime is 0.
    expect(renderer.render).toHaveBeenCalledWith(fakeSnapshot, 0);
  });

  it("computes deltaTime from real elapsed time between frames, not a fixed value", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const world = createFakeWorldService();
    const loop = new GameLoopService(createFakeInput(), world, createFakeRenderer(), {}, scheduler);

    loop.start();
    fireNextFrame(1000); // first frame: no prior timestamp, deltaTime = 0
    fireNextFrame(1250); // 250ms later

    expect(world.tick).toHaveBeenNthCalledWith(1, 0, { x: 0, z: 0 });
    expect(world.tick).toHaveBeenNthCalledWith(2, 0.25, { x: 0, z: 0 });
  });

  it("stop() halts the loop so no further frames are scheduled", () => {
    const { scheduler, fireNextFrame, pendingCount } = createFakeScheduler();
    const loop = new GameLoopService(createFakeInput(), createFakeWorldService(), createFakeRenderer(), {}, scheduler);

    loop.start();
    fireNextFrame(16);
    expect(pendingCount()).toBe(1); // next frame already queued by the tick that just ran

    loop.stop();

    expect(pendingCount()).toBe(0);
    expect(loop.isRunning).toBe(false);
  });

  it("fires onPlayerEaten exactly once for a single death occurrence, even across multiple frames", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const world = createFakeWorldService({ playerEaten: true, victoryReached: false, eatenEvents: [] });
    const onPlayerEaten = vi.fn();
    const loop = new GameLoopService(createFakeInput(), world, createFakeRenderer(), { onPlayerEaten }, scheduler);

    loop.start();
    fireNextFrame(16);
    fireNextFrame(32);

    expect(onPlayerEaten).toHaveBeenCalledTimes(1);
  });

  it("fires onVictoryReached exactly once for a single victory-cap occurrence, even across multiple frames", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const world = createFakeWorldService({ playerEaten: false, victoryReached: true, eatenEvents: [] });
    const onVictoryReached = vi.fn();
    const loop = new GameLoopService(createFakeInput(), world, createFakeRenderer(), { onVictoryReached }, scheduler);

    loop.start();
    fireNextFrame(16);
    fireNextFrame(32);

    expect(onVictoryReached).toHaveBeenCalledTimes(1);
  });

  it("does not fire callbacks when neither death nor victory occurred", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const onPlayerEaten = vi.fn();
    const onVictoryReached = vi.fn();
    const loop = new GameLoopService(
      createFakeInput(),
      createFakeWorldService(),
      createFakeRenderer(),
      { onPlayerEaten, onVictoryReached },
      scheduler,
    );

    loop.start();
    fireNextFrame(16);

    expect(onPlayerEaten).not.toHaveBeenCalled();
    expect(onVictoryReached).not.toHaveBeenCalled();
  });

  it("fires onTick every frame with the same snapshot passed to the renderer", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const world = createFakeWorldService();
    const renderer = createFakeRenderer();
    const onTick = vi.fn();
    const loop = new GameLoopService(createFakeInput(), world, renderer, { onTick }, scheduler);

    loop.start();
    fireNextFrame(16);
    fireNextFrame(32);

    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenCalledWith(fakeSnapshot);
  });

  it("start() is a no-op when already running — doesn't schedule a second loop", () => {
    const { scheduler } = createFakeScheduler();
    const loop = new GameLoopService(createFakeInput(), createFakeWorldService(), createFakeRenderer(), {}, scheduler);

    loop.start();
    loop.start();

    expect(scheduler.requestFrame).toHaveBeenCalledTimes(1);
  });

  it("stop() before start() is a safe no-op", () => {
    const { scheduler } = createFakeScheduler();
    const loop = new GameLoopService(createFakeInput(), createFakeWorldService(), createFakeRenderer(), {}, scheduler);

    expect(() => loop.stop()).not.toThrow();
    expect(scheduler.cancelFrame).not.toHaveBeenCalled();
  });

  it("fires only onPlayerEaten, never onVictoryReached too, if a TickResult ever reported both in the same tick", () => {
    // Structural guard: today WorldService's own invariants make this combination
    // unreachable, but the loop must not rely on that alone — both flags true in one
    // TickResult must still only ever fire one callback.
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const world = createFakeWorldService({ playerEaten: true, victoryReached: true, eatenEvents: [] });
    const onPlayerEaten = vi.fn();
    const onVictoryReached = vi.fn();
    const loop = new GameLoopService(
      createFakeInput(),
      world,
      createFakeRenderer(),
      { onPlayerEaten, onVictoryReached },
      scheduler,
    );

    loop.start();
    fireNextFrame(16);

    expect(onPlayerEaten).toHaveBeenCalledTimes(1);
    expect(onVictoryReached).not.toHaveBeenCalled();
  });

  it("fires onEntityEaten once per event in TickResult.eatenEvents, in order", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const eatenEvents: TickResult["eatenEvents"] = [
      { eaterId: "player", eaterType: "player", eatenId: "food-1", eatenType: "food", position: { x: 1, z: 2 } },
      { eaterId: "bot-1", eaterType: "bot", eatenId: "food-2", eatenType: "food", position: { x: 3, z: 4 } },
    ];
    const world = createFakeWorldService({ playerEaten: false, victoryReached: false, eatenEvents });
    const onEntityEaten = vi.fn();
    const loop = new GameLoopService(createFakeInput(), world, createFakeRenderer(), { onEntityEaten }, scheduler);

    loop.start();
    fireNextFrame(16);

    expect(onEntityEaten).toHaveBeenCalledTimes(2);
    expect(onEntityEaten).toHaveBeenNthCalledWith(1, eatenEvents[0]);
    expect(onEntityEaten).toHaveBeenNthCalledWith(2, eatenEvents[1]);
  });

  it("does not call onEntityEaten when a tick reports no eaten events", () => {
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const onEntityEaten = vi.fn();
    const loop = new GameLoopService(
      createFakeInput(),
      createFakeWorldService(),
      createFakeRenderer(),
      { onEntityEaten },
      scheduler,
    );

    loop.start();
    fireNextFrame(16);

    expect(onEntityEaten).not.toHaveBeenCalled();
  });

  it("does not keep ticking after a callback synchronously calls stop() (regression: SessionState's onVictoryReached/onPlayerEaten do exactly this)", () => {
    const { scheduler, fireNextFrame, pendingCount } = createFakeScheduler();
    const world = createFakeWorldService({ playerEaten: false, victoryReached: true, eatenEvents: [] });
    const loop = new GameLoopService(
      createFakeInput(),
      world,
      createFakeRenderer(),
      // Mirrors SessionState.enterVictory(): the callback itself calls loop.stop() before
      // returning, the same way enterVictory() -> stopLoop() -> gameLoop.stop() does.
      { onVictoryReached: () => loop.stop() },
      scheduler,
    );

    loop.start();
    fireNextFrame(16);

    expect(pendingCount()).toBe(0);
    expect(loop.isRunning).toBe(false);

    // Even if something external fired another frame anyway, the world must not tick again —
    // belt-and-suspenders against the exact bug this test guards (the loop rescheduling itself
    // after stop() already ran inside the callback).
    expect(world.tick).toHaveBeenCalledTimes(1);
  });

  it("stopping one loop and starting a second on the same scheduler leaves only the second loop's callbacks firing", () => {
    // Directly exercises the sequential stop-then-replace pattern SessionState.play() relies
    // on for leak-free Restarts: constructing a second GameLoopService sharing the same
    // scheduler after stopping the first must not let the first loop's frame fire again.
    const { scheduler, fireNextFrame } = createFakeScheduler();
    const firstTick = vi.fn();
    const secondTick = vi.fn();
    const firstLoop = new GameLoopService(
      createFakeInput(),
      createFakeWorldService(),
      createFakeRenderer(),
      { onTick: firstTick },
      scheduler,
    );
    const secondLoop = new GameLoopService(
      createFakeInput(),
      createFakeWorldService(),
      createFakeRenderer(),
      { onTick: secondTick },
      scheduler,
    );

    firstLoop.start();
    firstLoop.stop();
    secondLoop.start();
    fireNextFrame(16);

    expect(firstTick).not.toHaveBeenCalled();
    expect(secondTick).toHaveBeenCalledTimes(1);
  });
});
