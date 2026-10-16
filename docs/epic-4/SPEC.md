# SPEC — Epic 4: Smarter Bots

Builds on the shipped Epic 1 (`docs/epic-1/SPEC.md`), Epic 2 (`docs/epic-2/SPEC.md`), and
Epic 3 (`docs/epic-3/SPEC.md`) MVPs. Unlike Epic 3 (render-only), this epic changes real
domain/business logic in the `world` module — bot decision-making specifically. It does not
touch rendering, audio, UI, arena-size/settings systems, or the eating/growth/victory rules
Epic 1 built and balance-tuned. If a change here ever seems to require touching anything
outside `src/world/domain/bot-ai/`, `src/world/domain/bot.entity.ts`, and the bot-AI-calling
parts of `src/world/service/world.service.ts`, stop and flag it — that's a sign it's out of
scope for this epic.

## Why this epic exists

The user said the bots feel "dumb" and asked for them to be made maximally smart. Reading the
current implementation confirms why: `wandererMove`/`hunterMove`/`fleerMove`
(`src/world/domain/bot-ai/*.ts`) are three disjoint, rigid, single-purpose pure functions. A
hunter mid-chase has no way to notice a much bigger threat closing in on itself — it isn't
even looking. A fleer reacts only to the single nearest threat and can run itself into a dead
end against the arena rim. Every bot re-evaluates its nearest target from scratch every tick,
with zero persistent state (`Bot` carries nothing beyond `Cell` + a `behavior` tag — see
`bot.entity.ts`'s own doc comment), so near-tied candidates can flip-flop frame to frame. None
of this reads as "intelligent" — it reads as a fixed script.

## Stack

Unchanged — no new dependencies. This epic is pure TypeScript logic in the `world` module,
same as Epic 1's domain work. No `three`, no DOM, no browser APIs — bot AI must stay testable
as pure functions the way it already is (see every existing `bot-ai/*.test.ts` file's
inject-an-`rng`, assert-on-the-returned-`Vector2` pattern).

## Architecture

Touches:

```
src/world/domain/bot-ai/
  evaluate.ts          # NEW — the unified per-tick threat/opportunity evaluation core
                        # (task 001); wanderer.ts/hunter.ts/fleer.ts become thin
                        # personality-weight presets over this shared core instead of
                        # three independent implementations
  wanderer.ts            # becomes a thin preset; findNearestWithinRadius/directionTo stay
                          # here as shared helpers (unchanged call sites elsewhere)
  hunter.ts                # becomes a thin preset + prediction (task 003)
  fleer.ts                  # becomes a thin preset + multi-threat (004) + edge awareness (005)
  types.ts                   # PositionedMass gains optional velocity (task 002)

src/world/domain/
  bot.entity.ts         # Bot gains persistent per-bot AI state (task 007: locked target id +
                         # lock-expiry timestamp) — the first behavior-specific state this
                         # type has ever carried; previously-removed dead `targetId`/
                         # `fleeDirection` fields (deleted in an Epic 2 review-fix pass) are
                         # NOT being resurrected as-is, task 007 designs this fresh against
                         # the actual hysteresis mechanism it implements, not a guess at what
                         # the old fields might have meant

src/world/service/
  world.service.ts      # moveBots/computeBotDirection/othersFor: task 001 threads arenaRadius
                         # into every bot-ai call (see Design Decision 1a); task 002 adds
                         # velocity tracking (needs last-tick position per entity to derive it
                         # — bots, player, AND food, since anything can be a target); task 006
                         # changes moveBots/applyMovement to consume a per-tick speed
                         # multiplier from panicking fleers, not just a direction
```

## Design Decisions

1. **Unified per-tick threat/opportunity evaluation** (replaces the three-function split).
   Every bot, every tick, computes a single steering vector as a weighted sum of: (a) an
   away-from-threats term (entities bigger than it, within detection range) and (b) a
   toward-opportunity term (entities smaller than it or food, within detection range).
   `behavior` becomes a set of weights on these two terms plus a detection radius, not a
   hard branch:
   - `hunter`: opportunity weight 1.0, threat weight 0.6 (still chases hard, but a close
     large threat can override the chase — this is the actual fix for "hunter obliviously
     chases while something huge closes in")
   - `fleer`: threat weight 1.0, opportunity weight 0.3 (still eats food when safe, per the
     existing "falls back to wanderer-ish ambling" behavior, but fleeing always dominates)
   - `wanderer`: opportunity weight 1.0 (food only, per its existing "never looks at
     player/bots" guarantee — threat weight stays 0 for wanderer specifically, preserving
     that documented invariant), threat weight 0.0
   When neither term has anything in range, fall back to the existing random-amble behavior
   (`randomDirection`) — unchanged, except for hunter's fallback specifically (see Design
   Decision 1b below).

   **1a. Detection radii scale with the actual arena size, not a fixed absolute number.**
   Playtest feedback on the first draft of this epic: `HUNTER_DETECTION_RADIUS=200` (and
   `FLEER_DETECTION_RADIUS=180`) were sized against the original 1000-2000-wide arenas: Epic 2
   later grew arena sizes up to 3250, at which point 200 units is under 6% of the arena's
   diameter — a hunter spends nearly all its time in the no-prey fallback on a large arena,
   reading as idle rather than predatory. Fix: detection radii become a *fraction of the
   current arena's radius* (`arenaWidth / 2`), not a fixed constant — this requires threading
   `arenaRadius` into all three `bot-ai` functions for the first time (previously only
   needed by nothing; task 001 does this plumbing once for hunter/fleer/wanderer together,
   rather than each later task inventing its own ad-hoc parameter). Starting fractions:
   - `HUNTER_DETECTION_RADIUS_FRACTION = 0.35` of arena radius (e.g. 568 units at the new max
     3250-wide arena's 1625 radius, 175 at the smallest 1000-wide arena's 500 radius — both
     meaningfully larger, proportionally, than the old fixed 200)
   - `FLEER_DETECTION_RADIUS_FRACTION = 0.3` of arena radius (so fleers notice danger earlier,
     before a threat is nearly on top of them, per the same feedback)
   - `WANDERER_FOOD_DETECTION_RADIUS` stays the fixed `150` it already is — food density
     doesn't scale with arena size the way prey/threat encounters do, and a wanderer's job is
     local grazing, not arena-spanning search, so no change needed here.

   **1b. Hunter's "no prey in range" fallback patrols toward the arena center, not pure random.**
   A hunter idling in a far corner of a large arena with nothing nearby is still "idle" even
   with a bigger detection radius. Fix: blend the existing `randomDirection` wander with a
   bias toward the arena center (`CENTER_PATROL_BIAS = 0.4`) — not toward the player
   specifically, deliberately: biasing toward the one entity that's always worth seeking would
   make hunters omniscient/unfair (tracking the player through walls of distance with no
   detection-range limit at all), whereas biasing toward the arena's center is a believable
   "patrol toward where the action generally is" instinct without cheating. This only applies
   to the hunter's fallback — wanderer's and fleer's fallbacks are unaffected (wanderer stays
   pure food-seek-or-random per its existing invariant; fleer's fallback already defaults to
   wanderer-ish behavior and doesn't need a hunter-specific patrol instinct).

2. **Movement prediction / interception.** Steering targets a point extrapolated
   `PREDICTION_LOOKAHEAD_SECONDS = 0.5` ahead along the target's current velocity
   (`target.position + target.velocity * 0.5`), not its current position — for both chasing
   (intercept) and fleeing (lead the escape away from where the threat is headed). Needs
   velocity data that doesn't exist yet (see Architecture above) — `PositionedMass` gains an
   optional `velocity?: Vector2` field; `WorldService` derives it each tick from the
   previous-tick position of every entity (player, bot, food — food velocity is always zero
   since it doesn't move, but it's the same field for interface uniformity) and passes it
   through. Entities with no velocity data default to the old current-position behavior
   (graceful degradation, not a hard requirement).

3. **Multi-threat-aware fleeing.** Instead of reacting to only the single nearest threat, sum
   an inverse-distance-squared-weighted "away" vector across every threat within
   `FLEER_DETECTION_RADIUS`, then normalize. A threat twice as close contributes ~4x the
   weight. This naturally degrades to the old single-nearest-threat behavior when only one
   threat is present (existing tests asserting that case should still pass unmodified).

4. **Dead-end/edge awareness while fleeing.** The existing `EDGE_BIAS` (0.35, blending a flee
   vector toward the nearest arena edge) stops being a good idea once a bot is already near
   the rim — it can run a fleeing bot straight into the wall with a threat behind it and
   nowhere left to go. Fade `EDGE_BIAS` toward 0 as `distance(bot.position, origin) /
   arenaRadius` approaches 1 (linear fade starting at 70% of arena radius, reaching 0 at the
   rim itself), and blend in a tangential (perpendicular-to-radius) component instead so a
   trapped bot runs *along* the rim rather than straight at it. `arenaRadius` is already
   threaded into every `bot-ai` function by task 001 (see Design Decision 1a) — this task
   reuses that plumbing rather than adding its own.

4a. **Panic/urgency escalation when a threat is imminent.** Playtest feedback: a constant,
   flat flee response regardless of how close/numerous the danger reads as calm rather than
   afraid. Fix: a tighter "imminent danger" sub-radius inside the full flee-detection radius —
   `IMMINENT_DANGER_RADIUS_FRACTION = 0.4 × FLEER_DETECTION_RADIUS_FRACTION` (≈0.12 of arena
   radius — a threat has to be meaningfully close, not just "somewhere in detection range", to
   trigger panic). Inside that sub-radius:
   - **Speed boost.** `PANIC_SPEED_MULTIPLIER = 1.5` applied to the fleeing bot's actual
     movement speed (not just steering direction) while any threat is within the
     imminent-danger sub-radius. Bot-ai functions currently return a bare `Vector2` direction
     — this needs a richer return shape (e.g. `{ direction: Vector2, speedMultiplier: number
     }`, defaulting to 1 for hunter/wanderer and any non-panicking fleer), and
     `world.service.ts`'s `moveBots`/`applyMovement` needs to actually apply the multiplier to
     that bot's speed for the tick.
   - **Edge-awareness yields to raw urgency.** Task 4's edge-bias-fade-to-tangential logic
     still applies normally outside the imminent-danger sub-radius, but inside it, raw
     away-from-threat urgency should dominate over both the edge-bias and the tangential
     blend — a bot with a threat genuinely on top of it prioritizes pure escape over "running
     nicely along the rim." Scale down whatever edge/tangential contribution task 4 would
     otherwise apply by the same proximity factor driving the speed boost (closer threat =>
     bigger speed boost AND smaller edge/tangential contribution), rather than a hard on/off
     switch.

5. **Target persistence / hysteresis.** Once a bot locks onto a target (chase or flee), it
   keeps that target for at least `TARGET_COMMITMENT_SECONDS = 1.5`, or until a candidate
   beats the locked target's score by more than `COMMITMENT_OVERRIDE_MARGIN = 1.3` (30%
   better by whatever scoring already drives selection — closer and/or more valuable), not
   just marginally closer. This needs the new persistent `Bot` state from the Architecture
   section above (a locked target id + a lock-expiry tick/timestamp). A locked target that
   dies, gets eaten, or leaves detection range entirely clears the lock immediately
   regardless of the commitment timer — commitment is about not *flip-flopping between live
   candidates*, not about chasing a target that no longer exists.

5a. **Give up on a bad chase.** Counterpart to item 5's commitment floor — a hunter shouldn't
   commit *forever* to a target it's failing to catch. Track, in the same locked-target state
   item 5 added: the distance to the locked target at the moment the lock was acquired, and
   how long the lock has been held. If the lock has been held longer than
   `CHASE_GIVEUP_SECONDS = 4.0` (noticeably longer than item 5's `TARGET_COMMITMENT_SECONDS
   = 1.5`, so this only fires for a genuinely prolonged, failing chase, not a normal commitment
   window) AND the distance to the target hasn't decreased by at least
   `CHASE_GIVEUP_MIN_PROGRESS = 0.2` (20%) of its lock-start value, clear the lock immediately
   — bypassing item 5's commitment floor entirely, since this check exists specifically to
   escape a commitment that isn't working — and let target selection re-run fresh next tick.
   A target that's getting *closer* even slowly (≥20% progress) keeps the chase; one that
   isn't gets abandoned in favor of an easier opportunity.

5b. **Soft pack awareness, without true inter-bot coordination.** Distinct from (and much
   lighter than) full cooperative pack-hunting (Out of Scope, below) — this needs **no** new
   shared state, messaging, or coordination channel between bots; it stays entirely within the
   existing "each bot decides purely from its own locally-visible nearby-entities data"
   architecture, which already includes other bots' positions (and, after task 002, their
   velocities) as perfectly ordinary `PositionedMass` entries — nothing new is exposed. When a
   hunter is selecting/pursuing a target, check whether another nearby hunter (same
   `behavior === "hunter"`, within the acting hunter's own `HUNTER_DETECTION_RADIUS`) is also
   closer to, or already heading toward, that same candidate target. If so, bias this hunter's
   own interception vector away from that other hunter's approach vector by
   `PACK_ANGLE_BIAS_STRENGTH = 0.3` (e.g. rotate the steering vector partway toward whichever
   perpendicular-to-the-other-hunter's-heading direction keeps distance from it), so two
   hunters converging on the same prey tend to approach from different angles — an emergent
   "flanking" look with zero shared state. This is in-scope specifically *because* it's a pure
   function of data every bot already legitimately receives; true pack-hunting (Out of Scope)
   needs bots to know about each other's *intentions*, which does not exist and is a
   materially bigger lift.

6. **Food-vs-prey utility weighing** (lower priority than 1-5a/5b, bonus if time allows).
   Replace the hunter's hard "prey first, food only as fallback when nothing qualifies"
   priority with a simple utility comparison: `value = targetMass / (1 + distance /
   UTILITY_DISTANCE_SCALE)` for both the best available prey and the best available food,
   picking whichever scores higher. `UTILITY_DISTANCE_SCALE` starting value: 50 (roughly: a
   target twice as far needs to be meaningfully more massive to still win).

Every numeric constant above is an explicit starting value, not a final one — task 011's
playtest/balance pass is where they get tuned against how the game actually plays, the same
as every prior epic's final task.

## Out of Scope

- **Cooperative/pack hunting** — multiple hunters coordinating to surround/pincer the same
  prey. A genuinely good future idea, deliberately deferred: every item above stays within
  "one bot's own decision given what it alone can currently see" (each `bot-ai` function
  remains a pure function of its own bot + nearby entities + deltaTime, no shared/cross-bot
  state). Pack coordination needs bots to know about *each other's* intentions, not just
  position/mass — a materially bigger architectural lift (shared blackboard state, or
  message-passing between bot AI calls within a single tick) than anything in this epic. Not
  started here; a future epic if it turns out to still be wanted.
- **New bot types or archetypes.** Still exactly wanderer/hunter/fleer — this epic makes the
  existing three *smarter*, it doesn't add a fourth.
- **Any change to eating/growth/victory rules, UI, audio, or rendering.** Epic 1's domain
  rules (`rules.ts`), Epic 2's audio/UI, and Epic 3's visual work are all unaffected — a bot
  that steers smarter still eats and grows by exactly the same rules as before.
- **Difficulty/aggressiveness scaling by player progress.** `BotPopulationService`'s existing
  mass-based population/aggressiveness scaling (Epic 1 task 009) is untouched; this epic is
  about how smart each individual bot's steering is, not how many/how aggressive bots spawn.
