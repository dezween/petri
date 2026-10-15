# 016 — Epic 2 Playtest & Balance Pass

## Goal

A real browser playtest of everything Epic 2 added, same spirit as Epic 1's task 027 — verify
it actually works end-to-end and feels right, not just that it compiles and unit tests pass.
Epic 1's own experience is the cautionary tale here: several real bugs (hidden-screen CSS,
camera not following the player, a collision-cascade bug) were only found by actually running
the game in a browser, not by code review or automated tests alone.

## Depends on / why it's next

Depends on everything else in this epic (001-015) — this is the integration/verification pass
after all the pieces exist.

## Detailed steps

- Use Playwright (install locally with `npm install --no-save playwright && npx playwright
  install chromium` if not already available, uninstall with `--no-save` after, matching the
  exact discipline Epic 1's task 027 established — don't leave stray test scripts in the repo).
- Verify, with real screenshots/observation, not assumptions:
  - All three arena sizes are selectable and actually produce differently-sized arenas with
    correctly scaled victory-cap behavior.
  - Settings persist across a real page reload (not just across a `Restart` within one session).
  - SFX and music play, and muting/volume controls actually take effect audibly (or, if audio
    can't be verified by ear in this environment, verify the underlying API calls/state changes
    fire correctly and log what could/couldn't be confirmed by ear — be honest about the limits
    the way Epic 1's task 026 was about WebGL verification).
  - Particles burst on eating, visibly, without leaking into an ever-growing object count over
    a longer session.
  - The lab-bench background, props, and DOF blur render correctly at all three arena sizes and
    at max zoom-out.
  - Bloom looks intentional, not blown-out.
  - The new bot colors are visually distinguishable (re-verify in an actual screenshot, not
    just the hex values from task 015).
- Specifically playtest Large arena for a while to answer task 001's open question: does fixed
  food/bot density feel too sparse/empty at Large, or does it work as intended? Adjust
  `TARGET_FOOD_COUNT`/bot population targets if it feels wrong — this is exactly the kind of
  constant this task exists to tune, the same way Epic 1's task 027 tuned `RADIUS_PER_MASS_SQRT`
  and others after finding the defaults didn't feel right in practice.
- Run the full verification suite (`npx tsc --noEmit`, `npx vitest run`, `npm run build`) after
  any tuning changes.

## Files touched

- Whatever constants get tuned based on actual play (document each change and why, the way
  Epic 1's task 027 did).

## Acceptance criteria

- Every Epic 2 feature is confirmed working via real browser interaction, with honest reporting
  of anything that couldn't be verified and why (not silently assumed fine).
- Any balance issues found (especially Large-arena density) are fixed and re-verified.
- `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all pass after tuning.
