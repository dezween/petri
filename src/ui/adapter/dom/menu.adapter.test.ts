import { describe, expect, it, vi } from "vitest";
import { ARENA_WIDTH_LARGE, ARENA_WIDTH_MEDIUM, ARENA_WIDTH_SMALL, MenuAdapter } from "./menu.adapter";

/** Minimal duck-typed stand-ins — no jsdom in this project's vitest setup. */
function createFakeElement() {
  return { hidden: false };
}

function createFakeButton() {
  const listeners = new Map<string, () => void>();
  return {
    className: "",
    addEventListener: vi.fn((type: string, handler: () => void) => {
      listeners.set(type, handler);
    }),
    click() {
      listeners.get("click")?.();
    },
  };
}

function createFakeSizeButtons() {
  return { small: createFakeButton(), medium: createFakeButton(), large: createFakeButton() };
}

function setup() {
  const root = createFakeElement();
  const playButton = createFakeButton();
  const sizeButtons = createFakeSizeButtons();
  const adapter = new MenuAdapter(
    root as unknown as HTMLElement,
    playButton as unknown as HTMLButtonElement,
    sizeButtons as unknown as import("./menu.adapter").MenuSizeButtons,
  );
  return { root, playButton, sizeButtons, adapter };
}

describe("MenuAdapter", () => {
  it("registers a click listener on the play button at construction", () => {
    const { playButton } = setup();

    expect(playButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("calls the onPlay handler with the default (Small) width when the button is clicked with no size interaction", () => {
    const { playButton, adapter } = setup();
    const onPlay = vi.fn();

    adapter.onPlay(onPlay);
    playButton.click();

    expect(onPlay).toHaveBeenCalledWith(ARENA_WIDTH_SMALL);
  });

  it("does nothing on click when no handler has been registered yet", () => {
    const { playButton } = setup();

    expect(() => playButton.click()).not.toThrow();
  });

  it("show()/hide() toggle the root element's hidden attribute", () => {
    const { root, adapter } = setup();

    adapter.hide();
    expect(root.hidden).toBe(true);

    adapter.show();
    expect(root.hidden).toBe(false);
  });

  describe("size picker (Epic 2, task 002)", () => {
    it("Small is active by default, matching task 001's own fallback", () => {
      const { sizeButtons } = setup();

      expect(sizeButtons.small.className).toContain("size-picker__button--active");
      expect(sizeButtons.medium.className).not.toContain("--active");
      expect(sizeButtons.large.className).not.toContain("--active");
    });

    it("selecting Medium updates the active button and what Play reports", () => {
      const { sizeButtons, playButton, adapter } = setup();
      const onPlay = vi.fn();
      adapter.onPlay(onPlay);

      sizeButtons.medium.click();
      playButton.click();

      expect(onPlay).toHaveBeenCalledWith(ARENA_WIDTH_MEDIUM);
      expect(sizeButtons.medium.className).toContain("size-picker__button--active");
      expect(sizeButtons.small.className).not.toContain("--active");
    });

    it("selecting Large updates the active button and what Play reports", () => {
      const { sizeButtons, playButton, adapter } = setup();
      const onPlay = vi.fn();
      adapter.onPlay(onPlay);

      sizeButtons.large.click();
      playButton.click();

      expect(onPlay).toHaveBeenCalledWith(ARENA_WIDTH_LARGE);
      expect(sizeButtons.large.className).toContain("size-picker__button--active");
    });

    it("re-selecting a different size after an earlier choice switches the active button, not accumulates", () => {
      const { sizeButtons } = setup();

      sizeButtons.large.click();
      sizeButtons.medium.click();

      expect(sizeButtons.medium.className).toContain("size-picker__button--active");
      expect(sizeButtons.large.className).not.toContain("--active");
    });
  });
});
