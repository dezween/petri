import type { IAudioPlayer } from "@/audio/port/audio.port";

/**
 * The slice of HTMLAudioElement this adapter actually uses, duck-typed so tests can inject a
 * mock instead of touching a real browser Audio API — same pattern this codebase already uses
 * for DOM dependencies elsewhere (e.g. input/adapter/dom/mouse-input.adapter.ts's ClientRectLike).
 */
export interface AudioElementLike {
  play(): void | Promise<void>;
  pause(): void;
  volume: number;
  loop: boolean;
  currentTime: number;
}

export type AudioElementFactory = (url: string) => AudioElementLike;

const defaultFactory: AudioElementFactory = (url) => new Audio(url);

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

/**
 * Plain HTMLAudioElement over Web Audio API: this game needs a handful of short SFX plus one
 * ambient loop, nothing that benefits from a real audio graph (no panning, no mixing, no
 * sample-accurate scheduling) — HTMLAudioElement is simpler and this adapter stays a thin
 * volume/mute state machine either way.
 *
 * SFX playback: a fresh element per playSfx() call (via the factory), so overlapping plays of
 * the same id don't cut each other off. Music: a single persistent looping element, replaced
 * whenever playMusic() is called with a different id.
 */
export class HtmlAudioPlayerAdapter implements IAudioPlayer {
  private sfxVolume = 1;
  private musicVolume = 1;
  private sfxMuted = false;
  private musicMuted = false;

  private musicElement: AudioElementLike | undefined;

  constructor(
    private readonly sfxUrls: Record<string, string>,
    private readonly musicUrls: Record<string, string>,
    private readonly createAudioElement: AudioElementFactory = defaultFactory,
  ) {}

  playSfx(id: string): void {
    const url = this.sfxUrls[id];
    if (url === undefined) return;

    const element = this.createAudioElement(url);
    element.volume = this.effectiveSfxVolume();
    void element.play();
  }

  playMusic(id: string): void {
    const url = this.musicUrls[id];
    if (url === undefined) return;

    this.stopMusic();
    const element = this.createAudioElement(url);
    element.loop = true;
    element.volume = this.effectiveMusicVolume();
    this.musicElement = element;
    void element.play();
  }

  stopMusic(): void {
    if (!this.musicElement) return;
    this.musicElement.pause();
    this.musicElement.currentTime = 0;
    this.musicElement = undefined;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = clampVolume(volume);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    if (this.musicElement) this.musicElement.volume = this.effectiveMusicVolume();
  }

  muteSfx(muted: boolean): void {
    this.sfxMuted = muted;
  }

  muteMusic(muted: boolean): void {
    this.musicMuted = muted;
    if (this.musicElement) this.musicElement.volume = this.effectiveMusicVolume();
  }

  private effectiveSfxVolume(): number {
    return this.sfxMuted ? 0 : this.sfxVolume;
  }

  private effectiveMusicVolume(): number {
    return this.musicMuted ? 0 : this.musicVolume;
  }
}
