import type { IAudioPlayer } from "@/audio/port/audio.port";
import type { SettingsScreen } from "@/ui/session-state";

/** The only persisted state in Epic 2 — audio preferences, nothing else (no score/leaderboard
 * storage; task 006 is explicit that this key/mechanism isn't to be reused for that). */
export interface AudioSettings {
  sfxVolume: number;
  musicVolume: number;
  sfxMuted: boolean;
  musicMuted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  sfxVolume: 0.7,
  musicVolume: 0.5,
  sfxMuted: false,
  musicMuted: false,
};

const STORAGE_KEY = "petri:audio-settings";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Tolerant of a missing key (first-ever visit), corrupt JSON, or a partially-shaped blob —
 * always falls back to defaults field-by-field rather than throwing, per task 006's "a
 * completely fresh browser profile doesn't throw" acceptance criterion.
 */
export function loadAudioSettings(storage: Pick<Storage, "getItem">): AudioSettings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      sfxVolume: clamp01(Number(parsed.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume)),
      musicVolume: clamp01(Number(parsed.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume)),
      sfxMuted: Boolean(parsed.sfxMuted ?? DEFAULT_AUDIO_SETTINGS.sfxMuted),
      musicMuted: Boolean(parsed.musicMuted ?? DEFAULT_AUDIO_SETTINGS.musicMuted),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(storage: Pick<Storage, "setItem">, settings: AudioSettings): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Pushes settings into a live `IAudioPlayer` — called both at startup (before any sound
 * plays) and after every in-Settings-screen change. */
export function applyAudioSettings(audioPlayer: IAudioPlayer, settings: AudioSettings): void {
  audioPlayer.setSfxVolume(settings.sfxVolume);
  audioPlayer.setMusicVolume(settings.musicVolume);
  audioPlayer.muteSfx(settings.sfxMuted);
  audioPlayer.muteMusic(settings.musicMuted);
}

export interface SettingsControls {
  root: HTMLElement;
  backButton: HTMLButtonElement;
  sfxVolume: HTMLInputElement;
  sfxMute: HTMLInputElement;
  musicVolume: HTMLInputElement;
  musicMute: HTMLInputElement;
}

/**
 * Operates on elements the composition root resolves from `index.html` — never calls
 * `document.*` itself, matching `MouseInputAdapter`/`MenuAdapter`'s established convention.
 * `storage` is injected (not the real `window.localStorage`) purely for unit-testability
 * without jsdom; `main.ts` is the one place that passes the real one in.
 */
export class SettingsAdapter implements SettingsScreen {
  private backHandler: (() => void) | null = null;
  private settings: AudioSettings;

  constructor(
    private readonly controls: SettingsControls,
    private readonly audioPlayer: IAudioPlayer,
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
    initialSettings: AudioSettings,
  ) {
    this.settings = initialSettings;
    this.syncControlsFromSettings();

    controls.backButton.addEventListener("click", () => this.backHandler?.());
    controls.sfxVolume.addEventListener("input", () =>
      this.update({ sfxVolume: Number(controls.sfxVolume.value) }),
    );
    controls.sfxMute.addEventListener("change", () => this.update({ sfxMuted: controls.sfxMute.checked }));
    controls.musicVolume.addEventListener("input", () =>
      this.update({ musicVolume: Number(controls.musicVolume.value) }),
    );
    controls.musicMute.addEventListener("change", () =>
      this.update({ musicMuted: controls.musicMute.checked }),
    );
  }

  onBack(handler: () => void): void {
    this.backHandler = handler;
  }

  show(): void {
    this.controls.root.hidden = false;
  }

  hide(): void {
    this.controls.root.hidden = true;
  }

  /** Every control change takes effect immediately on the live `IAudioPlayer` and is persisted
   * right away — no separate "Save" step, per task 006's acceptance criteria. */
  private update(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    applyAudioSettings(this.audioPlayer, this.settings);
    saveAudioSettings(this.storage, this.settings);
  }

  private syncControlsFromSettings(): void {
    this.controls.sfxVolume.value = String(this.settings.sfxVolume);
    this.controls.sfxMute.checked = this.settings.sfxMuted;
    this.controls.musicVolume.value = String(this.settings.musicVolume);
    this.controls.musicMute.checked = this.settings.musicMuted;
  }
}
