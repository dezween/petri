import { MouseInputAdapter } from "@/input/adapter/dom/mouse-input.adapter";
import { ThreeRenderer } from "@/render/adapter/three/three-renderer";
import { GameOverAdapter } from "@/ui/adapter/dom/game-over.adapter";
import { HudAdapter } from "@/ui/adapter/dom/hud.adapter";
import { MenuAdapter } from "@/ui/adapter/dom/menu.adapter";
import { VictoryAdapter } from "@/ui/adapter/dom/victory.adapter";
import { SessionState } from "@/ui/session-state";

/**
 * Every DOM element the composition root needs, already resolved. Elements are looked up by
 * `main.ts` (the one place in the app allowed to call `document.*`) and handed in here as
 * data, so this file — like every adapter it wires — stays testable without jsdom.
 */
export interface BootstrapElements {
  canvasContainer: HTMLElement;
  menu: { root: HTMLElement; playButton: HTMLButtonElement };
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
 */
export function bootstrap(elements: BootstrapElements): BootstrappedApp {
  const renderer = new ThreeRenderer();
  renderer.init(elements.canvasContainer);

  const inputSource = new MouseInputAdapter(elements.canvasContainer);

  const menu = new MenuAdapter(elements.menu.root, elements.menu.playButton);
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
    screens: { menu, hud, gameOver, victory },
  });

  return { sessionState, renderer };
}
