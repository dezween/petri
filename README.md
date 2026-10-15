# Petri

A single-player, 3D, agar.io-style browser game. Move your cell with the cursor, eat food and
smaller bots, avoid bigger ones. No multiplayer, no skills (no split, no eject mass) — just
growth and survival in a bounded, top-down petri-dish arena.

**Play it now: [dezween.github.io/petri](https://dezween.github.io/petri/)** — deployed
automatically from `main` via GitHub Pages.

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
[`docs/epic-1/SPEC.md`](docs/epic-1/SPEC.md) for the full design spec and game rules, and
[`docs/epic-1/TASKS.md`](docs/epic-1/TASKS.md) for the numbered task breakdown this codebase was built from.
See [`docs/epic-2/SPEC.md`](docs/epic-2/SPEC.md) for what's planned next.

## Tests

```bash
npx vitest run
```

## Releases

Pushing a `v*` tag (e.g. `v1.0.0`) triggers `.github/workflows/release.yml`, which rebuilds
the app, packages `dist/` as `.zip` and `.tar.gz`, and attaches both to a GitHub Release for
that tag with auto-generated release notes. See the
[Releases page](https://github.com/dezween/petri/releases) for downloadable builds.
