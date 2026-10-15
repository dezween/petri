# SPEC — 3D Agar.io-style Browser Game

Single-player, bots-only, 3D-rendered clone of the agar.io core loop. No multiplayer, no backend, no player skills (no split, no eject mass).

## Stack

- **Language**: TypeScript
- **Build tool**: Vite
- **Rendering**: Three.js
- **UI overlay**: vanilla DOM (no framework)
- **Styling**: SCSS
- **3D asset pipeline**: Blender Python (`bpy`) scripts, run headless (`blender --background --python <script>.py`), exporting low-poly `.glb` files

No backend. No network layer. No persistence/high-score storage in this MVP scope — explicitly out of scope, not a forgotten task.

## Architecture — Hexagonal (Ports & Adapters)

Mirrors the Go convention already used in this developer's other projects (`minitok.go`, `sysmon`, `sss`, `AsanaExtractor`), which structure each module as `internal/<module>/{domain,port,service,adapter}`. Here `src/` plays the role of `internal/`, split by module instead of by single flat folder. Not every module needs all four sub-folders — only `world` has real business logic (a domain); the others are presentation/technical and only need `port` + `adapter`.

```
src/
  world/                      # the ONLY module with real domain/business logic
    domain/
      cell.entity.ts
      food.entity.ts
      bot.entity.ts
      rules.ts                # growth/eating math, victory-cap formula
      geometry.ts              # shared geometry/overlap math
      bot-ai/
        wanderer.ts             # round, passive bot behavior
        hunter.ts                # chases anything smaller
        fleer.ts                 # flees anything bigger
    service/
      world.service.ts        # tick: movement, collision resolution, state update
      bot-population.service.ts  # scales bot count/aggressiveness with player mass
      food-spawner.service.ts    # continuous food respawning across the arena

  render/                     # presentation — no domain
    port/
      renderer.port.ts         # IRenderer
    adapter/
      three/
        scene.ts               # flat arena, lighting setup
        camera.ts               # top-down camera over the arena
        model-loader.ts         # GLTFLoader wrapper for the 5 .glb assets
        cell-mesh-factory.ts    # instancing: world entities -> rendered meshes
        lighting.ts
        three-renderer.ts       # concrete IRenderer implementation

  input/                      # presentation — no domain
    port/
      input.port.ts             # IInputSource
    adapter/
      dom/
        mouse-input.adapter.ts  # cursor-direction movement only

  ui/                         # presentation — no domain
    session-state.ts            # MainMenu/Playing/GameOver/Victory state machine
    port/
      hud.port.ts
    adapter/
      dom/
        menu.adapter.ts
        hud.adapter.ts
        game-over.adapter.ts
        victory.adapter.ts
    styles/
      _tokens.scss
      base/
      components/
      layout/
      main.scss

  session/                    # composition root — ties every module together
    game-loop.service.ts       # each frame: input -> world.service.tick() -> renderer.render()
    bootstrap.ts                # DI: wires concrete adapters into services via their ports

  assets/
    models/
      player_cell.glb
      bot_wanderer.glb
      bot_hunter.glb
      bot_fleer.glb
      food.glb

tools/
  blender/                    # bpy scripts, one per model, run headless
```

## Game Design Decisions (final — agreed, not open questions)

- **No multiplayer.** Bots only.
- **No player skills.** No split, no eject mass, no abilities of any kind. Exactly one cell per entity (player or bot) at all times — this removes multi-blob-per-owner state and recombine timers entirely from the domain.
- **Camera**: top-down, over a flat, fixed-size arena.
- **Map boundaries**: hard walls. No wrap-around. The arena edge gets a visual treatment fitting the theme (e.g. a petri-dish rim).
- **Theme**: microbiology / petri dish.
  - Player cell: translucent membrane + visible nucleus look.
  - Food: small colored "cocci" particles — the steady, ambient mass source, continuously respawning across the arena.
  - Bots, visually distinct by shape/color:
    - **Wanderer**: round, passive. Eats food. Ignores the player and other bots.
    - **Hunter**: elongated "bacillus" shape. Actively chases anything smaller than itself, including the player.
    - **Fleer**: round with small spike/flagella accents. Flees anything bigger than itself, tends toward arena edges.
- **Eating rule**: on overlap, the bigger entity eats the smaller one. Mass transfers to the eater; the eaten entity is removed (bots respawn elsewhere; player death triggers Game Over).
- **Bot population scaling**: count and/or aggressiveness increases as the player's mass grows. The exact curve is a balancing task (see task 027), not a design decision to fix now.
- **Victory condition**: cell radius is capped at roughly 35-40% of the arena's width. Reaching the cap triggers a Victory screen instead of unbounded growth. (Explicit design call: growth without a cap makes "no room left on the map" undefined behavior, so the cap doubles as the win condition.)
- **Game/menu flow** (explicit state machine):
  ```
  MainMenu --Play--> Playing --(death)--> GameOver --Restart--> Playing
                      Playing --(radius cap)--> Victory --Restart--> Playing
                      GameOver --MainMenu--> MainMenu
                      Victory  --MainMenu--> MainMenu
  ```
  - MainMenu: Play button, optional brief instructions text.
  - Playing: HUD shows live mass/score.
  - GameOver: final score + Restart + MainMenu buttons.
  - Victory: congratulatory message + Restart + MainMenu buttons.

## Blender Pipeline

Python (`bpy`) scripts live in `tools/blender/`, one per model, each runnable standalone:

```
blender --background --python tools/blender/<script>.py
```

Each script procedurally builds and exports a **low-poly** `.glb` straight into `src/assets/models/`. Low-poly is a hard requirement, not a style choice: food and bots are instanced many times on screen simultaneously and must stay performant.

## Out of Scope (MVP)

- Multiplayer / networking
- Player skills (split, eject mass, power-ups)
- Persistence or high-score storage
- Wrap-around map / non-flat arenas
- Bot types beyond wanderer/hunter/fleer
