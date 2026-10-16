import type { MenuScreen } from "@/ui/session-state";

/**
 * The ten fixed arena sizes a player can pick from the Main Menu. Grown from the original three
 * (1000/1500/2000, Epic 2 task 001) to ten on user request — linear 250-unit steps so the
 * original three values land exactly on the new grid (no existing, already-playtested size was
 * renumbered or dropped). The index-0 value (1000) is the default (matches
 * `DEFAULT_ARENA_WIDTH` and task 001's own fallback when no width is supplied).
 *
 * Top end chosen deliberately conservative relative to a naive linear extension: victory-cap
 * mass scales with the SQUARE of arena width (`VICTORY_CAP_FRACTION` in
 * `src/world/domain/rules.ts` combined with `RADIUS_PER_MASS_SQRT` in
 * `src/world/domain/cell.entity.ts`), so the original 1000->2000 relationship already meant the
 * biggest size needed 4x the win-mass of the smallest. Stopping at 3250 (3.25x) keeps the
 * biggest size's win-mass at ~2.6x of the former Large (≈23,200 vs. ≈8,789) — a meaningfully
 * longer, more epic option without entering the territory Epic 1's own balance pass (027)
 * explicitly flagged as unreachable-in-practice at the extremes it tested (hours, not minutes).
 */
export const ARENA_SIZES: readonly number[] = [
  1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250,
];

export interface MenuSizeButtons {
  /** One button per `ARENA_SIZES` entry, same order, same length. */
  buttons: HTMLButtonElement[];
}

/**
 * Operates on elements the composition root (task 025/026) resolves from `index.html` and
 * hands in — never calls `document.*` itself, so it's unit-testable with plain duck-typed
 * objects (no jsdom in this project's vitest setup), matching the convention
 * `MouseInputAdapter` already established for task 016.
 */
export class MenuAdapter implements MenuScreen {
  private playHandler: ((arenaWidth: number) => void) | null = null;
  private openSettingsHandler: (() => void) | null = null;
  private selectedArenaWidth = ARENA_SIZES[0];

  constructor(
    private readonly root: HTMLElement,
    private readonly playButton: HTMLButtonElement,
    private readonly settingsButton: HTMLButtonElement,
    private readonly sizeButtons: MenuSizeButtons,
  ) {
    if (this.sizeButtons.buttons.length !== ARENA_SIZES.length) {
      throw new Error(
        `MenuAdapter: expected ${ARENA_SIZES.length} size buttons (one per ARENA_SIZES entry), got ${this.sizeButtons.buttons.length}.`,
      );
    }

    this.playButton.addEventListener("click", () => this.playHandler?.(this.selectedArenaWidth));
    this.settingsButton.addEventListener("click", () => this.openSettingsHandler?.());
    this.sizeButtons.buttons.forEach((button, i) => {
      button.addEventListener("click", () => this.selectSize(ARENA_SIZES[i]));
    });
    this.updateActiveButton();
  }

  onPlay(handler: (arenaWidth: number) => void): void {
    this.playHandler = handler;
  }

  onOpenSettings(handler: () => void): void {
    this.openSettingsHandler = handler;
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
    this.sizeButtons.buttons.forEach((button, i) => {
      button.className = this.buttonClassName(ARENA_SIZES[i]);
    });
  }

  private buttonClassName(arenaWidth: number): string {
    const base = "size-picker__button";
    return arenaWidth === this.selectedArenaWidth ? `${base} size-picker__button--active` : base;
  }
}
