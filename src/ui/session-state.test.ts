import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import type { WorldSnapshot } from "@/world/service/world.service";

interface CapturedCallbacks {
  onPlayerEaten?: () => void;
  onVictoryReached?: () => void;
  onTick?: (snapshot: WorldSnapshot) => void;
}

interface FakeGameLoopInstance {
  callbacks: CapturedCallbacks;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

const gameLoopInstances: FakeGameLoopInstance[] = [];

/**
 * GameLoopService is mocked entirely so these tests exercise only SessionState's own
 * transition logic — the real GameLoopService (tested in game-loop.service.test.ts) relies
 * on a browser requestAnimationFrame that doesn't exist in this Node test environment.
 */
vi.mock("@/session/game-loop.service", () => ({
  GameLoopService: vi.fn().mockImplementation((..._args: unknown[]) => {
    const callbacks = (_args[3] ?? {}) as CapturedCallbacks;
    const instance: FakeGameLoopInstance = { callbacks, start: vi.fn(), stop: vi.fn() };
    gameLoopInstances.push(instance);
    return instance;
  }),
}));

import { SessionState, type HudScreen, type MenuScreen, type SessionStateDeps } from "./session-state";

function createFakeMenu() {
  let playHandler: (() => void) | null = null;
  const menu: MenuScreen & { firePlay: () => void } = {
    show: vi.fn(),
    hide: vi.fn(),
    onPlay: vi.fn((handler: () => void) => {
      playHandler = handler;
    }),
    firePlay() {
      playHandler?.();
    },
  };
  return menu;
}

function createFakeResultScreen() {
  let restartHandler: (() => void) | null = null;
  let mainMenuHandler: (() => void) | null = null;
  // No explicit `ResultScreen` annotation here — that would widen show/hide back to plain
  // function types and lose the `.mock` property the assertions below rely on.
  const screen = {
    show: vi.fn(),
    hide: vi.fn(),
    onRestart: vi.fn((handler: () => void) => {
      restartHandler = handler;
    }),
    onMainMenu: vi.fn((handler: () => void) => {
      mainMenuHandler = handler;
    }),
    fireRestart() {
      restartHandler?.();
    },
    fireMainMenu() {
      mainMenuHandler?.();
    },
  };
  return screen;
}

function createFakeHud(): HudScreen {
  return { show: vi.fn(), hide: vi.fn(), updateMass: vi.fn() };
}

function createFakeInput(): IInputSource {
  return { getDirection: vi.fn(() => ({ x: 0, z: 0 })) };
}

function createFakeRenderer(): IRenderer {
  return { init: vi.fn(), render: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
}

function setup() {
  const menu = createFakeMenu();
  const hud = createFakeHud();
  const gameOver = createFakeResultScreen();
  const victory = createFakeResultScreen();
  const deps: SessionStateDeps = {
    inputSource: createFakeInput(),
    renderer: createFakeRenderer(),
    screens: { menu, hud, gameOver, victory },
  };
  const session = new SessionState(deps);
  return { session, menu, hud, gameOver, victory };
}

beforeEach(() => {
  gameLoopInstances.length = 0;
});

describe("SessionState", () => {
  it("starts in MainMenu with only the menu screen shown", () => {
    const { session, menu, hud, gameOver, victory } = setup();

    expect(session.state).toBe("MainMenu");
    expect(menu.show).toHaveBeenCalledTimes(1);
    expect(hud.hide).toHaveBeenCalledTimes(1);
    expect(gameOver.hide).toHaveBeenCalledTimes(1);
    expect(victory.hide).toHaveBeenCalledTimes(1);
  });

  it("Play transitions MainMenu -> Playing, shows the HUD, and starts a fresh game loop", () => {
    const { session, menu, hud } = setup();

    menu.firePlay();

    expect(session.state).toBe("Playing");
    expect(hud.show).toHaveBeenCalledTimes(1);
    expect(gameLoopInstances).toHaveLength(1);
    expect(gameLoopInstances[0]!.start).toHaveBeenCalledTimes(1);
  });

  it("player death transitions Playing -> GameOver, stops the loop, and shows the final mass", () => {
    const { session, menu, hud, gameOver } = setup();
    menu.firePlay();

    gameLoopInstances[0]!.callbacks.onPlayerEaten?.();

    expect(session.state).toBe("GameOver");
    expect(gameLoopInstances[0]!.stop).toHaveBeenCalledTimes(1);
    expect(hud.hide).toHaveBeenCalledTimes(2); // once at MainMenu init, once entering GameOver
    expect(gameOver.show).toHaveBeenCalledTimes(1);
    expect(gameOver.show.mock.calls[0]![0]).toBeGreaterThan(0); // a real snapshot mass, not a placeholder
  });

  it("reaching the victory cap transitions Playing -> Victory, stops the loop, and shows the final mass", () => {
    const { session, menu, victory } = setup();
    menu.firePlay();

    gameLoopInstances[0]!.callbacks.onVictoryReached?.();

    expect(session.state).toBe("Victory");
    expect(gameLoopInstances[0]!.stop).toHaveBeenCalledTimes(1);
    expect(victory.show).toHaveBeenCalledTimes(1);
    expect(victory.show.mock.calls[0]![0]).toBeGreaterThan(0);
  });

  it("GameOver Restart returns to Playing with a brand-new game loop instance", () => {
    const { session, menu, gameOver } = setup();
    menu.firePlay();
    gameLoopInstances[0]!.callbacks.onPlayerEaten?.();

    gameOver.fireRestart();

    expect(session.state).toBe("Playing");
    expect(gameLoopInstances).toHaveLength(2); // a fresh loop/world, not the dead one reused
    expect(gameLoopInstances[1]!.start).toHaveBeenCalledTimes(1);
  });

  it("GameOver MainMenu returns to MainMenu with no loop running", () => {
    const { session, menu, hud, gameOver } = setup();
    menu.firePlay();
    gameLoopInstances[0]!.callbacks.onPlayerEaten?.();

    gameOver.fireMainMenu();

    expect(session.state).toBe("MainMenu");
    expect(hud.hide).toHaveBeenCalledTimes(3); // MainMenu init + GameOver entry + MainMenu return (hud hidden every time)
    // stop() is called defensively on every transition into a non-Playing state, even
    // though GameLoopService.stop() is a documented idempotent no-op when already stopped.
    expect(gameLoopInstances[0]!.stop).toHaveBeenCalledTimes(2);
  });

  it("Victory Restart and MainMenu behave identically to GameOver's", () => {
    const { session, menu, victory } = setup();
    menu.firePlay();
    gameLoopInstances[0]!.callbacks.onVictoryReached?.();

    victory.fireRestart();
    expect(session.state).toBe("Playing");
    expect(gameLoopInstances).toHaveLength(2);

    gameLoopInstances[1]!.callbacks.onVictoryReached?.();
    victory.fireMainMenu();
    expect(session.state).toBe("MainMenu");
  });

  it("pushes live mass to the HUD via onTick", () => {
    const { menu, hud } = setup();
    menu.firePlay();

    const snapshot: WorldSnapshot = {
      player: { id: "player", position: { x: 1, z: 2 }, radius: 5, mass: 42 },
      bots: [],
      food: [],
      arenaWidth: 1000,
    };
    gameLoopInstances[0]!.callbacks.onTick?.(snapshot);

    expect(hud.updateMass).toHaveBeenCalledWith(42);
  });

  it("never reaches GameOver/Victory directly from MainMenu — only an active loop's callbacks can trigger them", () => {
    const { session } = setup();
    // No firePlay() call — no loop exists yet, so there is no callbacks object to invoke at all.
    expect(gameLoopInstances).toHaveLength(0);
    expect(session.state).toBe("MainMenu");
  });
});
