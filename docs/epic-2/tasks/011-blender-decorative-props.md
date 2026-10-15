# 011 — Blender Scripts for Decorative Static Props

## Goal

Three new low-poly `.glb` models for background scene-dressing: a second empty petri dish, a
pipette, and an agar droplet — following the exact pattern of Epic 1's 5 existing model
scripts.

## Depends on / why it's next

Depends on 010 (the bench plane these props sit on should exist first, so placement in
task 012 has a surface to compose against) — though the model-generation work itself is
independent and could technically happen in parallel. Sequenced after 010 here for a sane
read order.

## Detailed steps

- New scripts in `tools/blender/`: `generate_prop_empty_dish.py`, `generate_prop_pipette.py`,
  `generate_prop_droplet.py` — reuse the shared `tools/blender/_common.py` helpers
  (`clear_scene`, `make_material`, `models_output_dir`) exactly as the 5 existing scripts do,
  don't duplicate that logic again.
- Keep these low-poly — they're static decoration, not entities that need smooth silhouettes
  up close, since they sit in the blurred background (task 013) at the edge of the camera's
  view.
- Export to `src/assets/models/prop_empty_dish.glb`, `prop_pipette.glb`, `prop_droplet.glb`.
- Run each script for real via `blender --background --python tools/blender/generate_prop_*.py`
  and verify non-empty output files, following Epic 1's established verification discipline —
  don't just write the scripts and assume they work.
- Add these three to the Makefile's `blender-models` target glob if it isn't already pattern-
  matched (`tools/blender/generate_*.py` — check it actually picks these up).

## Files touched

- `tools/blender/generate_prop_empty_dish.py`
- `tools/blender/generate_prop_pipette.py`
- `tools/blender/generate_prop_droplet.py`
- `src/assets/models/prop_empty_dish.glb`, `prop_pipette.glb`, `prop_droplet.glb`

## Acceptance criteria

- All three scripts run standalone via `blender --background --python` and produce valid,
  non-empty `.glb` files.
- `make blender-models` regenerates all 8 models (5 from Epic 1 + these 3) without errors.
