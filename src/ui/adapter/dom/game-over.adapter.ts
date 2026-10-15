import type { ResultScreen } from "@/ui/session-state";

/**
 * Same no-`document.*` convention as the other DOM adapters — operates on elements handed
 * in by the composition root. `show(finalMass)` writes the value once, at the moment of
 * death; it is never re-read live afterward, since Restart resets world state before the
 * screen is hidden again.
 */
export class GameOverAdapter implements ResultScreen {
  private restartHandler: (() => void) | null = null;
  private mainMenuHandler: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly scoreValueElement: HTMLElement,
    restartButton: HTMLButtonElement,
    mainMenuButton: HTMLButtonElement,
  ) {
    restartButton.addEventListener("click", () => this.restartHandler?.());
    mainMenuButton.addEventListener("click", () => this.mainMenuHandler?.());
  }

  onRestart(handler: () => void): void {
    this.restartHandler = handler;
  }

  onMainMenu(handler: () => void): void {
    this.mainMenuHandler = handler;
  }

  show(finalMass: number): void {
    // Last line of defense before an upstream NaN (e.g. a division-by-zero bug) would
    // otherwise render the literal string "NaN" to the player.
    this.scoreValueElement.textContent = String(Number.isFinite(finalMass) ? Math.round(finalMass) : 0);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
