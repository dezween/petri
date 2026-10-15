---
phase: initial-scaffolding
reviewed: 2026-10-15T00:00:00Z
depth: deep
files_reviewed: 42
files_reviewed_list:
  - .gitignore
  - Makefile
  - docs/SPEC.md
  - docs/TASKS.md
  - docs/tasks/001-project-scaffolding.md
  - docs/tasks/002-blender-3d-models.md
  - docs/tasks/003-core-domain-entities.md
  - docs/tasks/004-world-rules.md
  - docs/tasks/005-world-service-tick.md
  - docs/tasks/006-bot-ai-wanderer.md
  - docs/tasks/007-bot-ai-hunter.md
  - docs/tasks/008-bot-ai-fleer.md
  - docs/tasks/009-bot-population-manager.md
  - docs/tasks/010-food-spawning-system.md
  - docs/tasks/011-render-port.md
  - docs/tasks/012-threejs-scene-camera.md
  - docs/tasks/013-model-loader-adapter.md
  - docs/tasks/014-mesh-instancing-factory.md
  - docs/tasks/015-render-sync.md
  - docs/tasks/016-input-port-mouse-adapter.md
  - docs/tasks/017-session-game-loop.md
  - docs/tasks/018-ui-state-machine.md
  - docs/tasks/019-main-menu-screen.md
  - docs/tasks/020-hud-overlay.md
  - docs/tasks/021-game-over-screen.md
  - docs/tasks/022-victory-screen.md
  - docs/tasks/023-scss-styling-pass.md
  - docs/tasks/024-map-boundary-enforcement.md
  - docs/tasks/025-composition-root.md
  - docs/tasks/026-main-entrypoint-wiring.md
  - docs/tasks/027-playtest-balance-pass.md
  - docs/tasks/028-readme.md
  - index.html
  - package.json
  - src/main.ts
  - tools/blender/generate_bot_fleer.py
  - tools/blender/generate_bot_hunter.py
  - tools/blender/generate_bot_wanderer.py
  - tools/blender/generate_food.py
  - tools/blender/generate_player_cell.py
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Code Review Report — Initial Scaffolding (SPEC, Tasks, Config, Blender Pipeline)

**Reviewed:** 2026-10-15T00:00:00Z
**Depth:** deep
**Files Reviewed:** 42
**Status:** issues_found

## Summary

This review covers the brand-new scaffolding of a client-only TypeScript + Vite + Three.js browser game, produced in parallel by three agents sharing one design conversation: (1) `docs/SPEC.md` + 28 task files, (2) project config/folder scaffolding, (3) five headless-Blender `bpy` asset-generation scripts. The three artifact sets are largely consistent with each other — task ordering/numbering is a clean, strictly-increasing dependency chain with no forward references and no gaps, `docs/TASKS.md`'s index matches the 28 task files exactly (titles and the done/not-done checkbox state for 001/002), the Makefile's targets correctly map to `package.json` scripts and correctly glob whatever files actually exist in `tools/blender/`, and `tsconfig.json`'s path alias matches `vite.config.ts`'s alias. The placeholder `index.html`/`src/main.ts` pair is a valid, minimal smoke test that intentionally avoids any real game logic, matching task 001's explicit scope.

The one critical issue is a real functional bug: all five Blender generator scripts hardcode the original author's absolute macOS filesystem path for the models output directory, which breaks the "re-run and regenerate assets" story on any other machine. The remaining findings are cross-document consistency drift between `docs/SPEC.md`'s architecture tree and what the 28 task files actually commit to building, a couple of documentation-only mismatches between task 002's claimed filenames and the real filenames on disk, a testing-infrastructure gap relative to several tasks' acceptance criteria, and a Blender-API compatibility risk worth validating against the actual installed Blender version.

## Critical Issues

### CR-01: Hardcoded author-specific absolute path in every Blender generator script

**File:** `tools/blender/generate_player_cell.py:42`, `tools/blender/generate_bot_wanderer.py:33`, `tools/blender/generate_bot_hunter.py:58`, `tools/blender/generate_bot_fleer.py:60`, `tools/blender/generate_food.py:33`

**Issue:** Every one of the five scripts hardcodes the exact same absolute path:

```python
out_dir = "/Users/veaceslavsirotchin/Documents/VSCode_Projects/Project/src/assets/models"
```

This directly contradicts task 002's own acceptance criterion ("Each Blender script re-runs standalone and reproduces its model — regeneration path for later tweaks, wired to `make blender-models`") and SPEC.md's framing of the Blender pipeline as a reusable, repo-portable tool. On any machine other than this exact user account on this exact machine (a different contributor, CI, a Linux box, even the same user with a renamed home folder), `os.makedirs(out_dir, exist_ok=True)` will either fail with a permissions error or silently create files in the wrong place outside the repo entirely — `make blender-models` is effectively non-functional for anyone but the original author.

**Fix:** Derive the output path relative to the script's own location instead of hardcoding it:

```python
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "src", "assets", "models"))
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "player_cell.glb")
```

Apply the same fix to all five scripts (the `out_path` filename at the end of each is already correct and model-specific — only `out_dir` needs to change).

## Warnings

### WR-01: `docs/SPEC.md`'s architecture tree is missing files the task files commit to creating

**File:** `docs/SPEC.md:20-79`

**Issue:** `docs/TASKS.md` tells readers "See `docs/SPEC.md` for the full architecture," positioning the `src/` tree in SPEC.md as canonical. But several files that the 28 task docs explicitly plan to create under "Files touched" are absent from that tree:

- `src/world/domain/geometry.ts` (task 003)
- `src/world/domain/bot-ai/wanderer.ts`, `hunter.ts`, `fleer.ts` (tasks 006-008, referenced again in 009/024/027)
- `src/world/service/bot-population.service.ts` (task 009, referenced in 025/027)
- `src/world/service/food-spawner.service.ts` (task 010, referenced in 025/027)
- `src/render/adapter/three/three-renderer.ts` (the concrete `IRenderer` implementation itself — task 012/015/025)
- `src/ui/session-state.ts` (task 018, referenced repeatedly in 019-022/025/026)

**Fix:** Update SPEC.md's `src/` tree to include these files (at minimum add a `bot-ai/` subfolder under `world/domain/`, the two extra service files, `three-renderer.ts`, and `session-state.ts`) so the architecture diagram stays the single source of truth it's meant to be, rather than drifting out of sync with the task breakdown that implements it.

### WR-02: Task 002's "Files touched" filenames don't match the real filenames on disk

**File:** `docs/tasks/002-blender-3d-models.md:33`

**Issue:** The task doc states the Blender scripts are `tools/blender/player_cell.py`, `bot_wanderer.py`, `bot_hunter.py`, `bot_fleer.py`, `food.py`, but the actual files are prefixed `generate_`: `generate_player_cell.py`, `generate_bot_wanderer.py`, `generate_bot_hunter.py`, `generate_bot_fleer.py`, `generate_food.py`. The Makefile's `blender-models` target is glob-based (`tools/blender/*.py`) so this doesn't break anything functionally, but it's misleading to anyone reading the task doc to find the right script by name.

**Fix:** Update task 002's "Files touched" section to list the actual `generate_*.py` filenames.

### WR-03: No test runner configured despite multiple tasks' acceptance criteria requiring automated unit tests

**File:** `package.json:1-20`, `docs/tasks/003-core-domain-entities.md:30-31`, `docs/tasks/004-world-rules.md:27`, `docs/tasks/005-world-service-tick.md:31`

**Issue:** Tasks 003, 004, and 005 phrase their acceptance criteria in terms of automated-test language — "unit-testable without a browser," "round-trip correctly for a range of test values," "A manually-constructed overlap between two cells results in the correct one being removed from state after `tick()`." But `package.json` has no test framework (no `vitest`, `jest`, `node:test` wiring) and no `"test"` script. As scaffolded, there's no way to mechanically verify these acceptance criteria — someone will have to either add test tooling before task 003 lands, or the acceptance criteria need rewording to "manually verified" to match the current toolchain.

**Fix:** Add a lightweight test runner (e.g. `vitest`, which integrates cleanly with the existing Vite setup) as a devDependency and a `"test"` script in `package.json` before task 003 begins, or explicitly scope testing out in SPEC.md/TASKS.md if automated tests are intentionally deferred.

### WR-04: Blender material-transparency API usage should be verified against the target Blender version (5.2)

**File:** `tools/blender/generate_player_cell.py:19-22`

**Issue:** `make_material()` sets `mat.blend_method = 'BLEND'` and `mat.show_transparent_back = False` to achieve the translucent membrane look that SPEC.md calls out as the player cell's signature visual trait. Blender's EEVEE material/transparency model changed significantly starting in 4.2 ("EEVEE Next"), where several of the legacy EEVEE material-settings properties were reworked. These scripts were not executed against the actual Blender binary as part of this review (only their `bpy` source was read), so it's unverified whether `blend_method` / `show_transparent_back` still behave as expected (or exist at all) on Blender 5.2. If either property has been renamed/removed, `generate_player_cell.py` will throw an `AttributeError` and the player model — the one model whose defining feature is this exact translucency — will fail to regenerate.

**Fix:** Run `blender --background --python tools/blender/generate_player_cell.py` against the actual installed Blender 5.2 binary and confirm it exits cleanly and the exported `.glb`'s material renders as translucent in a GLTFLoader smoke test (this is explicitly task 013's job, but worth flagging now since it's a latent risk in already-"Done" task 002).

## Info

### IN-01: Significant boilerplate duplication across all 5 Blender scripts

**File:** `tools/blender/generate_player_cell.py:5-23`, `tools/blender/generate_bot_wanderer.py:5-22`, `tools/blender/generate_bot_hunter.py:6-23`, `tools/blender/generate_bot_fleer.py:6-23`, `tools/blender/generate_food.py:5-22`

**Issue:** `clear_scene()` and `make_material()` are copy-pasted verbatim (identical, line-for-line) into all five scripts.

**Fix:** Extract both into a `tools/blender/_common.py` module and `import` it via `sys.path.insert(0, os.path.dirname(__file__))` at the top of each script. Each script remains independently runnable via `blender --background --python tools/blender/<script>.py` (the standalone-ness required by SPEC.md), just without the duplicated logic.

### IN-02: `show_transparent_back = False` has no effect on the exported glTF

**File:** `tools/blender/generate_player_cell.py:22`

**Issue:** `mat.show_transparent_back` is a Blender-only (legacy EEVEE) viewport/render setting; Blender's glTF exporter does not translate it into any glTF material property. The exported `player_cell.glb`'s double-sided/backface behavior is controlled by `material.use_backface_culling`, which this script never sets. As written, this line has no effect on the actual asset that ships to the renderer.

**Fix:** Either remove the line, or replace it with the property that the glTF exporter actually reads, e.g. `mat.use_backface_culling = True`, if hiding the membrane's inner backfaces in-game is the intended effect.

### IN-03: Makefile's Blender fallback path is macOS-specific and unlabeled as such

**File:** `Makefile:1-4`

**Issue:** `BLENDER := /Applications/Blender.app/Contents/MacOS/Blender` is a reasonable default for this developer's own Mac but will silently fail (empty/non-existent path) if `make blender-models` is ever run on Linux or Windows where `blender` isn't already on `PATH`.

**Fix:** Low priority given this is a single-developer hobby project on macOS, but a one-line comment (`# macOS fallback; Linux/Windows users should ensure 'blender' is on PATH`) would save a future contributor a confusing failure.

### IN-04: `tsconfig.json` has no `vite/client` ambient types

**File:** `tsconfig.json:1-22`

**Issue:** There's no `"types": ["vite/client"]` entry in `compilerOptions`. This isn't a problem yet (nothing in `src/` currently needs it), but task 013 (loading `.glb` assets) and task 023 (SCSS partials) may need Vite's ambient module declarations (e.g. for `import.meta.env`, or for importing non-`.ts` assets as modules) depending on how those tasks end up resolving asset URLs.

**Fix:** Add `"types": ["vite/client"]` to `compilerOptions` now, or revisit when task 013/023 land if type errors show up for asset imports.

---

_Reviewed: 2026-10-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
