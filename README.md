# Petri

A single-player, 3D, agar.io-style browser game. Move your cell with the cursor, eat food and
smaller bots, avoid bigger ones. No multiplayer, no skills (no split, no eject mass) — just
growth and survival in a bounded, top-down petri-dish arena.

## Run it

```bash
make install   # npm install
make dev       # starts the Vite dev server (http://localhost:5173)
```

## Build

```bash
make build     # production build into dist/
make preview   # serve the production build locally
```

## Regenerate the 3D models

The five game models (player cell, three bot types, food) are generated procedurally by
Python (`bpy`) scripts and exported as `.glb` into `src/assets/models/`:

```bash
make blender-models
```

Requires [Blender](https://www.blender.org/) installed and on your `PATH` (developed against
Blender 5.2.2 LTS). Each script in `tools/blender/generate_*.py` is also runnable standalone:
`blender --background --python tools/blender/generate_food.py`.

## Architecture

Hexagonal (ports & adapters), one directory per module under `src/`: `world` holds the only
real domain/business logic (entities, growth/eating rules, bot AI); `render`, `input`, and `ui`
are presentation-only adapters around their respective ports; `session` is the composition
root that wires concrete adapters into services and runs the per-frame game loop. See
[`docs/SPEC.md`](docs/SPEC.md) for the full design spec and game rules, and
[`docs/TASKS.md`](docs/TASKS.md) for the numbered task breakdown this codebase was built from.

## Tests

```bash
npx vitest run
```
