import { describe, expect, it, vi } from "vitest";
import { VictoryAdapter } from "./victory.adapter";

function createFakeElement() {
  return { hidden: false, textContent: "" };
}

function createFakeButton() {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener: vi.fn((type: string, handler: () => void) => {
      listeners.set(type, handler);
    }),
    click() {
      listeners.get("click")?.();
    },
  };
}

function build() {
  const root = createFakeElement();
  const scoreValue = createFakeElement();
  const restartButton = createFakeButton();
  const mainMenuButton = createFakeButton();
  const adapter = new VictoryAdapter(
    root as unknown as HTMLElement,
    scoreValue as unknown as HTMLElement,
    restartButton as unknown as HTMLButtonElement,
    mainMenuButton as unknown as HTMLButtonElement,
  );
  return { adapter, root, scoreValue, restartButton, mainMenuButton };
}

describe("VictoryAdapter", () => {
  it("show() writes the rounded final mass and unhides the root", () => {
    const { adapter, root, scoreValue } = build();

    adapter.show(375.2);

    expect(scoreValue.textContent).toBe("375");
    expect(root.hidden).toBe(false);
  });

  it("hide() hides the root", () => {
    const { adapter, root } = build();
    adapter.hide();
    expect(root.hidden).toBe(true);
  });

  it("calls the restart handler when the restart button is clicked", () => {
    const { adapter, restartButton } = build();
    const onRestart = vi.fn();
    adapter.onRestart(onRestart);

    restartButton.click();

    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("calls the main menu handler when the main menu button is clicked", () => {
    const { adapter, mainMenuButton } = build();
    const onMainMenu = vi.fn();
    adapter.onMainMenu(onMainMenu);

    mainMenuButton.click();

    expect(onMainMenu).toHaveBeenCalledTimes(1);
  });
});
