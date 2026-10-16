import { describe, expect, it, vi } from "vitest";
import { HtmlAudioPlayerAdapter, type AudioElementLike } from "./html-audio-player.adapter";

function fakeElement(): AudioElementLike {
  return { play: vi.fn(), pause: vi.fn(), volume: 1, loop: false, currentTime: 0 };
}

function makeAdapter(sfxUrls: Record<string, string> = {}, musicUrls: Record<string, string> = {}) {
  const created: AudioElementLike[] = [];
  const factory = vi.fn(() => {
    const el = fakeElement();
    created.push(el);
    return el;
  });
  const adapter = new HtmlAudioPlayerAdapter(sfxUrls, musicUrls, factory);
  return { adapter, factory, created };
}

describe("HtmlAudioPlayerAdapter", () => {
  it("plays a known SFX id via the factory and starts playback", () => {
    const { adapter, created } = makeAdapter({ eat: "eat.mp3" });
    adapter.playSfx("eat");
    expect(created).toHaveLength(1);
    expect(created[0].play).toHaveBeenCalledOnce();
  });

  it("does not throw and does not create an element for an unknown SFX id", () => {
    const { adapter, factory } = makeAdapter({ eat: "eat.mp3" });
    expect(() => adapter.playSfx("nope")).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it("does not throw for an unknown music id", () => {
    const { adapter, factory } = makeAdapter({}, { ambient: "ambient.mp3" });
    expect(() => adapter.playMusic("nope")).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it("creates a new element per SFX play so overlapping plays don't cut each other off", () => {
    const { adapter, created } = makeAdapter({ eat: "eat.mp3" });
    adapter.playSfx("eat");
    adapter.playSfx("eat");
    expect(created).toHaveLength(2);
  });

  it("loops music and replaces the previous track when playing a new one", () => {
    const { adapter, created } = makeAdapter({}, { ambient: "a.mp3", intense: "b.mp3" });
    adapter.playMusic("ambient");
    expect(created[0].loop).toBe(true);
    adapter.playMusic("intense");
    expect(created[0].pause).toHaveBeenCalledOnce();
    expect(created).toHaveLength(2);
  });

  it("stopMusic pauses and resets the current track, and is a no-op if nothing is playing", () => {
    const { adapter, created } = makeAdapter({}, { ambient: "a.mp3" });
    expect(() => adapter.stopMusic()).not.toThrow();

    adapter.playMusic("ambient");
    adapter.stopMusic();
    expect(created[0].pause).toHaveBeenCalledOnce();
    expect(created[0].currentTime).toBe(0);
  });

  it("tracks SFX and music volume independently, clamped to [0, 1]", () => {
    const { adapter, created } = makeAdapter({ eat: "e.mp3" }, { ambient: "a.mp3" });
    adapter.setSfxVolume(2);
    adapter.setMusicVolume(-1);
    adapter.playSfx("eat");
    adapter.playMusic("ambient");
    expect(created[0].volume).toBe(1);
    expect(created[1].volume).toBe(0);
  });

  it("muting SFX affects only future SFX plays, not music", () => {
    const { adapter, created } = makeAdapter({ eat: "e.mp3" }, { ambient: "a.mp3" });
    adapter.muteSfx(true);
    adapter.playSfx("eat");
    adapter.playMusic("ambient");
    expect(created[0].volume).toBe(0);
    expect(created[1].volume).toBe(1);
  });

  it("muting music applies immediately to a track already playing", () => {
    const { adapter, created } = makeAdapter({}, { ambient: "a.mp3" });
    adapter.playMusic("ambient");
    adapter.muteMusic(true);
    expect(created[0].volume).toBe(0);
    adapter.muteMusic(false);
    expect(created[0].volume).toBe(1);
  });

  it("changing music volume applies immediately to a track already playing", () => {
    const { adapter, created } = makeAdapter({}, { ambient: "a.mp3" });
    adapter.playMusic("ambient");
    adapter.setMusicVolume(0.3);
    expect(created[0].volume).toBe(0.3);
  });
});
