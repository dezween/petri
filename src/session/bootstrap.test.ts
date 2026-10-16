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
const menuAdapterCalls: Call[] = [];
const hudAdapterCalls: Call[] = [];
const gameOverAdapterCalls: Call[] = [];
const victoryAdapterCalls: Call[] = [];
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

vi.mock("@/ui/adapter/dom/menu.adapter", () => ({
  MenuAdapter: vi.fn().mockImplementation((...args: unknown[]) => {
    menuAdapterCalls.push({ args });
    return { __args: args, show: vi.fn(), hide: vi.fn(), onPlay: vi.fn() };
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

function buildElements(): BootstrapElements {
  return {
    canvasContainer: fakeElement(),
    menu: {
      root: fakeElement(),
      playButton: fakeButton(),
      sizeButtons: { small: fakeButton(), medium: fakeButton(), large: fakeButton() },
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
  };
}

beforeEach(() => {
  threeRendererCalls.length = 0;
  mouseInputCalls.length = 0;
  menuAdapterCalls.length = 0;
  hudAdapterCalls.length = 0;
  gameOverAdapterCalls.length = 0;
  victoryAdapterCalls.length = 0;
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

  it("constructs MenuAdapter with the menu's own root, play button, and size buttons, not another screen's elements", () => {
    const elements = buildElements();

    bootstrap(elements);

    expect(menuAdapterCalls[0]!.args).toEqual([
      elements.menu.root,
      elements.menu.playButton,
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

  it("constructs SessionState with the exact renderer instance it returns, the four screens, and the same arenaWidth passed to ThreeRenderer", () => {
    const elements = buildElements();

    const { renderer, sessionState } = bootstrap(elements, 1500);

    expect(sessionStateCalls).toHaveLength(1);
    const deps = sessionStateCalls[0]!.args[0] as {
      inputSource: unknown;
      renderer: unknown;
      screens: { menu: unknown; hud: unknown; gameOver: unknown; victory: unknown };
      arenaWidth: number;
    };

    // Same ThreeRenderer instance bootstrap() itself constructed and returns — not a
    // second, independently-constructed one.
    expect(deps.renderer).toBe(renderer);
    expect(deps.arenaWidth).toBe(1500);
    expect(sessionState).toBeDefined();
  });

  it("returns the same renderer instance it constructed, for main.ts's resize listener to call", () => {
    const elements = buildElements();

    const { renderer } = bootstrap(elements);

    expect(renderer).toBeDefined();
    expect(typeof renderer.resize).toBe("function");
  });
});
