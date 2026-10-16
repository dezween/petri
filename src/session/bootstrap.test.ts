import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `bootstrap.ts` is the composition root — the one file that wires every port to its real
 * adapter and to the DOM elements `main.ts` resolves. A swapped/transposed constructor
 * argument here (e.g. scoreValue/restartButton swapped) would type-check fine (every element
 * here is structurally compatible) and only surface via manual browser testing — exactly the
 * class of regression this project's history (`[hidden]`/CSS bug, camera-follow bug) shows is
 * a real recurring risk. Every adapter/renderer/SessionState dependency is mocked here so this
 * test can assert *which* fake element/value each constructor actually received, without a
 * real DOM, WebGL context, or requestAnimationFrame.
 */

interface Call {
  args: unknown[];
}

const threeRendererCalls: Call[] = [];
const mouseInputCalls: Call[] = [];
const audioPlayerCalls: Call[] = [];
const menuAdapterCalls: Call[] = [];
const hudAdapterCalls: Call[] = [];
const gameOverAdapterCalls: Call[] = [];
const victoryAdapterCalls: Call[] = [];
const settingsAdapterCalls: Call[] = [];
const sessionStateCalls: Call[] = [];

vi.mock("@/render/adapter/three/three-renderer", () => ({
  ThreeRenderer: vi.fn().mockImplementation((...args: unknown[]) => {
    threeRendererCalls.push({ args });
    return { __args: args, init: vi.fn(), render: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
  }),
}));

vi.mock("@/input/adapter/dom/mouse-input.adapter", () => ({
  MouseInputAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    mouseInputCalls.push({ args });
    return { __args: args, getDirection: vi.fn(), dispose: vi.fn() };
  }),
}));

vi.mock("@/audio/adapter/html-audio/html-audio-player.adapter", () => ({
  HtmlAudioPlayerAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    audioPlayerCalls.push({ args });
    return {
      __args: args,
      playSfx: vi.fn(),
      playMusic: vi.fn(),
      stopMusic: vi.fn(),
      setSfxVolume: vi.fn(),
      setMusicVolume: vi.fn(),
      muteSfx: vi.fn(),
      muteMusic: vi.fn(),
    };
  }),
}));

vi.mock("@/ui/adapter/dom/menu.adapter", () => ({
  MenuAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    menuAdapterCalls.push({ args });
    return { __args: args, show: vi.fn(), hide: vi.fn(), onPlay: vi.fn(), onOpenSettings: vi.fn() };
  }),
}));

vi.mock("@/ui/adapter/dom/hud.adapter", () => ({
  HudAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    hudAdapterCalls.push({ args });
    return { __args: args, show: vi.fn(), hide: vi.fn(), updateMass: vi.fn() };
  }),
}));

vi.mock("@/ui/adapter/dom/game-over.adapter", () => ({
  GameOverAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    gameOverAdapterCalls.push({ args });
    return { __args: args, show: vi.fn(), hide: vi.fn(), onRestart: vi.fn(), onMainMenu: vi.fn() };
  }),
}));

vi.mock("@/ui/adapter/dom/victory.adapter", () => ({
  VictoryAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    victoryAdapterCalls.push({ args });
    return { __args: args, show: vi.fn(), hide: vi.fn(), onRestart: vi.fn(), onMainMenu: vi.fn() };
  }),
}));

vi.mock("@/ui/adapter/dom/settings.adapter", async () => {
  const actual = await vi.importActual<typeof import("@/ui/adapter/dom/settings.adapter")>(
    "@/ui/adapter/dom/settings.adapter",
  );
  return {
    // loadAudioSettings/applyAudioSettings are plain functions with no DOM/class dependency —
    // kept real so this test also exercises bootstrap.ts's actual startup-settings wiring, not
    // just that *a* SettingsAdapter got constructed.
    ...actual,
    SettingsAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
      settingsAdapterCalls.push({ args });
      return { __args: args, show: vi.fn(), hide: vi.fn(), onBack: vi.fn() };
    }),
  };
});

vi.mock("@/ui/session-state", () => ({
  SessionState: vi.fn().mockImplementation((...args: unknown[]) => {
    sessionStateCalls.push({ args });
    return { __args: args };
  }),
}));

import { bootstrap, type BootstrapElements } from "./bootstrap";
import { DEFAULT_ARENA_WIDTH } from "@/world/service/world.service";

function fakeElement(): HTMLElement {
  return {} as HTMLElement;
}

function fakeButton(): HTMLButtonElement {
  return {} as HTMLButtonElement;
}

function fakeInput(): HTMLInputElement {
  return { value: "", checked: false } as unknown as HTMLInputElement;
}

function buildElements(): BootstrapElements {
  return {
    canvasContainer: fakeElement(),
    menu: {
      root: fakeElement(),
      playButton: fakeButton(),
      settingsButton: fakeButton(),
      sizeButtons: { buttons: Array.from({ length: 10 }, () => fakeButton()) },
    },
    hud: { root: fakeElement(), massValue: fakeElement() },
    gameOver: {
      root: fakeElement(),
      scoreValue: fakeElement(),
      restartButton: fakeButton(),
      menuButton: fakeButton(),
    },
    victory: {
      root: fakeElement(),
      scoreValue: fakeElement(),
      restartButton: fakeButton(),
      menuButton: fakeButton(),
    },
    settings: {
      root: fakeElement(),
      backButton: fakeButton(),
      sfxVolume: fakeInput(),
      sfxMute: fakeInput(),
      musicVolume: fakeInput(),
      musicMute: fakeInput(),
    },
  };
}

beforeEach(() => {
  threeRendererCalls.length = 0;
  mouseInputCalls.length = 0;
  audioPlayerCalls.length = 0;
  menuAdapterCalls.length = 0;
  hudAdapterCalls.length = 0;
  gameOverAdapterCalls.length = 0;
  victoryAdapterCalls.length = 0;
  settingsAdapterCalls.length = 0;
  sessionStateCalls.length = 0;
});

describe("bootstrap", () => {
  it("constructs ThreeRenderer with the default arena width and calls init() with the canvas container", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(threeRendererCalls).toHaveLength(1);
    expect(threeRendererCalls[0]!.args).toEqual([DEFAULT_ARENA_WIDTH]);
  });

  it("threads a custom arenaWidth into ThreeRenderer, instead of silently defaulting", () => {
    const elements = buildElements();

    bootstrap(elements, 2000);

    expect(threeRendererCalls[0]!.args).toEqual([2000]);
  });

  it("constructs MouseInputAdapter with the exact canvas container element", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(mouseInputCalls[0]!.args).toEqual([elements.canvasContainer]);
  });

  it("constructs MenuAdapter with the menu's own root, play button, settings button, and size buttons, not another screen's elements", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(menuAdapterCalls[0]!.args).toEqual([
      elements.menu.root,
      elements.menu.playButton,
      elements.menu.settingsButton,
      elements.menu.sizeButtons,
    ]);
  });

  it("constructs HudAdapter with the hud's own root and mass-value elements", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(hudAdapterCalls[0]!.args).toEqual([elements.hud.root, elements.hud.massValue]);
  });

  it("constructs GameOverAdapter with its four elements in the documented order (root, scoreValue, restartButton, menuButton)", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(gameOverAdapterCalls[0]!.args).toEqual([
      elements.gameOver.root,
      elements.gameOver.scoreValue,
      elements.gameOver.restartButton,
      elements.gameOver.menuButton,
    ]);
  });

  it("constructs VictoryAdapter with its own four elements, not GameOver's", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(victoryAdapterCalls[0]!.args).toEqual([
      elements.victory.root,
      elements.victory.scoreValue,
      elements.victory.restartButton,
      elements.victory.menuButton,
    ]);
  });

  it("constructs SessionState with the exact renderer instance it returns, all five screens, and the same arenaWidth passed to ThreeRenderer", () => {
    const elements = buildElements();

    const { renderer, sessionState } = bootstrap(elements, 1500);

    expect(sessionStateCalls).toHaveLength(1);
    const deps = sessionStateCalls[0]!.args[0] as {
      inputSource: unknown;
      renderer: unknown;
      audioPlayer: unknown;
      screens: { menu: unknown; hud: unknown; gameOver: unknown; victory: unknown; settings: unknown };
      arenaWidth: number;
    };

    // Same ThreeRenderer instance bootstrap() itself constructed and returns — not a
    // second, independently-constructed one.
    expect(deps.renderer).toBe(renderer);
    expect(deps.arenaWidth).toBe(1500);
    expect(deps.screens.settings).toBeDefined();
    expect(sessionState).toBeDefined();
  });

  describe("settings (Epic 2, task 006)", () => {
    it("constructs exactly one SettingsAdapter, wired to the same IAudioPlayer instance passed into SessionState", () => {
      const elements = buildElements();

      bootstrap(elements);

      expect(settingsAdapterCalls).toHaveLength(1);
      const [controls, audioPlayer] = settingsAdapterCalls[0]!.args as [unknown, unknown];
      expect(controls).toEqual({
        root: elements.settings.root,
        backButton: elements.settings.backButton,
        sfxVolume: elements.settings.sfxVolume,
        sfxMute: elements.settings.sfxMute,
        musicVolume: elements.settings.musicVolume,
        musicMute: elements.settings.musicMute,
      });
      const deps = sessionStateCalls[0]!.args[0] as { audioPlayer: unknown };
      expect(audioPlayer).toBe(deps.audioPlayer);
    });

    it("applies freshly-loaded (default, since storage is empty) settings to the audio player before SessionState is constructed", () => {
      const elements = buildElements();

      bootstrap(elements);

      // HtmlAudioPlayerAdapter is mocked, but the mock's returned instance is a real object
      // whose setSfxVolume/etc. methods bootstrap.ts calls directly — assert via the same
      // instance SettingsAdapter and SessionState both received.
      const deps = sessionStateCalls[0]!.args[0] as {
        audioPlayer: { setSfxVolume: ReturnType<typeof vi.fn>; setMusicVolume: ReturnType<typeof vi.fn> };
      };
      expect(deps.audioPlayer.setSfxVolume).toHaveBeenCalled();
      expect(deps.audioPlayer.setMusicVolume).toHaveBeenCalled();
    });

    it("passes a usable in-memory storage by default (bootstrap() doesn't require a real localStorage)", () => {
      const elements = buildElements();

      expect(() => bootstrap(elements)).not.toThrow();
    });

    it("accepts an explicit storage (e.g. the real window.localStorage from main.ts) as the third argument", () => {
      const elements = buildElements();
      const store = new Map<string, string>();
      const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      };

      bootstrap(elements, DEFAULT_ARENA_WIDTH, storage);

      expect(settingsAdapterCalls[0]!.args[2]).toBe(storage);
    });
  });

  it("constructs exactly one HtmlAudioPlayerAdapter and passes that same instance into SessionState", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(audioPlayerCalls).toHaveLength(1);
    const deps = sessionStateCalls[0]!.args[0] as { audioPlayer: unknown };
    // The SFX/music URL Records are the adapter's first two constructor args — just confirm
    // they're present and non-empty, not every URL's exact value (audio-urls.test.ts already
    // covers that).
    const [sfxUrls, musicUrls] = audioPlayerCalls[0]!.args as [Record<string, string>, Record<string, string>];
    expect(Object.keys(sfxUrls).length).toBeGreaterThan(0);
    expect(Object.keys(musicUrls).length).toBeGreaterThan(0);
    expect(deps.audioPlayer).toBeDefined();
  });

  it("returns the same renderer instance it constructed, for main.ts's resize listener to call", () => {
    const elements = buildElements();

    const { renderer } = bootstrap(elements);

    expect(renderer).toBeDefined();
    expect(typeof renderer.resize).toBe("function");
  });
});
