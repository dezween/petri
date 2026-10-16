# 001 — Unified Per-Tick Threat/Opportunity Evaluation Core

## Goal

Replace the three disjoint `wandererMove`/`hunterMove`/`fleerMove` implementations' hard
behavioral branching with a single shared evaluation core that every bot runs every tick,
weighing both nearby threats and nearby opportunities simultaneously. `behavior` becomes a
weight preset over this shared core, not a dispatch to three independent code paths. This is
the foundational task every other task in this epic builds on.

## Depends on / why it's first

Nothing in this epic — it's the first task. Everything else (prediction, multi-threat
fleeing, edge awareness, hysteresis, utility weighing) plugs into "what does a bot weigh each
tick" rather than the old three-separate-functions model, so this needs to land before any of
them make sense to build on top of.

## Detailed steps

- New `src/world/domain/bot-ai/evaluate.ts`: a function (e.g. `evaluateSteering(bot,
  nearbyEntities, weights, arenaRadius, deltaTime, rng)`) that:
  - Filters `nearbyEntities` into threats (mass > bot.mass) and opportunities (mass <
    bot.mass), each within a detection radius computed from the new **arena-relative**
    fractions below (not the old fixed absolute constants).
  - Computes an away-from-nearest-threat vector and a toward-nearest-opportunity vector
    (single-nearest for now — multi-threat weighting is task 004's job, don't do it here).
  - Blends the two by the weights given (`{ threatWeight: number, opportunityWeight: number
    }`), normalizes.
  - Falls back to a per-behavior idle fallback when both terms are empty — plain
    `randomDirection` for wanderer/fleer (unchanged), but see the hunter-specific patrol
    fallback below.
- **Detection radii become arena-relative (SPEC.md Design Decision 1a).** Replace the fixed
  `HUNTER_DETECTION_RADIUS=200`/`FLEER_DETECTION_RADIUS=180` constants with
  `HUNTER_DETECTION_RADIUS_FRACTION=0.35`/`FLEER_DETECTION_RADIUS_FRACTION=0.3` of
  `arenaRadius`. This means `arenaRadius` (`arenaWidth / 2`) needs to reach every `bot-ai`
  function for the first time — thread it through `evaluateSteering`'s signature and from
  there into `hunterMove`/`fleerMove`'s own signatures; `world.service.ts`'s
  `computeBotDirection` already has `this.arenaWidth` available, so pass `this.arenaWidth / 2`
  at each call site. `WANDERER_FOOD_DETECTION_RADIUS` stays the fixed `150` (food search isn't
  arena-relative — see SPEC.md 1a's rationale), so `wandererMove`'s own detection math is
  unaffected, but its signature should still accept `arenaRadius` for interface consistency
  with the other two (even if it doesn't use it) since task 005 and others may want every
  `bot-ai` function to share one consistent call shape — your call whether an unused parameter
  is worth the consistency or whether wanderer's signature should just differ; document
  whichever you pick.
- **Hunter's idle fallback patrols toward the arena center (SPEC.md Design Decision 1b).**
  When a hunter has no threat/opportunity in range, instead of pure `wandererMove`-style
  random wander, blend `randomDirection(rng)` with a direction toward the arena center
  (`normalize({x: -bot.position.x, z: -bot.position.z})`, i.e. toward the origin) at
  `CENTER_PATROL_BIAS=0.4`. This is hunter-specific — wanderer's own fallback (still called
  directly by `world.service.ts` for actual wanderer bots) and fleer's fallback (still
  defaulting to plain wander when no threat is near) are both unaffected; don't let the patrol
  bias leak into `wandererMove`'s own exported behavior.
- `findNearestWithinRadius`/`directionTo` stay exactly where they are (`wanderer.ts`) — no
  call-site churn for anything outside `bot-ai/` beyond the new `arenaRadius` parameter
  threading described above.
- The three exported function signatures gain one new parameter each (`arenaRadius`) but are
  otherwise unchanged in spirit — `world.service.ts`'s `computeBotDirection` switch keeps
  calling them the same way, just with one more argument at each call site.

## Files touched

- `src/world/domain/bot-ai/evaluate.ts` (new)
- `src/world/domain/bot-ai/evaluate.test.ts` (new)
- `src/world/domain/bot-ai/wanderer.ts`, `hunter.ts`, `fleer.ts` (refactored to call the core;
  signatures gain `arenaRadius`)
- `src/world/service/world.service.ts` (pass `this.arenaWidth / 2` at each bot-ai call site)
- Existing `*.test.ts` for all of the above — every existing test's *behavior* must still pass
  (same inputs modulo the new required `arenaRadius` argument, same expected outputs) since
  this task is a refactor, not an intentional behavior change beyond the two SPEC.md-documented
  additions (arena-relative radii, hunter patrol fallback)

## Acceptance criteria

- All existing `bot-ai/*.test.ts` and `world.service.test.ts` tests pass (updated only to pass
  the new `arenaRadius` argument where required, not to change their expected outcomes) — this
  task's only *intended* behavior changes are the two explicitly documented in SPEC.md 1a/1b.
- New test proves a hunter with a much bigger threat very close by does NOT return a pure
  chase-toward-prey vector when that prey is also present but farther — i.e. the threat term
  actually has some influence now, not just a no-op weight multiplied by zero everywhere.
  (The exact magnitude of this effect at threatWeight=0.6 is still tunable in task 011 — this
  test just needs to prove the threat term is live, not pin an exact final value.)
- A wanderer still never reacts to bots/player at any detection radius (existing invariant,
  re-asserted with a test that passes a huge bot or the player right next to a wandering bot
  and confirms the wanderer's direction is unaffected).
- A test proves hunter detection radius actually scales with `arenaRadius` — the same prey at
  the same absolute distance from the hunter is in-range at a large arena's radius and
  out-of-range at a small arena's radius, or similar, demonstrating the fraction-of-radius
  math is live, not accidentally still a fixed number under the hood.
- A test proves a hunter with nothing in range and currently positioned off-center produces a
  direction with a nonzero bias toward the origin (not pure random — confirms `CENTER_PATROL_BIAS`
  is actually applied, not a dead parameter).
