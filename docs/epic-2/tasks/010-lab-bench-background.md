# 010 — Lab-Bench Background Ground Plane

## Goal

A static ground plane extending beyond the existing petri-dish floor+rim, giving the scene a
sense of "the dish sits on a lab bench" instead of floating over an empty background.

## Depends on / why it's next

Depends on nothing new — extends `src/render/adapter/three/scene.ts` directly, same file
Epic 1 built the dish floor/rim in. Independent of the audio/particle tasks (003-009);
sequenced after them here only to keep the breakdown linear.

## Detailed steps

- Add a large flat plane beneath/around the existing dish geometry, with a material/color that
  reads as a lab bench (dark wood or matte lab-surface tone) without clashing with the dish's
  established palette (`FLOOR_COLOR = 0xf2f6f2`, `RIM_COLOR = 0xaad4cc`, background
  `0xe8f0ee` — the bench should contrast against these, not compete with them).
- Size it generously enough that it doesn't visibly end within the camera's zoomed-out view at
  Large arena size + max player radius (check `camera.ts`'s zoom bounds from Epic 1 to size
  this correctly, don't guess a number).
- Keep it a single static mesh — no per-frame updates, no instancing needed.

## Files touched

- `src/render/adapter/three/scene.ts`

## Acceptance criteria

- The bench plane is visible beyond the dish rim at all three arena sizes (Small/Medium/Large)
  and at the camera's maximum zoom-out (player near the victory cap), with no visible edge/seam
  within the camera's frustum under normal play.
