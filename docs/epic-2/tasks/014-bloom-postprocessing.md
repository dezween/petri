# 014 — Bloom Post-Processing

## Goal

A bloom pass for a glowing membrane/agar look on the player cell, bots, and food.

## Depends on / why it's next

Depends on 013's `EffectComposer` setup — adds a pass to the same pipeline rather than standing
up a second, competing post-processing chain.

## Detailed steps

- Add `UnrealBloomPass` (or equivalent) to the composer from task 013.
- Tune threshold/strength/radius so translucent membranes and bright food particles glow
  noticeably without blowing out the whole scene to white or making text/UI overlays (which
  render outside the WebGL canvas, in DOM — unaffected either way) hard to read.
- Make sure bloom doesn't interact badly with the DOF blur from task 013 (e.g. double-blurring
  the background into mush) — verify visually, adjust pass ordering if needed.

## Files touched

- `src/render/adapter/three/post-processing.ts`

## Acceptance criteria

- Bright/translucent elements (player membrane, food) visibly glow; the effect reads as
  intentional polish, not as a washed-out or blown-out scene (judged by the playtest in
  task 016 since this is inherently a visual-feel call, not a unit-testable property).
