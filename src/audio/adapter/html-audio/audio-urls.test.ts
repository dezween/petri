import { describe, expect, it } from "vitest";
import { MUSIC_URLS, SFX_URLS } from "./audio-urls";

describe("SFX_URLS", () => {
  it("resolves every registered sfx id into the src/assets/audio/ directory with a matching .wav filename", () => {
    for (const [id, url] of Object.entries(SFX_URLS)) {
      expect(url).toContain("/src/assets/audio/");
      expect(url.endsWith(`${id}.wav`)).toBe(true);
    }
  });

  it("registers eat-food, eat-bot, death, and victory — the four SFX task 004 wires up", () => {
    expect(Object.keys(SFX_URLS).sort()).toEqual(["death", "eat-bot", "eat-food", "victory"]);
  });
});

describe("MUSIC_URLS", () => {
  it("registers ambient-music, resolved into src/assets/audio/", () => {
    expect(MUSIC_URLS["ambient-music"]).toContain("/src/assets/audio/ambient-music.wav");
  });
});
