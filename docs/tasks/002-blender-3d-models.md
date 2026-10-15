# 002 — Blender 3D Models

**Status**: Done (handled by a sibling model-generation task running in parallel with this spec).

## Goal

Produce the five low-poly `.glb` models the game needs, via headless Blender Python scripts, so the render layer (tasks 013-015) has real assets to load.

## Depends on / why it's next

Nothing beyond 001 (needs `src/assets/models/` and `tools/blender/` to exist). Runs independently of 003-010 (domain/world logic) — models and game logic don't depend on each other.

## Detailed steps (as executed)

For each model, a standalone `bpy` script in `tools/blender/`, run via:

```
blender --background --python tools/blender/<script>.py
```

Models produced, matching the theme in `docs/SPEC.md`:

- `player_cell.glb` — translucent membrane + visible nucleus
- `bot_wanderer.glb` — round, passive silhouette
- `bot_hunter.glb` — elongated "bacillus" shape
- `bot_fleer.glb` — round body with small spike/flagella accents
- `food.glb` — small colored "cocci" particle

All exported low-poly (instanced many times on screen — this is a hard performance requirement, not a style choice).

## Files touched

- `tools/blender/generate_player_cell.py`, `tools/blender/generate_bot_wanderer.py`, `tools/blender/generate_bot_hunter.py`, `tools/blender/generate_bot_fleer.py`, `tools/blender/generate_food.py`
- `src/assets/models/player_cell.glb`, `src/assets/models/bot_wanderer.glb`, `src/assets/models/bot_hunter.glb`, `src/assets/models/bot_fleer.glb`, `src/assets/models/food.glb`

## Acceptance criteria

- All 5 `.glb` files exist under `src/assets/models/` and load without error in a GLTFLoader smoke test (verified properly in task 013).
- Each Blender script re-runs standalone and reproduces its model (regeneration path for later tweaks, wired to `make blender-models`).
