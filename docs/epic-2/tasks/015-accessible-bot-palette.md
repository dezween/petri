# 015 — Accessible Bot Color Palette

## Goal

Replace the current hunter/wanderer color pair (a near-textbook red/green colorblind confusion
case) with a palette distinguishable by hue *and* luminance, not hue alone.

## Depends on / why it's next

Depends on nothing else in this epic structurally, but sequenced near the end since it touches
the same Blender pipeline as tasks 011 (fresh in the implementer's mind) and should land after
the bloom pass (014) so the new colors can be tuned against how bloom actually renders them
(a color that reads fine unlit might blow out or wash together under bloom).

## Detailed steps

- Current colors (confirmed in `tools/blender/generate_bot_*.py`): hunter `(0.85, 0.25, 0.15)`
  (red-orange), wanderer `(0.4, 0.75, 0.55)` (green), fleer `(0.95, 0.85, 0.35)` (yellow).
- Pick a replacement set that's distinguishable under common colorblindness simulations
  (protanopia/deuteranopia at minimum — the red-green forms, by far the most common) — a
  blue/orange-based scheme is a safe, well-established choice for this kind of two-way
  distinction, with fleer's yellow likely fine to keep or only mildly adjust since yellow
  doesn't collide with either hunter or wanderer the way they collide with each other.
- Update `generate_bot_hunter.py`, `generate_bot_wanderer.py` (and `generate_bot_fleer.py` only
  if needed) and regenerate the `.glb` files for real via Blender, verifying output.
- Spot-check the new colors against the bloom pass from task 014 — if bloom washes two colors
  together that were distinguishable unlit, adjust here rather than leaving it for someone else
  to notice later.

## Files touched

- `tools/blender/generate_bot_hunter.py`
- `tools/blender/generate_bot_wanderer.py`
- `tools/blender/generate_bot_fleer.py` (if needed)
- `src/assets/models/bot_hunter.glb`, `bot_wanderer.glb`, `bot_fleer.glb` (regenerated)

## Acceptance criteria

- New hunter/wanderer colors are distinguishable under a deuteranopia/protanopia simulation
  (verify with any available simulation tool/filter — a browser devtools vision-deficiency
  emulation, an online simulator, or a described reasoning check if no tool is available at
  implementation time, but don't skip the check entirely).
- All 8 Blender models (5 entities + 3 props) still regenerate cleanly via `make blender-models`
  after this change.
