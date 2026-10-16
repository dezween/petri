import * as THREE from "three";
import type { ModelCache, ModelName } from "./model-loader";
import type { WorldSnapshot } from "@/world/service/world.service";
import type { Bot, BotBehavior } from "@/world/domain/bot.entity";
import { applyMembraneMaterial } from "./membrane-material";

/** Upper bound on simultaneous food instances. Food count is tuned for real in task 027. */
const MAX_FOOD_INSTANCES = 400;
/** Upper bound on simultaneous bots per behavior type. Tuned for real in task 027. */
const MAX_BOTS_PER_BEHAVIOR = 60;

/**
 * The 5 models that represent gameplay entities with a mass-derived radius — as opposed to
 * `model-loader.ts`'s 3 `prop_*` names (Epic 2, task 011), which are static background
 * decoration with no gameplay radius at all (see `static-props.ts`, which places them with a
 * hand-picked fixed scale instead). Narrowing `BASE_MODEL_RADIUS`/`radiusToScale` to this
 * subset keeps that distinction a type error, not just a convention: a prop name passed to
 * `radiusToScale` wouldn't have a meaningful "mass radius" to divide by.
 */
type EntityModelName = Exclude<ModelName, "prop_empty_dish" | "prop_pipette" | "prop_droplet">;

/**
 * Each model's "radius" in its own local units, as built by its `tools/blender/generate_*.py`
 * script (grepped from the actual `bpy.ops.mesh.primitive_*_add(radius=...)` calls, not
 * guessed) — the factor a world-space game radius is divided by to get this model's scale.
 * `bot_hunter` is an elongated rod, not a sphere, so its "radius" here is its cylinder's
 * cross-section radius (0.5) rather than a true bounding radius — a deliberate judgment call
 * so scaling it up grows both its width and length proportionally, which reads correctly for
 * an elongated shape; there's no single "correct" radius for a non-spherical mesh.
 */
const BASE_MODEL_RADIUS: Record<EntityModelName, number> = {
  player_cell: 1.0,
  bot_wanderer: 1.0,
  bot_hunter: 0.5,
  // 0.8 is the central body sphere's radius only (tools/blender/generate_bot_fleer.py) — the
  // joined mesh's 6 spike/flagella protrusions extend visually beyond it (positioned at
  // radius 0.9 from center, depth 0.5 each). Not a correctness bug since the spikes scale
  // proportionally with the body at every zoom level, but this is not a tight bounding
  // radius — don't assume it is when retuning scale-related constants.
  bot_fleer: 0.8,
  food: 0.25,
};

const BOT_MODEL_FOR_BEHAVIOR: Record<BotBehavior, EntityModelName> = {
  wanderer: "bot_wanderer",
  hunter: "bot_hunter",
  fleer: "bot_fleer",
};

/** World-space radius -> this model's local scale factor. */
export function radiusToScale(radius: number, model: EntityModelName): number {
  return radius / BASE_MODEL_RADIUS[model];
}

export interface ExtractedModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/**
 * Pulls the single mesh's geometry/material out of a loaded (possibly nested) model scene.
 * Used only for the `InstancedMesh` paths (bots/food, see `createBotInstancedMesh`/the food
 * branch in `CellMeshFactory`'s constructor) — `InstancedMesh` needs exactly one geometry +
 * material, it can't represent a model split across multiple glTF primitives the way
 * `buildStaticObject` (below) can for the non-instanced player/prop paths. Throws rather than
 * silently picking "the first mesh found" if a bot/food model ever regresses to multiple
 * primitives — a model with N>1 meshes would otherwise have N-1 of them silently dropped with
 * no warning. None of the 5 bot/food models currently have more than one primitive (verified
 * by inspecting their exported glTF JSON directly), so this strict behavior is intentional
 * here, not a gap: if that ever changes, `InstancedMesh` support for it needs building, this
 * throw is the signal that it's needed, not a bug to route around.
 */
export function extractMesh(model: THREE.Object3D): ExtractedModel {
  const meshes = extractMeshes(model);
  if (meshes.length > 1) {
    throw new Error(
      `Model contains ${meshes.length} meshes; extractMesh only instances the first one — ` +
        "join into a single mesh in Blender, or extend CellMeshFactory to support multi-mesh models.",
    );
  }
  return meshes[0];
}

/**
 * Pulls every mesh's geometry/material out of a loaded (possibly nested) model scene — one
 * entry per glTF primitive. A glTF "mesh" with multiple primitives (e.g. because two parts use
 * different materials, like `player_cell.glb`'s translucent membrane + opaque nucleus, joined
 * into one Blender object but necessarily exported as 2 primitives since they don't share a
 * material) does NOT import into Three.js as one `THREE.Mesh` with a material array — glTF's
 * "primitive" and Three.js's "mesh+material-array+geometry-groups" are different mechanisms,
 * and `GLTFLoader` creates one separate `THREE.Mesh` per primitive instead. This was wrongly
 * assumed not to happen (see `extractMesh`'s git history) until an actual Playwright browser
 * playtest (Epic 2, task 016) caught `CellMeshFactory`'s constructor throwing on startup for
 * every multi-primitive model, silently aborting ALL entity+prop rendering, not just that one
 * model's — static JSON inspection of the exported `.glb` (which only checks primitive *counts
 * within* a mesh definition) can't catch this, only loading it through the real `GLTFLoader`
 * does.
 */
export function extractMeshes(model: THREE.Object3D): ExtractedModel[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  if (meshes.length === 0) {
    throw new Error("Model contains no Mesh to instance");
  }
  return meshes.map((mesh) => ({ geometry: mesh.geometry, material: mesh.material }));
}

/**
 * Builds a renderable `THREE.Object3D` for a non-instanced model (the player, and static props
 * in `static-props.ts`) that tolerates more than one primitive: a single-primitive model
 * becomes a plain `THREE.Mesh` (unchanged, fast path); a multi-primitive model becomes a
 * `THREE.Group` containing one `THREE.Mesh` per primitive, so every part renders with its own
 * correct material, and a single transform (position/rotation/scale) applied to the returned
 * `Object3D` moves every part together as one rigid unit — see `disposeObject3D` for the
 * matching cleanup.
 *
 * Epic 3, task 003: every produced `Mesh` gets `castShadow = true` here (not on the returned
 * `Group` itself — `Object3D.castShadow` has no rendering effect on a `Group`, Three.js only
 * checks it on actual `Mesh` objects, so a multi-primitive model needs every child flagged
 * individually). Both of this function's callers (player, static props) want shadow-casting, so
 * setting it centrally here avoids duplicating the Group-vs-Mesh traversal at each call site.
 */
export function buildStaticObject(model: THREE.Object3D): THREE.Object3D {
  const parts = extractMeshes(model);
  if (parts.length === 1) {
    const mesh = new THREE.Mesh(parts[0].geometry, parts[0].material);
    mesh.castShadow = true;
    return mesh;
  }
  const group = new THREE.Group();
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/**
 * Releases the geometry/material of every `THREE.Mesh` found anywhere under `object` (itself
 * included) — the disposal counterpart to `buildStaticObject`, which may have produced either a
 * bare `Mesh` or a `Group` wrapping several. Safe to call on a plain `Mesh` too (traverses to
 * just itself).
 */
export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

/**
 * Epic 3, task 003: every entity's local origin sits at the vertical center of its model (the
 * Blender scripts build spheres centered on their own origin), and every entity was positioned
 * at exactly `y=0` — the floor's own height — which puts roughly the *lower half* of every
 * round model geometrically embedded in the floor. That's invisible without shadows, but once
 * task 003 made entities cast them, a sphere whose shadow falls almost directly beneath its own
 * mostly-submerged silhouette is largely self-occluded from this camera's angle — confirmed via
 * a real Playwright screenshot: `bot_hunter` (an elongated rod, which still protrudes well above
 * y=0 despite the same y=0 origin) cast a clearly visible shadow, while the player and
 * `bot_wanderer` (both near-spherical) cast none at any zoom/mass tested. Raising entities by a
 * fraction of their own world-space radius surfaces enough of each sphere above the floor for
 * its shadow to actually be visible, while staying modest enough to still read as "sitting in
 * the dish" rather than floating above it — tuned for real in task 006's balance pass, like
 * every other new-in-Epic-3 visual constant. Task 004's bobbing animation adds a small
 * *oscillating* offset on top of this fixed base elevation, not a replacement for it.
 */
const GROUND_ELEVATION_FRACTION = 0.4;

/**
 * Epic 3, task 004: small continuous Y-oscillation on top of `GROUND_ELEVATION_FRACTION`'s fixed
 * base height, so entities read as floating/buoyant rather than rigidly fixed to one plane.
 * Amplitude/frequency are SPEC.md's Design Decision 4 starting values (2-4 world units,
 * 0.5-1 Hz) — tuned for real in task 006's balance pass, like every other new-in-Epic-3 visual
 * constant, hence the generous comment rather than a bare magic number.
 */
const BOB_AMPLITUDE = 3;
const BOB_FREQUENCY_HZ = 0.75;
const BOB_ANGULAR_FREQUENCY = 2 * Math.PI * BOB_FREQUENCY_HZ;

/** Pure sine-wave Y-offset for a given running clock and per-entity phase — kept standalone
 * (not inlined into `composeAt`) so it's directly unit-testable without a `THREE.Matrix4`. */
export function computeBobOffset(elapsedTime: number, phaseOffset: number): number {
  return BOB_AMPLITUDE * Math.sin(BOB_ANGULAR_FREQUENCY * elapsedTime + phaseOffset);
}

/**
 * Derives a stable, well-spread phase offset in `[0, 2π)` from an entity's `id` string — the
 * only approach actually grounded in existing domain data (see task 004's doc for why a
 * "spawn position" alternative was considered and dropped: nothing tracks that over time).
 * A simple multiplicative string hash is enough here; this isn't security- or
 * collision-sensitive, it only needs "different enough ids don't look like they're bobbing in
 * lockstep", not cryptographic uniformity.
 */
export function phaseOffsetForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000 * (Math.PI * 2);
}

function composeAt(
  matrix: THREE.Matrix4,
  x: number,
  z: number,
  scale: number,
  radius: number,
  bobY: number,
): THREE.Matrix4 {
  return matrix.compose(
    new THREE.Vector3(x, radius * GROUND_ELEVATION_FRACTION + bobY, z),
    IDENTITY_QUATERNION,
    new THREE.Vector3(scale, scale, scale),
  );
}

/**
 * Turns world-state entities into efficiently-rendered meshes. Food and each bot behavior
 * get one `InstancedMesh` apiece (so counts don't cost a draw call each); the player gets a
 * single plain `Mesh` since there's only ever one. `updateFromSnapshot` only ever updates
 * existing instance transforms — no per-frame geometry/mesh allocation.
 */
export class CellMeshFactory {
  readonly group = new THREE.Group();

  // Each is left unset (rather than throwing) when its model failed to load — see
  // `model-loader.ts`'s `loadAllModels` doc comment. A missing model means that one entity
  // type just never renders; it no longer takes every other entity type down with it.
  private readonly playerMesh?: THREE.Object3D;
  private readonly foodMesh?: THREE.InstancedMesh;
  private readonly botMeshes: Partial<Record<BotBehavior, THREE.InstancedMesh>> = {};
  /** Epic 3, task 004: running clock accumulated from each frame's `deltaTime` (the same
   * "receive raw deltaTime, own the accumulation internally" shape `ParticleSystem.update`
   * already established), driving the bobbing sine wave. Not reset on anything — a continuous
   * ever-increasing clock is simpler than a wrapped one and `Math.sin` doesn't care how large
   * its input gets. */
  private elapsedTime = 0;

  constructor(models: ModelCache) {
    if (models.player_cell) {
      this.playerMesh = buildStaticObject(models.player_cell);
      // Epic 3, task 005: swap the membrane's flat alpha-blended material for a glassy/fresnel
      // one. Safe to call on any object — it only touches a mesh named "MembraneMat" and is a
      // no-op otherwise, so buildStaticObject itself stays shared/non-player-specific.
      applyMembraneMaterial(this.playerMesh);
      this.group.add(this.playerMesh);
    }

    if (models.food) {
      const food = extractMesh(models.food);
      this.foodMesh = new THREE.InstancedMesh(food.geometry, food.material, MAX_FOOD_INSTANCES);
      this.foodMesh.count = 0;
      // Epic 3, task 003: InstancedMesh shadow-casting is native Three.js behavior — each
      // instance casts its own shadow using its own per-instance matrix from setMatrixAt, no
      // per-instance flag needed, just this one static flag on the InstancedMesh itself.
      this.foodMesh.castShadow = true;
      this.group.add(this.foodMesh);
    }

    for (const [behavior, modelName] of Object.entries(BOT_MODEL_FOR_BEHAVIOR) as Array<
      [BotBehavior, EntityModelName]
    >) {
      const model = models[modelName];
      if (!model) continue;
      const mesh = this.createBotInstancedMesh(model);
      this.botMeshes[behavior] = mesh;
      this.group.add(mesh);
    }
  }

  private createBotInstancedMesh(model: THREE.Object3D): THREE.InstancedMesh {
    const { geometry, material } = extractMesh(model);
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_BOTS_PER_BEHAVIOR);
    mesh.count = 0;
    // Epic 3, task 003 — see the food InstancedMesh's identical comment above.
    mesh.castShadow = true;
    return mesh;
  }

  updateFromSnapshot(snapshot: WorldSnapshot, deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.updatePlayer(snapshot.player);
    this.updateFood(snapshot.food);
    this.updateBots(snapshot.bots);
  }

  private updatePlayer(player: WorldSnapshot["player"]): void {
    if (!this.playerMesh) return; // player_cell model failed to load — nothing to update
    // The player is singular — no phase variation needed (task 004's doc: phase offsets only
    // matter for avoiding visibly-synchronized bobbing between multiple same-type entities).
    const bobY = computeBobOffset(this.elapsedTime, 0);
    this.playerMesh.position.set(
      player.position.x,
      player.radius * GROUND_ELEVATION_FRACTION + bobY,
      player.position.z,
    );
    const scale = radiusToScale(player.radius, "player_cell");
    this.playerMesh.scale.setScalar(scale);
  }

  private updateFood(food: WorldSnapshot["food"]): void {
    if (!this.foodMesh) return; // food model failed to load — nothing to update
    const count = Math.min(food.length, MAX_FOOD_INSTANCES);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const f = food[i];
      const bobY = computeBobOffset(this.elapsedTime, phaseOffsetForId(f.id));
      composeAt(matrix, f.position.x, f.position.z, radiusToScale(f.radius, "food"), f.radius, bobY);
      this.foodMesh.setMatrixAt(i, matrix);
    }
    this.foodMesh.count = count;
    this.foodMesh.instanceMatrix.needsUpdate = true;
  }

  private updateBots(bots: Bot[]): void {
    const byBehavior: Record<BotBehavior, Bot[]> = { wanderer: [], hunter: [], fleer: [] };
    for (const bot of bots) byBehavior[bot.behavior].push(bot);

    const matrix = new THREE.Matrix4();
    for (const behavior of Object.keys(byBehavior) as BotBehavior[]) {
      const mesh = this.botMeshes[behavior];
      if (!mesh) continue; // this behavior's model failed to load — nothing to update
      const list = byBehavior[behavior];
      const count = Math.min(list.length, MAX_BOTS_PER_BEHAVIOR);
      const model = BOT_MODEL_FOR_BEHAVIOR[behavior];

      for (let i = 0; i < count; i++) {
        const bot = list[i];
        const bobY = computeBobOffset(this.elapsedTime, phaseOffsetForId(bot.id));
        composeAt(matrix, bot.position.x, bot.position.z, radiusToScale(bot.radius, model), bot.radius, bobY);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.playerMesh) {
      disposeObject3D(this.playerMesh);
    }
    const instancedMeshes = [this.foodMesh, ...Object.values(this.botMeshes)].filter(
      (mesh): mesh is THREE.InstancedMesh => mesh !== undefined,
    );
    for (const mesh of instancedMeshes) {
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
      mesh.dispose();
    }
  }
}

/**
 * NOTE: `THREE.Material.dispose()` does not cascade to any texture properties (`map`,
 * `normalMap`, `roughnessMap`, etc.) bound to that material — those must be disposed
 * separately. Not a live leak today: every `tools/blender/generate_*.py` script uses flat
 * Principled-BSDF colors via `make_material()`, with no image-texture nodes, so there are no
 * `THREE.Texture` instances to leak currently. If/when a textured model is introduced, extend
 * this function to also dispose any texture-valued properties on the material.
 */
function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const m of material) m.dispose();
  } else {
    material.dispose();
  }
}
