import { HtmlAudioPlayerAdapter } from "@/audio/adapter/html-audio/html-audio-player.adapter";
import { MUSIC_URLS, SFX_URLS } from "@/audio/adapter/html-audio/audio-urls";
import { MouseInputAdapter } from "@/input/adapter/dom/mouse-input.adapter";
import { ThreeRenderer } from "@/render/adapter/three/three-renderer";
import { GameOverAdapter } from "@/ui/adapter/dom/game-over.adapter";
import { HudAdapter } from "@/ui/adapter/dom/hud.adapter";
import { MenuAdapter } from "@/ui/adapter/dom/menu.adapter";
import { VictoryAdapter } from "@/ui/adapter/dom/victory.adapter";
import { SessionState } from "@/ui/session-state";
import { DEFAULT_ARENA_WIDTH } from "@/world/service/world.service";

/**
 * Every DOM element the composition root needs, already resolved. Elements are looked up by
 * `main.ts` (the one place in the app allowed to call `document.*`) and handed in here as
 * data, so this file — like every adapter it wires — stays testable without jsdom.
 */
export interface BootstrapElements {
  canvasContainer: HTMLElement;
  menu: {
    root: HTMLElement;
    playButton: HTMLButtonElement;
    sizeButtons: { small: HTMLButtonElement; medium: HTMLButtonElement; large: HTMLButtonElement };
  };
  hud: { root: HTMLElement; massValue: HTMLElement };
  gameOver: {
    root: HTMLElement;
    scoreValue: HTMLElement;
    restartButton: HTMLButtonElement;
    menuButton: HTMLButtonElement;
  };
  victory: {
    root: HTMLElement;
    scoreValue: HTMLElement;
    restartButton: HTMLButtonElement;
    menuButton: HTMLButtonElement;
  };
}

export interface BootstrappedApp {
  sessionState: SessionState;
  renderer: ThreeRenderer;
}

/**
 * The one file in this codebase allowed to import from `render/adapter`, `input/adapter`,
 * and `ui/adapter` at once (per task 025's acceptance criteria) — everywhere else depends
 * only on the ports those adapters implement. Swapping `ThreeRenderer` for a no-op `IRenderer`
 * mock means changing only this function.
 *
 * `arenaWidth` is threaded into both `ThreeRenderer` (sizes the rendered floor/rim) and
 * `SessionState` (sizes the `WorldService` it builds each Play/Restart) from this single
 * parameter, so the two can never silently diverge the way they could when each independently
 * fell back to its own same-valued default constant with no shared source of truth.
 */
export function bootstrap(
  elements: BootstrapElements,
  arenaWidth: number = DEFAULT_ARENA_WIDTH,
): BootstrappedApp {
  const renderer = new ThreeRenderer(arenaWidth);
  renderer.init(elements.canvasContainer);

  const inputSource = new MouseInputAdapter(elements.canvasContainer);
  const audioPlayer = new HtmlAudioPlayerAdapter(SFX_URLS, MUSIC_URLS);

  const menu = new MenuAdapter(elements.menu.root, elements.menu.playButton, elements.menu.sizeButtons);
  const hud = new HudAdapter(elements.hud.root, elements.hud.massValue);
  const gameOver = new GameOverAdapter(
    elements.gameOver.root,
    elements.gameOver.scoreValue,
    elements.gameOver.restartButton,
    elements.gameOver.menuButton,
  );
  const victory = new VictoryAdapter(
    elements.victory.root,
    elements.victory.scoreValue,
    elements.victory.restartButton,
    elements.victory.menuButton,
  );

  const sessionState = new SessionState({
    inputSource,
    renderer,
    audioPlayer,
    screens: { menu, hud, gameOver, victory },
    arenaWidth,
  });

  return { sessionState, renderer };
}
