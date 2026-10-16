import type { MenuScreen } from "@/ui/session-state";

/** The three fixed arena sizes from docs/epic-2/SPEC.md — Small is the default (matches `DEFAULT_ARENA_WIDTH` and task 001's own fallback when no width is supplied). */
export const ARENA_WIDTH_SMALL = 1000;
export const ARENA_WIDTH_MEDIUM = 1500;
export const ARENA_WIDTH_LARGE = 2000;

export interface MenuSizeButtons {
  small: HTMLButtonElement;
  medium: HTMLButtonElement;
  large: HTMLButtonElement;
}

/**
 * Operates on elements the composition root (task 025/026) resolves from `index.html` and
 * hands in — never calls `document.*` itself, so it's unit-testable with plain duck-typed
 * objects (no jsdom in this project's vitest setup), matching the convention
 * `MouseInputAdapter` already established for task 016.
 */
export class MenuAdapter implements MenuScreen {
  private playHandler: ((arenaWidth: number) => void) | null = null;
  private selectedArenaWidth = ARENA_WIDTH_SMALL;

  constructor(
    private readonly root: HTMLElement,
    private readonly playButton: HTMLButtonElement,
    private readonly sizeButtons: MenuSizeButtons,
  ) {
    this.playButton.addEventListener("click", () => this.playHandler?.(this.selectedArenaWidth));
    this.sizeButtons.small.addEventListener("click", () => this.selectSize(ARENA_WIDTH_SMALL));
    this.sizeButtons.medium.addEventListener("click", () => this.selectSize(ARENA_WIDTH_MEDIUM));
    this.sizeButtons.large.addEventListener("click", () => this.selectSize(ARENA_WIDTH_LARGE));
    this.updateActiveButton();
  }

  onPlay(handler: (arenaWidth: number) => void): void {
    this.playHandler = handler;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private selectSize(arenaWidth: number): void {
    this.selectedArenaWidth = arenaWidth;
    this.updateActiveButton();
  }

  /** Re-derives each button's className from scratch rather than toggling a single class on
   * the previously-active one — simpler to reason about (no "which button was active before"
   * state to track separately from `selectedArenaWidth` itself) and keeps the duck-typed test
   * fakes to a plain `className` string property, matching this file's existing no-jsdom
   * testing convention rather than requiring a fuller `classList` fake. */
  private updateActiveButton(): void {
    this.sizeButtons.small.className = this.buttonClassName(ARENA_WIDTH_SMALL);
    this.sizeButtons.medium.className = this.buttonClassName(ARENA_WIDTH_MEDIUM);
    this.sizeButtons.large.className = this.buttonClassName(ARENA_WIDTH_LARGE);
  }

  private buttonClassName(arenaWidth: number): string {
    const base = "size-picker__button";
    return arenaWidth === this.selectedArenaWidth ? `${base} size-picker__button--active` : base;
  }
}
