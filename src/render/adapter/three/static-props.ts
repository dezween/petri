import * as THREE from "three";
import type { ModelCache, ModelName } from "./model-loader";
import { buildStaticObject } from "./cell-mesh-factory";

/**
 * Hand-picked angle-around-origin + distance-past-the-rim + rotation-around-Y + scale for one
 * prop instance. Positioned relative to the arena's actual radius (not a fixed absolute world
 * position) — see `buildStaticProps`'s `arenaWidth` parameter — so props stay just outside the
 * dish rim at every one of the 10 selectable arena sizes instead of clipping into the dish at
 * larger ones. Regression fix: this used to be a fixed (x, z) ~1300 units from the origin,
 * hand-picked back when Large (arenaWidth 2000, radius 1000) was the biggest size that existed;
 * once arena sizes grew up to 3250 (radius 1625), that fixed radius put props for the 3 largest
 * sizes INSIDE the dish. `offsetFromRim` reproduces the original design's ~300-unit margin
 * outside the old Large rim, now expressed relative to whatever the real rim radius is.
 */
interface PropPlacement {
  model: ModelName;
  /** Angle around the arena center, radians (atan2(z, x) convention). */
  angle: number;
  /** Distance past the dish rim (arenaWidth/2), in world units — not distance from the origin. */
  offsetFromRim: number;
  rotationY: number;
  scale: number;
}

/**
 * Scale factors here are hand-picked for how they read visually against the arena (hundreds to
 * low-thousands of world units), not derived from any physical convention — unlike
 * `cell-mesh-factory.ts`'s `BASE_MODEL_RADIUS`, which maps a *gameplay* radius (mass-derived)
 * onto a model's native scale. Static props aren't game entities with a radius, so there's
 * nothing to derive this from; these are just "looks about right next to a bot/food instance".
 *
 * `angle` values are `Math.atan2(z, x)` of this layout's original fixed (x, z) positions (at
 * the old Large arena, radius 1000, offsetFromRim 300 => distance ~1300 from the origin) —
 * computed once here so the props keep their original relative arrangement to each other,
 * just scaled by the real arena radius now instead of frozen at the old one.
 */
const PLACEMENTS: PropPlacement[] = [
  { model: "prop_empty_dish", angle: Math.atan2(836, 996), offsetFromRim: 300, rotationY: 0.4, scale: 90 },
  { model: "prop_pipette", angle: Math.atan2(-445, -1222), offsetFromRim: 300, rotationY: 2.1, scale: 70 },
  { model: "prop_droplet", angle: Math.atan2(1065, 746), offsetFromRim: 300, rotationY: 0, scale: 55 },
  { model: "prop_droplet", angle: Math.atan2(550, 1178), offsetFromRim: 300, rotationY: 0, scale: 48 },
  { model: "prop_droplet", angle: Math.atan2(-1222, 445), offsetFromRim: 300, rotationY: 0, scale: 60 },
  // User request: one big, highly detailed piece framing the dish — a microscope, positioned
  // "north" (world +z, the far side from the camera's south-offset tilt — see camera.ts) so it
  // reads as backdrop framing at the top of the frame rather than sitting in front of the
  // gameplay view. offsetFromRim is deliberately smaller than the small props' 300 (and scale
  // much bigger) so its stage visually reaches toward the dish instead of floating far off.
  // rotationY=PI/2 turns the model's local +x (where the stage/turret sit) to face world -z,
  // i.e. back toward the dish at the origin.
  { model: "prop_microscope", angle: Math.PI / 2, offsetFromRim: 300, rotationY: Math.PI / 2, scale: 110 },
];

/**
 * Builds one static `THREE.Mesh` per entry in `PLACEMENTS` whose model actually loaded (a
 * missing/corrupt prop model degrades gracefully — that one placement is just skipped, the
 * same partial-`ModelCache` tolerance `CellMeshFactory` already has for gameplay-critical
 * models, not the old all-or-nothing failure mode task 012's doc explicitly calls out as a bug
 * to not reintroduce). Returns a single `THREE.Group` containing all of them so the caller can
 * add/remove them from the scene as one unit; nothing here is ever mutated per-frame — but the
 * whole group IS rebuilt by `ThreeRenderer.setArenaWidth()` (same as the floor/rim) whenever the
 * arena size changes, since `arenaWidth` determines every prop's real position here.
 */
export function buildStaticProps(models: ModelCache, arenaWidth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "static-props";
  const arenaRadius = arenaWidth / 2;

  for (const placement of PLACEMENTS) {
    const model = models[placement.model];
    if (!model) continue; // this prop's .glb failed to load — skip only this one instance

    const distance = arenaRadius + placement.offsetFromRim;
    const object = buildStaticObject(model);
    object.position.set(Math.cos(placement.angle) * distance, 0, Math.sin(placement.angle) * distance);
    object.rotation.y = placement.rotationY;
    object.scale.setScalar(placement.scale);
    group.add(object);
  }

  return group;
}
