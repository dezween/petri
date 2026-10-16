import { describe, expect, it, vi } from "vitest";
import type { IAudioPlayer } from "@/audio/port/audio.port";
import {
  applyAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
  SettingsAdapter,
  type AudioSettings,
  type SettingsControls,
} from "./settings.adapter";

function createFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    __store: store,
  };
}

function createFakeAudioPlayer(): IAudioPlayer {
  return {
    playSfx: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    setSfxVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    muteSfx: vi.fn(),
    muteMusic: vi.fn(),
  };
}

function createFakeElement() {
  return { hidden: false };
}

function createFakeButton() {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener: vi.fn((type: string, handler: () => void) => listeners.set(type, handler)),
    click() {
      listeners.get("click")?.();
    },
  };
}

function createFakeInput() {
  const listeners = new Map<string, () => void>();
  return {
    value: "0",
    checked: false,
    addEventListener: vi.fn((type: string, handler: () => void) => listeners.set(type, handler)),
    fire(type: string) {
      listeners.get(type)?.();
    },
  };
}

function setup(initialSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }) {
  const root = createFakeElement();
  const backButton = createFakeButton();
  const sfxVolume = createFakeInput();
  const sfxMute = createFakeInput();
  const musicVolume = createFakeInput();
  const musicMute = createFakeInput();
  const audioPlayer = createFakeAudioPlayer();
  const storage = createFakeStorage();

  const controls = {
    root,
    backButton,
    sfxVolume,
    sfxMute,
    musicVolume,
    musicMute,
  } as unknown as SettingsControls;

  const adapter = new SettingsAdapter(controls, audioPlayer, storage, initialSettings);

  return { adapter, root, backButton, sfxVolume, sfxMute, musicVolume, musicMute, audioPlayer, storage };
}

describe("loadAudioSettings", () => {
  it("returns defaults when storage has no saved entry (first-ever visit)", () => {
    const storage = createFakeStorage();

    const settings = loadAudioSettings(storage);

    expect(settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("does not throw and falls back to defaults on corrupt JSON", () => {
    const storage = createFakeStorage({ "petri:audio-settings": "{not json" });

    expect(() => loadAudioSettings(storage)).not.toThrow();
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("round-trips a previously saved value", () => {
    const storage = createFakeStorage();
    const saved: AudioSettings = { sfxVolume: 0.3, musicVolume: 0.9, sfxMuted: true, musicMuted: false };
    saveAudioSettings(storage, saved);

    expect(loadAudioSettings(storage)).toEqual(saved);
  });

  it("clamps an out-of-range volume from a corrupted/hand-edited blob instead of trusting it", () => {
    const storage = createFakeStorage({
      "petri:audio-settings": JSON.stringify({ sfxVolume: 5, musicVolume: -2, sfxMuted: false, musicMuted: false }),
    });

    const settings = loadAudioSettings(storage);

    expect(settings.sfxVolume).toBe(1);
    expect(settings.musicVolume).toBe(0);
  });

  it("fills in defaults for a partially-shaped (e.g. older-schema) blob rather than throwing", () => {
    const storage = createFakeStorage({ "petri:audio-settings": JSON.stringify({ sfxVolume: 0.2 }) });

    const settings = loadAudioSettings(storage);

    expect(settings.sfxVolume).toBe(0.2);
    expect(settings.musicVolume).toBe(DEFAULT_AUDIO_SETTINGS.musicVolume);
    expect(settings.sfxMuted).toBe(DEFAULT_AUDIO_SETTINGS.sfxMuted);
  });
});

describe("applyAudioSettings", () => {
  it("pushes every field onto the given IAudioPlayer", () => {
    const audioPlayer = createFakeAudioPlayer();
    const settings: AudioSettings = { sfxVolume: 0.4, musicVolume: 0.6, sfxMuted: true, musicMuted: false };

    applyAudioSettings(audioPlayer, settings);

    expect(audioPlayer.setSfxVolume).toHaveBeenCalledWith(0.4);
    expect(audioPlayer.setMusicVolume).toHaveBeenCalledWith(0.6);
    expect(audioPlayer.muteSfx).toHaveBeenCalledWith(true);
    expect(audioPlayer.muteMusic).toHaveBeenCalledWith(false);
  });
});

describe("SettingsAdapter", () => {
  it("initializes the DOM controls from the settings passed in at construction", () => {
    const { sfxVolume, sfxMute, musicVolume, musicMute } = setup({
      sfxVolume: 0.3,
      musicVolume: 0.8,
      sfxMuted: true,
      musicMuted: false,
    });

    expect(sfxVolume.value).toBe("0.3");
    expect(sfxMute.checked).toBe(true);
    expect(musicVolume.value).toBe("0.8");
    expect(musicMute.checked).toBe(false);
  });

  it("show()/hide() toggle the root element's hidden attribute", () => {
    const { adapter, root } = setup();

    adapter.show();
    expect(root.hidden).toBe(false);

    adapter.hide();
    expect(root.hidden).toBe(true);
  });

  it("calls the onBack handler when the back button is clicked", () => {
    const { adapter, backButton } = setup();
    const onBack = vi.fn();
    adapter.onBack(onBack);

    backButton.click();

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("changing the SFX volume slider immediately applies it to the live audio player and persists it", () => {
    const { sfxVolume, audioPlayer, storage } = setup();
    sfxVolume.value = "0.9";

    sfxVolume.fire("input");

    expect(audioPlayer.setSfxVolume).toHaveBeenCalledWith(0.9);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [, saved] = storage.setItem.mock.calls[0]!;
    expect(JSON.parse(saved as string).sfxVolume).toBe(0.9);
  });

  it("toggling the music mute checkbox immediately applies it and persists it", () => {
    const { musicMute, audioPlayer, storage } = setup();
    musicMute.checked = true;

    musicMute.fire("change");

    expect(audioPlayer.muteMusic).toHaveBeenCalledWith(true);
    const [, saved] = storage.setItem.mock.calls[0]!;
    expect(JSON.parse(saved as string).musicMuted).toBe(true);
  });

  it("changing the music volume does not clobber a previously-changed SFX setting (settings are merged, not replaced)", () => {
    const { sfxVolume, musicVolume, storage } = setup();
    sfxVolume.value = "0.2";
    sfxVolume.fire("input");

    musicVolume.value = "0.6";
    musicVolume.fire("input");

    const lastSaved = JSON.parse(storage.setItem.mock.calls[1]![1] as string);
    expect(lastSaved.sfxVolume).toBe(0.2);
    expect(lastSaved.musicVolume).toBe(0.6);
  });
});
