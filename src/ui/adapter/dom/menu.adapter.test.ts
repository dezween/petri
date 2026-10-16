import { describe, expect, it, vi } from "vitest";
import { ARENA_SIZES, MenuAdapter } from "./menu.adapter";

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
  return { buttons: ARENA_SIZES.map(() => createFakeButton()) };
}

function setup() {
  const root = createFakeElement();
  const playButton = createFakeButton();
  const settingsButton = createFakeButton();
  const sizeButtons = createFakeSizeButtons();
  const adapter = new MenuAdapter(
    root as unknown as HTMLElement,
    playButton as unknown as HTMLButtonElement,
    settingsButton as unknown as HTMLButtonElement,
    sizeButtons as unknown as import("./menu.adapter").MenuSizeButtons,
  );
  return { root, playButton, settingsButton, sizeButtons, adapter };
}

describe("MenuAdapter", () => {
  it("registers a click listener on the play button at construction", () => {
    const { playButton } = setup();

    expect(playButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("calls the onPlay handler with the default (first/smallest) width when the button is clicked with no size interaction", () => {
    const { playButton, adapter } = setup();
    const onPlay = vi.fn();

    adapter.onPlay(onPlay);
    playButton.click();

    expect(onPlay).toHaveBeenCalledWith(ARENA_SIZES[0]);
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

  it("throws at construction if the number of size buttons doesn't match ARENA_SIZES — a silent off-by-one here would leave one size unreachable while scrambling every later button's handler", () => {
    const root = createFakeElement();
    const playButton = createFakeButton();
    const settingsButton = createFakeButton();
    const tooFewButtons = { buttons: ARENA_SIZES.slice(0, -1).map(() => createFakeButton()) };

    expect(
      () =>
        new MenuAdapter(
          root as unknown as HTMLElement,
          playButton as unknown as HTMLButtonElement,
          settingsButton as unknown as HTMLButtonElement,
          tooFewButtons as unknown as import("./menu.adapter").MenuSizeButtons,
        ),
    ).toThrow(/expected 10 size buttons/);
  });

  describe("settings button (Epic 2, task 007)", () => {
    it("registers a click listener on the settings button at construction", () => {
      const { settingsButton } = setup();

      expect(settingsButton.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    });

    it("calls the onOpenSettings handler when the settings button is clicked", () => {
      const { settingsButton, adapter } = setup();
      const onOpenSettings = vi.fn();

      adapter.onOpenSettings(onOpenSettings);
      settingsButton.click();

      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it("does nothing on click when no onOpenSettings handler has been registered yet", () => {
      const { settingsButton } = setup();

      expect(() => settingsButton.click()).not.toThrow();
    });
  });

  describe("size picker (Epic 2, task 002; grown to 10 sizes in a later pass)", () => {
    it("the first (smallest) size is active by default, matching task 001's own fallback", () => {
      const { sizeButtons } = setup();

      expect(sizeButtons.buttons[0].className).toContain("size-picker__button--active");
      for (const button of sizeButtons.buttons.slice(1)) {
        expect(button.className).not.toContain("--active");
      }
    });

    it("every ARENA_SIZES entry is independently selectable and reported to onPlay", () => {
      for (let i = 0; i < ARENA_SIZES.length; i++) {
        const { sizeButtons, playButton, adapter } = setup();
        const onPlay = vi.fn();
        adapter.onPlay(onPlay);

        sizeButtons.buttons[i].click();
        playButton.click();

        expect(onPlay).toHaveBeenCalledWith(ARENA_SIZES[i]);
        expect(sizeButtons.buttons[i].className).toContain("size-picker__button--active");
      }
    });

    it("re-selecting a different size after an earlier choice switches the active button, not accumulates", () => {
      const { sizeButtons } = setup();

      sizeButtons.buttons[9].click();
      sizeButtons.buttons[2].click();

      expect(sizeButtons.buttons[2].className).toContain("size-picker__button--active");
      expect(sizeButtons.buttons[9].className).not.toContain("--active");
      expect(sizeButtons.buttons[0].className).not.toContain("--active");
    });
  });
});
