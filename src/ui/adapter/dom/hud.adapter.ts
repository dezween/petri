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
    this.massValueElement.textContent = String(Math.round(mass));
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
