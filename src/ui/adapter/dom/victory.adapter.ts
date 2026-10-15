import type { ResultScreen } from "@/ui/session-state";

/**
 * Structurally identical to `GameOverAdapter` per task 022's own doc ("behave identically to
 * task 021's") — kept as its own class rather than a shared base since the only difference
 * is which trigger calls it and the congratulatory copy already baked into index.html's
 * victory-screen markup; two small classes read more clearly here than an abstraction whose
 * only job is to avoid them.
 */
export class VictoryAdapter implements ResultScreen {
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
    this.scoreValueElement.textContent = String(Math.round(finalMass));
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
