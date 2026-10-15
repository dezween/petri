# 020 — HUD Overlay

## Goal

Show live mass/score during Playing, implementing the `hud.port.ts` contract defined in task 018.

## Depends on / why it's next

Depends on 018 (needs `hud.port.ts` to implement) and 017 (needs the game loop running to have live data to display). Independent of 019 (different screen) but numbered after it since MainMenu is the entry point.

## Detailed steps

- `hud.adapter.ts`: implements `IHud` (or whatever shape `hud.port.ts` settled on) — a simple `updateMass(value: number)` call, updating a DOM element's text each frame (or throttled slightly if per-frame DOM writes show up as a perf issue — check during 027).
- Wire into `game-loop.service.ts` (task 017): after each `tick()`, push the player's current mass from the snapshot to the HUD.
- Only visible during the Playing state (hidden otherwise, per the state machine from 018).

## Files touched

- `src/ui/port/hud.port.ts` (if not already fully specified in 018)
- `src/ui/adapter/dom/hud.adapter.ts`

## Acceptance criteria

- Mass/score displayed updates live and correctly as the player eats food/bots during Playing.
- HUD is hidden during MainMenu, GameOver, and Victory.
- No noticeable frame-rate impact from HUD updates (confirmed in 027's balance pass if borderline).
