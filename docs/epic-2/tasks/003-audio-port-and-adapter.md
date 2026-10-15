# 003 — Audio Port + Adapter

## Goal

New `src/audio/` hexagonal module: an `IAudioPlayer` port and one concrete adapter implementing
it, capable of playing one-shot SFX and a looping background track, with independent SFX/music
volume and mute. No actual sound files or game-event wiring yet — that's tasks 004-005.

## Depends on / why it's next

Depends on nothing else in this epic — new, independent module, same shape as `render`/`input`
(presentation-only, no domain logic, so no `domain/` subfolder needed here either).

## Detailed steps

- `src/audio/port/audio.port.ts`: `IAudioPlayer` interface — something like
  `playSfx(id: string): void`, `playMusic(id: string): void`, `stopMusic(): void`,
  `setSfxVolume(v: number): void`, `setMusicVolume(v: number): void`, `muteSfx(muted: boolean)`,
  `muteMusic(muted: boolean)`. Exact shape is this task's call — keep it minimal and matched to
  what tasks 004-006 actually need, don't over-design speculative methods.
- Pick Web Audio API vs plain `HTMLAudioElement`s based on what's simplest for this scope (a
  handful of short SFX + one music loop) — this doesn't need a full audio graph/mixing engine.
  Document the choice in a short code comment explaining why, the way other adapters in this
  codebase explain non-obvious choices.
- `src/audio/adapter/.../`: the concrete implementation.
- No actual audio asset files in this task — stub with silence or skip-if-missing so the
  adapter is testable without real `.mp3`/`.ogg` files (tasks 004-005 add the real assets and
  wiring).

## Files touched

- `src/audio/port/audio.port.ts`
- `src/audio/adapter/.../*.ts` (exact path per the adapter's chosen technology)

## Acceptance criteria

- Volume/mute state is tracked correctly and independently for SFX vs music (unit-testable
  without a real audio backend — mock/stub the underlying Audio API the same way this
  codebase's other adapters avoid touching real browser APIs in tests).
- Calling `playSfx`/`playMusic` with an unknown id doesn't throw (fails gracefully — later
  tasks will register real ids).
