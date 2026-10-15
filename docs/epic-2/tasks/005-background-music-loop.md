# 005 — Background Ambient / Music Loop

## Goal

One looping ambient/music track that plays during `Playing` and stops cleanly when leaving it
(Game Over, Victory, back to Main Menu).

## Depends on / why it's next

Depends on 003 (`IAudioPlayer.playMusic`/`stopMusic`). Independent of 004's SFX work, can be
done in either order relative to it, but both depend on 003.

## Detailed steps

- Source or generate one ambient/music loop fitting the microbiology/petri-dish theme —
  something unobtrusive, loopable without an obvious seam.
- Start it when `SessionState` enters `Playing`, stop it on transition out (death, victory, or
  manual return to menu) — hook into the same state-machine transition points task 002/Epic 1's
  `session-state.ts` already defines, don't add a parallel tracking mechanism.
- Respect music volume/mute independently from SFX (already separated in task 003's port).

## Files touched

- New audio asset file (`src/assets/audio/`)
- `src/ui/session-state.ts`

## Acceptance criteria

- Music starts exactly once on entering `Playing` and stops exactly once on leaving it,
  including via Restart (stop-then-restart, not left running underneath a second instance).
- Muting music independently of SFX works (SFX can still play while music is muted and
  vice versa).
