# Petri

A single-player, 3D, agar.io-style browser game. Move your cell with the cursor, eat food and
smaller bots, avoid bigger ones. No multiplayer, no skills (no split, no eject mass) — just
growth and survival in a bounded, top-down petri-dish arena.

**Play it now: [dezween.github.io/petri](https://dezween.github.io/petri/)** — deployed
automatically from `main` via GitHub Pages.

Epic 2 adds: three arena sizes (Small/Medium/Large), selectable from the Main Menu; sound
effects and background music with a Settings screen for volume/mute (persisted across reloads);
particle bursts on eating; a lab-bench background with decorative scenery around the dish,
softly out-of-focus relative to the dish itself; a bloom pass for a glowing membrane/agar look;
and a bot color palette chosen to stay distinguishable under red-green color blindness.

## Run it

```bash
make install   # npm install
make dev       # starts the Vite dev server (http://localhost:5173)
```

## Build

```bash
make build     # production build into dist/
make preview   # serve the production build locally
make clean     # remove node_modules, dist, and the Blender/audio scripts' __pycache__
```

## Regenerate the 3D models

The eight game models (player cell, three bot types, food, and three decorative background
props) are generated procedurally by Python (`bpy`) scripts and exported as `.glb` into
`src/assets/models/`:

```bash
make blender-models
```

Requires [Blender](https://www.blender.org/) installed and on your `PATH` (developed against
Blender 5.2.2 LTS). Each script in `tools/blender/generate_*.py` is also runnable standalone:
`blender --background --python tools/blender/generate_food.py`.

## Regenerate the audio

Sound effects and background music are likewise generated procedurally — pure Python stdlib
(`wave`/`math`/`array`, no dependencies) rather than downloaded audio, to keep the asset
pipeline self-contained and licensing-free:

```bash
make generate-audio
```

Each script in `tools/audio/generate_*.py` is also runnable standalone (`python3
tools/audio/generate_eat_food.py`), exporting into `src/assets/audio/`.

## Architecture

Hexagonal (ports & adapters), one directory per module under `src/`: `world` holds the only
real domain/business logic (entities, growth/eating rules, bot AI); `render`, `input`, `audio`,
and `ui` are presentation-only adapters around their respective ports; `session` is the
composition root that wires concrete adapters into services and runs the per-frame game loop.
See [`docs/epic-1/SPEC.md`](docs/epic-1/SPEC.md) for the original design spec and game rules,
and [`docs/epic-1/TASKS.md`](docs/epic-1/TASKS.md) for the numbered task breakdown the initial
build came from. [`docs/epic-2/SPEC.md`](docs/epic-2/SPEC.md) and
[`docs/epic-2/TASKS.md`](docs/epic-2/TASKS.md) cover everything described above — arena sizes,
audio, particles, background scenery, and visual polish — all shipped.

## Tests

```bash
npx vitest run
```

## Releases

Pushing a `v*` tag (e.g. `v1.0.0`) triggers `.github/workflows/release.yml`, which rebuilds
the app, packages `dist/` as `.zip` and `.tar.gz`, and attaches both to a GitHub Release for
that tag with auto-generated release notes. See the
[Releases page](https://github.com/dezween/petri/releases) for downloadable builds.
