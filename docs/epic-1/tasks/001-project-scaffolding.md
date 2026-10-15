# 001 — Project Scaffolding

**Status**: Done (handled by a sibling setup task running in parallel with this spec).

## Goal

Stand up the base Node/TypeScript/Vite project skeleton so every later task has somewhere to put code.

## Depends on / why it's next

Nothing — this is the root of the dependency chain.

## Detailed steps (as executed)

- `git init`
- `package.json` with Vite, TypeScript, Three.js, sass as dependencies/devDependencies
- `tsconfig.json`
- `vite.config.ts`
- `.gitignore` (node_modules, dist, .DS_Store, etc.)
- `Makefile` with at least `dev`, `build`, `blender-models` targets
- Folder skeleton matching `docs/SPEC.md`'s `src/` layout (empty directories with placeholder files where needed so git tracks them)
- Placeholder `index.html` and `src/main.ts` (minimal, just enough to confirm Vite serves something)

## Files touched

- `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `Makefile`
- `index.html`, `src/main.ts`
- `src/world/`, `src/render/`, `src/input/`, `src/ui/`, `src/session/`, `src/assets/models/`, `tools/blender/` (directory skeletons)

## Acceptance criteria

- `make dev` (or `npm run dev`) starts a Vite dev server without errors.
- `git status` shows a tracked, committed skeleton.
- Folder layout matches `docs/SPEC.md`.
