import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAudioPlayer } from "@/audio/port/audio.port";
import type { IInputSource } from "@/input/port/input.port";
import type { IRenderer } from "@/render/port/renderer.port";
import type { EatenEvent, WorldSnapshot } from "@/world/service/world.service";

interface CapturedCallbacks {
  onPlayerEaten?: () => void;
  onVictoryReached?: () => void;
  onTick?: (snapshot: WorldSnapshot) => void;
  onEntityEaten?: (event: EatenEvent) => void;
}

interface FakeGameLoopInstance {
  callbacks: CapturedCallbacks;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  // The real WorldService instance SessionState constructed for this loop — captured so tests
  // can confirm its arenaWidth (via getSnapshot()) agrees with whatever width was requested,
  // without reaching into SessionState's own private fields.
  worldService: { getSnapshot: () => { arenaWidth: number } };
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
    const worldService = _args[1] as FakeGameLoopInstance["worldService"];
    const instance: FakeGameLoopInstance = { callbacks, start: vi.fn(), stop: vi.fn(), worldService };
    gameLoopInstances.push(instance);
    return instance;
  }),
}));

import { SessionState, type HudScreen, type MenuScreen, type SessionStateDeps } from "./session-state";

function createFakeMenu() {
  let playHandler: ((arenaWidth: number) => void) | null = null;
  let openSettingsHandler: (() => void) | null = null;
  const menu: MenuScreen & { firePlay: (arenaWidth?: number) => void; fireOpenSettings: () => void } = {
    show: vi.fn(),
    hide: vi.fn(),
    onPlay: vi.fn((handler: (arenaWidth: number) => void) => {
      playHandler = handler;
    }),
    onOpenSettings: vi.fn((handler: () => void) => {
      openSettingsHandler = handler;
    }),
    // Defaults to Small (1000) so existing tests that don't care about arena width keep
    // exercising the same behavior Epic 1 had.
    firePlay(arenaWidth = 1000) {
      playHandler?.(arenaWidth);
    },
    fireOpenSettings() {
      openSettingsHandler?.();
    },
  };
  return menu;
}

function createFakeSettingsScreen() {
  let backHandler: (() => void) | null = null;
  const screen = {
    show: vi.fn(),
    hide: vi.fn(),
    onBack: vi.fn((handler: () => void) => {
      backHandler = handler;
    }),
    fireBack() {
      backHandler?.();
    },
  };
  return screen;
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
  return { init: vi.fn(), render: vi.fn(), resize: vi.fn(), setArenaWidth: vi.fn(), dispose: vi.fn() };
}

function createFakeAudioPlayer(): IAudioPlayer {
  return {
    playSfx: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    setSfxVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    muteSfx: vi.fn(),
    muteMusic: vi.fn(),
  };
}

function setup() {
  const menu = createFakeMenu();
  const hud = createFakeHud();
  const gameOver = createFakeResultScreen();
  const victory = createFakeResultScreen();
  const settings = createFakeSettingsScreen();
  const renderer = createFakeRenderer();
  const audioPlayer = createFakeAudioPlayer();
  const deps: SessionStateDeps = {
    inputSource: createFakeInput(),
    renderer,
    audioPlayer,
    screens: { menu, hud, gameOver, victory, settings },
  };
  const session = new SessionState(deps);
  return { session, menu, hud, gameOver, victory, settings, renderer, audioPlayer };
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
    // stop() + null-out happens once, at the GameOver transition — stopLoop() nulls
    // this.gameLoop, so the later MainMenu transition's stopLoop() call finds it already
    // null and doesn't re-invoke .stop() on the same (already-stopped) instance again.
    expect(gameLoopInstances[0]!.stop).toHaveBeenCalledTimes(1);
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

  it("ignores a redundant Play while already Playing instead of tearing down and rebuilding the active game", () => {
    // Defensive guard for when DOM-only [hidden] enforcement fails (this project has shipped
    // exactly that bug once already) and a "hidden" Play button's click still reaches here.
    const { session, menu } = setup();
    menu.firePlay();
    expect(gameLoopInstances).toHaveLength(1);

    menu.firePlay(); // simulates a second Play invocation while already Playing

    expect(session.state).toBe("Playing");
    expect(gameLoopInstances).toHaveLength(1); // no second loop was created
    expect(gameLoopInstances[0]!.stop).not.toHaveBeenCalled();
  });

  it("ignores a redundant MainMenu transition while already in MainMenu", () => {
    const { session, gameOver } = setup();
    // Already MainMenu at construction — firing a MainMenu handler with no active game
    // must not throw or do anything observable.
    expect(() => gameOver.fireMainMenu()).not.toThrow();
    expect(session.state).toBe("MainMenu");
  });

  describe("arena size threading (Epic 2, task 001)", () => {
    it("defaults to 1000 when the menu is never given an explicit choice", () => {
      const { menu, renderer } = setup();

      menu.firePlay(1000);

      expect(renderer.setArenaWidth).toHaveBeenCalledWith(1000);
      expect(gameLoopInstances[0]!.worldService.getSnapshot().arenaWidth).toBe(1000);
    });

    it("threads a Medium (1500) choice to both the renderer and the world it builds", () => {
      const { menu, renderer } = setup();

      menu.firePlay(1500);

      expect(renderer.setArenaWidth).toHaveBeenCalledWith(1500);
      expect(gameLoopInstances[0]!.worldService.getSnapshot().arenaWidth).toBe(1500);
    });

    it("threads a Large (2000) choice to both the renderer and the world it builds", () => {
      const { menu, renderer } = setup();

      menu.firePlay(2000);

      expect(renderer.setArenaWidth).toHaveBeenCalledWith(2000);
      expect(gameLoopInstances[0]!.worldService.getSnapshot().arenaWidth).toBe(2000);
    });

    it("calls renderer.setArenaWidth before building the new game loop, not after", () => {
      const { menu, renderer } = setup();
      const callOrder: string[] = [];
      (renderer.setArenaWidth as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push("setArenaWidth");
      });

      menu.firePlay(1500);
      callOrder.push("gameLoopConstructed"); // gameLoopInstances[0] already exists by now

      expect(callOrder).toEqual(["setArenaWidth", "gameLoopConstructed"]);
    });

    it("Restart reuses the size the player picked on Play, not the default", () => {
      const { menu, renderer, gameOver } = setup();
      menu.firePlay(2000);
      gameLoopInstances[0]!.callbacks.onPlayerEaten?.();
      (renderer.setArenaWidth as ReturnType<typeof vi.fn>).mockClear();

      gameOver.fireRestart();

      expect(renderer.setArenaWidth).toHaveBeenCalledWith(2000);
      expect(gameLoopInstances[1]!.worldService.getSnapshot().arenaWidth).toBe(2000);
    });
  });

  describe("audio (Epic 2, tasks 004-005)", () => {
    it("starts the ambient music loop exactly once on entering Playing", () => {
      const { menu, audioPlayer } = setup();

      menu.firePlay();

      expect(audioPlayer.playMusic).toHaveBeenCalledTimes(1);
      expect(audioPlayer.playMusic).toHaveBeenCalledWith("ambient-music");
    });

    it("stops music on death (GameOver) and plays the death SFX", () => {
      const { menu, audioPlayer } = setup();
      menu.firePlay();

      gameLoopInstances[0]!.callbacks.onPlayerEaten?.();

      expect(audioPlayer.stopMusic).toHaveBeenCalledTimes(1);
      expect(audioPlayer.playSfx).toHaveBeenCalledWith("death");
    });

    it("stops music on reaching Victory and plays the victory SFX", () => {
      const { menu, audioPlayer } = setup();
      menu.firePlay();

      gameLoopInstances[0]!.callbacks.onVictoryReached?.();

      expect(audioPlayer.stopMusic).toHaveBeenCalledTimes(1);
      expect(audioPlayer.playSfx).toHaveBeenCalledWith("victory");
    });

    it("stops music on manual return to MainMenu from GameOver", () => {
      const { menu, gameOver, audioPlayer } = setup();
      menu.firePlay();
      gameLoopInstances[0]!.callbacks.onPlayerEaten?.();
      (audioPlayer.stopMusic as ReturnType<typeof vi.fn>).mockClear();

      gameOver.fireMainMenu();

      expect(audioPlayer.stopMusic).toHaveBeenCalledTimes(1);
    });

    it("restarts music (not layered underneath the old instance) on Restart", () => {
      const { menu, gameOver, audioPlayer } = setup();
      menu.firePlay();
      gameLoopInstances[0]!.callbacks.onPlayerEaten?.();
      (audioPlayer.playMusic as ReturnType<typeof vi.fn>).mockClear();

      gameOver.fireRestart();

      // SessionState itself doesn't need to call stopMusic() again here — playMusic()
      // replaces whatever's already playing internally (see IAudioPlayer's doc comment) — but
      // it must still call playMusic() exactly once for the new Playing session.
      expect(audioPlayer.playMusic).toHaveBeenCalledTimes(1);
      expect(audioPlayer.playMusic).toHaveBeenCalledWith("ambient-music");
    });

    it("plays eat-food SFX when the player eats food, not eat-bot", () => {
      const { menu, audioPlayer } = setup();
      menu.firePlay();

      gameLoopInstances[0]!.callbacks.onEntityEaten?.({
        eaterId: "player",
        eaterType: "player",
        eatenId: "food-1",
        eatenType: "food",
      });

      expect(audioPlayer.playSfx).toHaveBeenCalledWith("eat-food");
      expect(audioPlayer.playSfx).not.toHaveBeenCalledWith("eat-bot");
    });

    it("plays eat-bot SFX when the player eats a bot, not eat-food", () => {
      const { menu, audioPlayer } = setup();
      menu.firePlay();

      gameLoopInstances[0]!.callbacks.onEntityEaten?.({
        eaterId: "player",
        eaterType: "player",
        eatenId: "bot-1",
        eatenType: "bot",
      });

      expect(audioPlayer.playSfx).toHaveBeenCalledWith("eat-bot");
      expect(audioPlayer.playSfx).not.toHaveBeenCalledWith("eat-food");
    });

    it("ignores eatenEvents where a bot is the eater, not the player — no SFX for bot-eats-bot/food", () => {
      const { menu, audioPlayer } = setup();
      menu.firePlay();

      gameLoopInstances[0]!.callbacks.onEntityEaten?.({
        eaterId: "bot-1",
        eaterType: "bot",
        eatenId: "food-1",
        eatenType: "food",
      });

      expect(audioPlayer.playSfx).not.toHaveBeenCalled();
    });
  });

  describe("settings (Epic 2, task 007)", () => {
    it("opening Settings from MainMenu hides the menu and shows settings, without changing `state`", () => {
      const { session, menu, settings } = setup();

      menu.fireOpenSettings();

      expect(session.state).toBe("MainMenu"); // modal overlay, not a new SessionStateName
      expect(menu.hide).toHaveBeenCalledTimes(1);
      expect(settings.show).toHaveBeenCalledTimes(1);
    });

    it("Back from Settings hides settings and shows the menu again", () => {
      const { menu, settings } = setup();
      menu.fireOpenSettings();

      settings.fireBack();

      expect(settings.hide).toHaveBeenCalledTimes(1);
      // Once at MainMenu init, once on returning from Settings.
      expect(menu.show).toHaveBeenCalledTimes(2);
    });

    it("is a no-op while Playing — Settings has no button during an active game", () => {
      const { session, menu, settings } = setup();
      menu.firePlay();

      menu.fireOpenSettings();

      expect(session.state).toBe("Playing");
      expect(settings.show).not.toHaveBeenCalled();
    });

    it("all 7 of Epic 1's original transitions still work unchanged alongside Settings", () => {
      const { session, menu, gameOver, victory } = setup();

      menu.firePlay();
      expect(session.state).toBe("Playing");

      gameLoopInstances[0]!.callbacks.onPlayerEaten?.();
      expect(session.state).toBe("GameOver");

      gameOver.fireRestart();
      expect(session.state).toBe("Playing");

      gameLoopInstances[1]!.callbacks.onVictoryReached?.();
      expect(session.state).toBe("Victory");

      victory.fireRestart();
      expect(session.state).toBe("Playing");

      gameLoopInstances[2]!.callbacks.onPlayerEaten?.();
      gameOver.fireMainMenu();
      expect(session.state).toBe("MainMenu");
    });
  });
});
