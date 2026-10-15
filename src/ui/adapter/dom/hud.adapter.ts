import type { HudScreen } from "@/ui/session-state";

/**
 * Writes to an existing text element rather than creating its own DOM — same no-`document.*`
 * convention as `MenuAdapter`/`MouseInputAdapter`, so it's testable without jsdom. `updateMass`
 * rounds for display; exact fractional mass has no player-facing meaning.
 */
export class HudAdapter implements HudScreen {
  constructor(
    private readonly root: HTMLElement,
    private readonly massValueElement: HTMLElement,
  ) {}

  updateMass(mass: number): void {
    // Last line of defense before an upstream NaN (e.g. a division-by-zero bug) would
    // otherwise render the literal string "NaN" to the player.
    this.massValueElement.textContent = String(Number.isFinite(mass) ? Math.round(mass) : 0);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
