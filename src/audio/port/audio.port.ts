/**
 * Minimal audio port: one-shot SFX by id, a single looping music track, independent SFX/music
 * volume and mute. Deliberately not a full mixing-graph API (no panning, no per-SFX volume,
 * no crossfade) — this game only ever needs a handful of short SFX plus one ambient loop
 * (docs/epic-2/SPEC.md), so a bigger surface would be speculative.
 */
export interface IAudioPlayer {
  /** Fire-and-forget. Unknown ids are a silent no-op — later tasks register real ids. */
  playSfx(id: string): void;
  /** Starts looping the given track, replacing whatever music was already playing. */
  playMusic(id: string): void;
  stopMusic(): void;
  /** Volume is clamped to [0, 1]. */
  setSfxVolume(volume: number): void;
  setMusicVolume(volume: number): void;
  muteSfx(muted: boolean): void;
  muteMusic(muted: boolean): void;
}
