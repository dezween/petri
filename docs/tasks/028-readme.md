# 028 — README.md

## Goal

Document how to run, build, and regenerate assets for the finished project, with a brief architecture summary pointing back to `docs/SPEC.md` for anyone picking up the codebase cold.

## Depends on / why it's next

Depends on everything else — it documents the finished state of the project, so it's correctly last.

## Detailed steps

- `README.md` at the repo root covering:
  - What the project is (one or two sentences — 3D agar.io-style single-player game with bots, no multiplayer/skills).
  - How to run: `make dev` (or equivalent npm scripts).
  - How to build: `make build`.
  - How to regenerate 3D models: `make blender-models` (requires Blender installed — note the version used during development).
  - Architecture summary: 2-3 sentences on the hexagonal/ports-and-adapters layout, with a link to `docs/SPEC.md` for the full picture, and a link to `docs/TASKS.md` for the build history/task breakdown.

## Files touched

- `README.md`

## Acceptance criteria

- A developer with no prior context can clone the repo, read the README, and get the dev server running without needing to ask questions.
- Every command mentioned in the README actually works as written (verified by running each one).
