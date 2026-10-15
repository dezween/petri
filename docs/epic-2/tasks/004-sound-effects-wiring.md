# 004 — Sound Effects Wired to Game Events

## Goal

Real SFX assets for eating food, eating a bot, player death (Game Over), and victory — wired to
the actual game events that should trigger them.

## Depends on / why it's next

Depends on 003 (needs a working `IAudioPlayer`). Death/victory events already exist as
`GameLoopCallbacks.onPlayerEaten`/`onVictoryReached` (Epic 1) — reuse those directly, don't
duplicate. Eat-food/eat-bot events don't exist yet at this granularity; this task either adds
them now or depends on task 009's finer-grained eat-event hook if it's simpler to land that
hook once and have both audio and particles (task 009) consume it — the implementer's call,
but don't build two separate competing eat-event mechanisms. If task 009 hasn't landed yet when
this is implemented, add the minimal hook here and have task 009 reuse it rather than
reinventing it later.

## Detailed steps

- Source or generate short SFX for: eat-food (light/quick), eat-bot (more substantial), death,
  victory. Keep file sizes small (this is a browser game, not a native app — don't bloat the
  bundle with uncompressed audio).
- Wire `IAudioPlayer.playSfx(...)` calls to the corresponding events via `SessionState`/
  `GameLoopService`'s callback mechanism, following the existing pattern exactly.
- Respect whatever mute/volume state task 003's adapter already tracks — don't bypass it.

## Files touched

- New audio asset files (location: alongside `src/assets/models/`, e.g. `src/assets/audio/`)
- `src/ui/session-state.ts` or `src/session/game-loop.service.ts` (wherever the eat-event hook
  ends up living)
- `src/audio/adapter/.../*.ts` (asset registration)

## Acceptance criteria

- Each of the four events plays its corresponding sound exactly once per occurrence (no
  double-fires, no silent misses) — unit-testable via the same mocked-adapter approach as
  task 003.
- Muting SFX via the adapter's mute method actually silences these (verify no bypass).
