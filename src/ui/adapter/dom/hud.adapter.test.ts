import { describe, expect, it } from "vitest";
import { HudAdapter } from "./hud.adapter";

function createFakeElement() {
  return { hidden: false, textContent: "" };
}

describe("HudAdapter", () => {
  it("writes the rounded mass to the value element's textContent", () => {
    const root = createFakeElement();
    const value = createFakeElement();
    const hud = new HudAdapter(root as unknown as HTMLElement, value as unknown as HTMLElement);

    hud.updateMass(42.7);

    expect(value.textContent).toBe("43");
  });

  it("falls back to 0 instead of displaying the literal string 'NaN'", () => {
    const root = createFakeElement();
    const value = createFakeElement();
    const hud = new HudAdapter(root as unknown as HTMLElement, value as unknown as HTMLElement);

    hud.updateMass(NaN);

    expect(value.textContent).toBe("0");
  });

  it("show()/hide() toggle the root element's hidden attribute", () => {
    const root = createFakeElement();
    const value = createFakeElement();
    const hud = new HudAdapter(root as unknown as HTMLElement, value as unknown as HTMLElement);

    hud.hide();
    expect(root.hidden).toBe(true);

    hud.show();
    expect(root.hidden).toBe(false);
  });
});
