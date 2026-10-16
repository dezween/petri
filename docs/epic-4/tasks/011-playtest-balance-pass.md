# 011 — Epic 4 Playtest & Balance Pass

## Goal

Confirm, with real evidence, that bots actually read as smarter — not just that the logic
compiles and unit tests pass. Tune every starting constant from tasks 001-010 against how the
game actually plays, same standard as every prior epic's final task (Epic 1's 027, Epic 2's
016, Epic 3's 006).

## Depends on / why it's last substantive task

Needs every behavioral task (001-010) landed first — this is the integration/tuning pass over
all of them together, not any one in isolation.

## Detailed steps — real evidence required, not a vibe check

Install Playwright locally, start the dev server, and actually observe bot behavior across
multiple real sessions (record specific before/after observations, not just "looks right"):

- **Hunter patrol feel** (the original complaint this epic exists to fix): confirm hunters no
  longer spend most of their time idly ambling on medium/large arenas. Concretely: start a
  session on a large (e.g. 2750-3250) arena, observe several hunters for at least 30 real
  seconds, and record roughly what fraction of that time each spends actively chasing
  something vs. patrolling-toward-center vs. truly idle-random. If hunters still read as
  mostly idle, the detection-radius fractions (1a) or patrol bias (1b) from task 001 need
  retuning here — don't just trust the starting values from SPEC.md.
- **Fleer urgency/panic feel**: deliberately get a fleer into imminent danger (approach it
  closely with a bigger bot or the player) and confirm a visible, obvious speed/behavior change
  compared to a fleer only mildly threatened at the edge of its detection range. If the panic
  response doesn't read as a clear escalation, retune `PANIC_SPEED_MULTIPLIER` and/or
  `IMMINENT_DANGER_RADIUS_FRACTION`.
- **Prediction/interception**: observe whether hunters visibly cut off a moving target's path
  rather than always trailing directly behind it; observe whether fleers being chased by a
  moving threat seem to escape more effectively than before task 003.
- **Edge/dead-end behavior**: deliberately corner a fleeing bot against the rim with a threat
  behind it; confirm it runs along the rim rather than visibly stalling/jittering against the
  wall.
- **Give-up behavior**: watch a hunter chase an equally-fast or faster target it can't actually
  catch for several seconds; confirm it eventually breaks off rather than chasing forever.
- **Pack-approach behavior**: if two hunters end up converging on the same prey, observe
  whether they visibly approach from different angles rather than literally stacking on the
  same line.
- Check across at least two different arena sizes (e.g. the smallest and one of the largest)
  since several constants are arena-relative — confirm the feel holds up at both ends, not just
  whichever size happened to be used while writing the earlier tasks.
- Check `console --errors`-equivalent (page console) is clean throughout.

Tune any constant from tasks 001-010 that a real observation shows is off — document what you
changed and why directly in source comments (replacing "starting value, tune in 011" language
with the actual confirmation/adjustment + evidence), the same pattern Epic 3's task 006 used.

## Files touched

- Whichever constants in `src/world/domain/bot-ai/*.ts` need adjustment based on real
  observation
- `README.md` is NOT this task's job (see task 012)

## Acceptance criteria

- Every constant introduced in tasks 001-010 has either been confirmed-as-is or retuned, with
  the real observation that justified the decision recorded in a source comment (not left as
  a bare "starting value" placeholder).
- Each of the six behavioral checks above (patrol feel, panic feel, prediction, edge/dead-end,
  give-up, pack-approach) has a specific recorded observation (a screenshot description, a
  measured duration, a before/after comparison) in the task's completion report — "looks
  right" alone is not sufficient, matching every prior epic's playtest-task standard.
- Zero console errors observed across the full playtest session.
- Full `npx vitest run` suite still passes after any constant tuning.
