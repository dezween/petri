import { describe, expect, it, vi } from "vitest";
import { MenuAdapter } from "./menu.adapter";

/** Minimal duck-typed stand-ins — no jsdom in this project's vitest setup. */
function createFakeElement() {
  return { hidden: false };
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

describe("MenuAdapter", () => {
  it("registers a click listener on the play button at construction", () => {
    const root = createFakeElement();
    const button = createFakeButton();

    new MenuAdapter(root as unknown as HTMLElement, button as unknown as HTMLButtonElement);

    expect(button.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("calls the onPlay handler when the button is clicked", () => {
    const root = createFakeElement();
    const button = createFakeButton();
    const adapter = new MenuAdapter(root as unknown as HTMLElement, button as unknown as HTMLButtonElement);
    const onPlay = vi.fn();

    adapter.onPlay(onPlay);
    button.click();

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("does nothing on click when no handler has been registered yet", () => {
    const root = createFakeElement();
    const button = createFakeButton();
    new MenuAdapter(root as unknown as HTMLElement, button as unknown as HTMLButtonElement);

    expect(() => button.click()).not.toThrow();
  });

  it("show()/hide() toggle the root element's hidden attribute", () => {
    const root = createFakeElement();
    const adapter = new MenuAdapter(root as unknown as HTMLElement, createFakeButton() as unknown as HTMLButtonElement);

    adapter.hide();
    expect(root.hidden).toBe(true);

    adapter.show();
    expect(root.hidden).toBe(false);
  });
});
