import * as THREE from "three";
import type { ModelCache, ModelName } from "./model-loader";
import { buildStaticObject } from "./cell-mesh-factory";

/**
 * Hand-picked (x, z) position + rotation-around-Y + scale for one prop instance. Fixed radius
 * ~1300 from the world origin clears even the Large arena's rim (radius 1000) with margin, so
 * these never need repositioning when `ThreeRenderer.setArenaWidth` changes arena size — unlike
 * the floor/rim, static props are placed once in `init()` and never touched again.
 */
interface PropPlacement {
  model: ModelName;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

/**
 * Scale factors here are hand-picked for how they read visually against the arena (hundreds to
 * low-thousands of world units), not derived from any physical convention — unlike
 * `cell-mesh-factory.ts`'s `BASE_MODEL_RADIUS`, which maps a *gameplay* radius (mass-derived)
 * onto a model's native scale. Static props aren't game entities with a radius, so there's
 * nothing to derive this from; these are just "looks about right next to a bot/food instance".
 */
const PLACEMENTS: PropPlacement[] = [
  { model: "prop_empty_dish", x: 996, z: 836, rotationY: 0.4, scale: 90 },
  { model: "prop_pipette", x: -1222, z: -445, rotationY: 2.1, scale: 70 },
  { model: "prop_droplet", x: 746, z: 1065, rotationY: 0, scale: 55 },
  { model: "prop_droplet", x: 1178, z: 550, rotationY: 0, scale: 48 },
  { model: "prop_droplet", x: 445, z: -1222, rotationY: 0, scale: 60 },
];

/**
 * Builds one static `THREE.Mesh` per entry in `PLACEMENTS` whose model actually loaded (a
 * missing/corrupt prop model degrades gracefully — that one placement is just skipped, the
 * same partial-`ModelCache` tolerance `CellMeshFactory` already has for gameplay-critical
 * models, not the old all-or-nothing failure mode task 012's doc explicitly calls out as a bug
 * to not reintroduce). Returns a single `THREE.Group` containing all of them so the caller can
 * add/remove them from the scene as one unit; nothing here is ever mutated per-frame.
 */
export function buildStaticProps(models: ModelCache): THREE.Group {
  const group = new THREE.Group();
  group.name = "static-props";

  for (const placement of PLACEMENTS) {
    const model = models[placement.model];
    if (!model) continue; // this prop's .glb failed to load — skip only this one instance

    const object = buildStaticObject(model);
    object.position.set(placement.x, 0, placement.z);
    object.rotation.y = placement.rotationY;
    object.scale.setScalar(placement.scale);
    group.add(object);
  }

  return group;
}
