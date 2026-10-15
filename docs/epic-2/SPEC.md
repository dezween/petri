# SPEC — Epic 2: Polish, Audio, Scenery, Arena Sizes

Builds on the shipped Epic 1 MVP (`docs/epic-1/SPEC.md`). Everything here is **additive** — it
does not touch the single-cell-per-entity domain model, the hexagonal module boundaries, or any
of the core game rules (eating, growth, victory cap) that Epic 1 established and balance-tuned.
If a change here ever seems to require touching `world/domain/rules.ts`'s core eating/growth
logic, stop and flag it — that's a sign it's out of scope for this epic.

## Stack

Same as Epic 1 (TypeScript, Vite, Three.js, vanilla DOM, SCSS), plus:

- **Audio**: Web Audio API (or plain `HTMLAudioElement`s — task 003 decides), no new dependency
  required.
- **Post-processing**: Three.js's own `examples/jsm/postprocessing` (`EffectComposer` +
  passes), already available via the `three` package already installed — no new dependency.
- **Persistence**: `localStorage`, browser-native, no dependency — audio settings only (see
  Out of Scope).

## Architecture additions

The existing hexagonal shape (`domain/port/service/adapter` per module, only `world` carries
real business logic) is preserved. Epic 2 adds one new module and extends two existing ones:

```
src/
  audio/                       # NEW — presentation-only, no domain
    port/
      audio.port.ts             # IAudioPlayer
    adapter/
      web-audio/                 # (or whatever task 003 names it)
        web-audio-player.adapter.ts

  render/                      # EXTENDED — still presentation-only
    adapter/
      three/
        scene.ts                 # gains lab-bench ground plane + static props
        post-processing.ts        # NEW — bloom + DOF via EffectComposer
        particles.ts              # NEW — eat-burst particle system
        (existing files unchanged in shape)

  ui/                          # EXTENDED
    adapter/
      dom/
        settings.adapter.ts       # NEW — volume/mute controls
        (menu.adapter.ts gains the size-picker)
    session-state.ts             # gains a Settings screen state + arenaWidth threading

  world/
    service/
      world.service.ts           # arenaWidth already a constructor param (Epic 1) — just
                                  # gets threaded from a real UI choice instead of always the
                                  # default; no logic changes
```

## Design decisions (final — agreed with the user)

### 1. Arena size selection

Three fixed sizes, chosen on the Main Menu before clicking Play:

| Size | Arena width | Victory-cap mass (≈) | Relative to Small |
|---|---|---|---|
| Small | 1000 (existing `DEFAULT_ARENA_WIDTH`, unchanged) | ~2,200 | 1× (baseline, already balance-tuned in Epic 1) |
| Medium | 1500 | ~4,950 | ~2.25× |
| Large | 2000 | ~8,800 | ~4× |

Victory-cap mass scales with the **square** of arena width, because victory radius is a fixed
fraction of arena width (`VICTORY_CAP_FRACTION = 0.375`, unchanged) and mass scales with
radius². This is why Large isn't just "2× the game," it's closer to 4×.

`WorldService`, `ThreeRenderer`, `BotPopulationService`, and `FoodSpawnerService` already accept
`arenaWidth` as a parameter (confirmed in the Epic 1 codebase) — this is primarily a UI +
wiring task (size-picker on Main Menu → threaded through `SessionState`'s bootstrap/Restart
flow), not a new subsystem.

**Known risk, not pre-solved**: `TARGET_FOOD_COUNT` (food-spawner) and the bot population
targets are fixed absolute counts, not scaled by arena area. A larger arena will feel sparser
per unit area with zero other changes — which is actually *desired* here (reinforces "takes
longer"), but whether it crosses over into "feels empty and boring" at Large must be verified
by actual play in task 016 (the balance pass), not assumed correct from the math alone.

### 2. Audio

- `IAudioPlayer` port: play one-shot SFX, play/loop background music, set volume (SFX and
  music independently), mute/unmute (SFX and music independently).
- SFX: eat food, eat bot, death (Game Over), victory.
- One background ambient/music loop during `Playing`.
- A **Settings screen**, reachable from the Main Menu, with volume controls and/or mute
  toggles for SFX and music separately.
- Settings persist across reloads via `localStorage`. This is the *only* persistence added in
  Epic 2 — see Out of Scope for why score/leaderboard persistence is explicitly not this.

### 3. Particle effects

A small particle burst when the player eats something (food or a bot), implemented entirely in
`render/` (Three.js). Triggered by eating events — requires exposing a finer-grained "entity
eaten" hook than Epic 1's `onPlayerEaten`/`onVictoryReached` (which only cover the player's own
death and the victory condition, not every individual eat). Follow the same callback-injection
pattern `GameLoopService` already uses (`GameLoopCallbacks` with optional handlers) rather than
inventing a new event mechanism.

### 4. Background / environment

- A static lab-bench ground plane extending beyond the existing petri-dish floor+rim
  (`scene.ts`), matching its established palette (`FLOOR_COLOR = 0xf2f6f2`,
  `RIM_COLOR = 0xaad4cc`, background `0xe8f0ee`) rather than clashing with it.
- A handful of static decorative props scattered around the bench: a second empty petri dish,
  a pipette, agar droplets. New Blender `bpy` scripts in `tools/blender/`, following the exact
  pattern of the 5 existing scripts (including reuse of the shared `tools/blender/_common.py`
  helpers: `clear_scene`, `make_material`, `models_output_dir`). Low-poly, but these are placed
  once as static scene dressing — no instancing needed, unlike food/bots.
- A depth-of-field / blur effect on everything beyond the main dish, via `EffectComposer` (a
  bokeh/DOF pass, or a cheaper faked approach if task 013's implementer judges that more
  practical for this scene's geometry — not over-specified here).

### 5. Visual polish

- Bloom post-processing (`EffectComposer` + `UnrealBloomPass` or equivalent) for a glowing
  membrane/agar look.
- Accessible bot color palette. Current colors (from `tools/blender/generate_bot_*.py`):
  hunter `(0.85, 0.25, 0.15)` (red-orange), wanderer `(0.4, 0.75, 0.55)` (green), fleer
  `(0.95, 0.85, 0.35)` (yellow). Hunter-vs-wanderer is a near-textbook red/green confusion pair
  for red-green colorblindness (the most common form). Regenerate with a palette that
  distinguishes by hue *and* luminance (e.g. a blue/orange-based scheme), not hue alone. Shape
  is already a strong secondary cue (wanderer round, hunter elongated rod, fleer spiky) — the
  color change reinforces that, it doesn't have to carry the distinction alone.

## Out of Scope (Epic 2) — considered and rejected, not just deferred

- **Split / eject mass ("skills")** — discussed in depth (what it would require: multi-blob-
  per-owner domain model, recombine timers, camera bounding-box-of-blobs instead of single
  position, HUD mass-sum, victory-condition redefinition, bot AI awareness of multiple player
  blobs). Rejected outright as a disproportionate rework relative to its value here — not
  deferred to a future epic, considered closed.
- **Leaderboard / persistent high scores** — proposed, then explicitly rejected by the user
  after initially being interested. Do not persist scores or rankings anywhere.
- **Multiplayer** — rejected from the start of Epic 1 as a fundamental scope boundary;
  reconfirmed rejected here. Also technically incompatible with the current GitHub Pages
  static hosting (no server process available) without standing up a separate always-on
  backend, which was never in scope for this project.
- **Grazer-bot flocking behavior, achievements/post-game stats, minimap, golden/rare food +
  combo multiplier** — all proposed during Epic 2 scoping, all explicitly declined by the
  user ("ничего не понравилось" — none of it landed). Not planned.
- **Dynamic/shrinking arena (Battle Royale-style)** — considered as an alternative to
  "levels," explicitly deferred in favor of the static 3-size picker to keep Epic 2 scope
  manageable. Could resurface in a future epic, not ruled out the way split/eject is.
- **"Levels" / campaign structure** — clarified during scoping that real agar.io has no such
  concept; it has game *modes* instead (FFA, Teams, Battle Royale, Experimental, Party). The
  user's underlying concern ("games end too fast") is what the arena-size picker addresses.

## Task breakdown

See `docs/epic-2/TASKS.md` for the ordered, numbered task list (3-digit padded, restarting at
001 — a separate numbering namespace from Epic 1's 001-028).
