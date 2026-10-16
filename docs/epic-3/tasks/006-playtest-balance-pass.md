# 006 — Epic 3 Playtest & Balance Pass

## Goal

Tune the four visual parameters introduced in tasks 001-005 (camera elevation angle, shadow
softness/resolution, bobbing amplitude/frequency, fresnel intensity) by actually looking at the
result in a real browser — not by trusting the starting values in SPEC.md, which are explicitly
documented as starting points, not final numbers.

## Depends on / why it's next

Depends on 001-005 (everything there is to tune must exist first).

## Detailed steps

- Use a real browser session (Playwright, following this project's established pattern from
  Epic 1 task 027 and Epic 2 task 016 — both caught real bugs this way that pure code review
  missed: Epic 2 task 016 specifically caught a startup crash from a multi-primitive model that
  static glTF JSON inspection couldn't have found). Take **before/after screenshot comparisons**
  — this task's acceptance criteria require actual screenshots, not a verbal "looks right"
  judgment, mirroring how task 016's execution report included concrete visual evidence.
- Evaluate and, if needed, retune:
  - Camera elevation angle (`CAMERA_ELEVATION_DEGREES` from task 001) — too shallow (close to
    90°) and the tilt barely reads; too steep (close to horizontal) and gameplay legibility
    (seeing entities clearly, judging relative sizes) degrades. Find a value that visibly
    improves the "flat 2D" complaint without hurting legibility — if there's tension between the
    two, note it explicitly rather than silently picking one side.
  - Shadow quality — 2048 resolution and `PCFSoftShadowMap` are starting values; check for
    visible shadow acne, peter-panning (shadow detached from its caster), or obvious blockiness,
    and check frame-rate impact isn't severe (no formal budget is set elsewhere in this project,
    but a shadow setup that makes the game visibly stutter is a regression worth flagging even
    without a hard number to compare against).
  - Bobbing amplitude/frequency — too subtle and it's imperceptible (wasted work); too strong
    and it reads as jittery or seasick rather than a gentle float.
  - Fresnel/membrane look — does it actually read as "glass/liquid," or does it look like a
    rendering artifact? If `MeshPhysicalMaterial` transmission turned out to need the
    custom-shader fallback (task 005), re-verify that fallback's intensity here too.
- Also re-verify nothing from Epic 1/2 regressed: menu → Play → HUD → eating → Game Over/Victory
  flow, particle bursts, audio, settings screen, all three arena sizes — a visual-only epic
  touching the one class every other render path flows through (`ThreeRenderer`) is exactly the
  kind of change that can silently break something unrelated.
- Clean up any temporary test scripts/installed-but-not-saved packages (e.g. `playwright` via
  `npm install --no-save`) afterward, per this project's established practice.

## Files touched

Whatever constants from tasks 001-005 need retuning, plus any test assertions that hardcoded an
old constant value. No new files expected.

## Acceptance criteria

- Before/after screenshots (or equivalent concrete visual evidence) included in the task's
  execution report, not just a verbal "looks good."
- Every constant from tasks 001-005 either confirmed as the right starting value or retuned,
  with the reasoning for the final choice stated.
- Full Epic 1/2 regression pass confirmed working (menu through Game Over/Victory, particles,
  audio, settings, all three arena sizes) — specifically called out as checked, not assumed.
- `npx vitest run`, `npx tsc --noEmit`, and `npm run build` all clean.
