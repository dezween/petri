import type { MenuScreen } from "@/ui/session-state";

/**
 * Operates on elements the composition root (task 025/026) resolves from `index.html` and
 * hands in — never calls `document.*` itself, so it's unit-testable with plain duck-typed
 * objects (no jsdom in this project's vitest setup), matching the convention
 * `MouseInputAdapter` already established for task 016.
 */
export class MenuAdapter implements MenuScreen {
  private playHandler: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly playButton: HTMLButtonElement,
  ) {
    this.playButton.addEventListener("click", () => this.playHandler?.());
  }

  onPlay(handler: () => void): void {
    this.playHandler = handler;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
