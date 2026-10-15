import * as THREE from "three";
import type { ModelCache, ModelName } from "./model-loader";
import type { WorldSnapshot } from "@/world/service/world.service";
import type { Bot, BotBehavior } from "@/world/domain/bot.entity";

/** Upper bound on simultaneous food instances. Food count is tuned for real in task 027. */
const MAX_FOOD_INSTANCES = 400;
/** Upper bound on simultaneous bots per behavior type. Tuned for real in task 027. */
const MAX_BOTS_PER_BEHAVIOR = 60;

/**
 * Each model's "radius" in its own local units, as built by its `tools/blender/generate_*.py`
 * script (grepped from the actual `bpy.ops.mesh.primitive_*_add(radius=...)` calls, not
 * guessed) — the factor a world-space game radius is divided by to get this model's scale.
 * `bot_hunter` is an elongated rod, not a sphere, so its "radius" here is its cylinder's
 * cross-section radius (0.5) rather than a true bounding radius — a deliberate judgment call
 * so scaling it up grows both its width and length proportionally, which reads correctly for
 * an elongated shape; there's no single "correct" radius for a non-spherical mesh.
 */
const BASE_MODEL_RADIUS: Record<ModelName, number> = {
  player_cell: 1.0,
  bot_wanderer: 1.0,
  bot_hunter: 0.5,
  bot_fleer: 0.8,
  food: 0.25,
};

const BOT_MODEL_FOR_BEHAVIOR: Record<BotBehavior, ModelName> = {
  wanderer: "bot_wanderer",
  hunter: "bot_hunter",
  fleer: "bot_fleer",
};

/** World-space radius -> this model's local scale factor. */
export function radiusToScale(radius: number, model: ModelName): number {
  return radius / BASE_MODEL_RADIUS[model];
}

interface ExtractedModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/** Pulls the first mesh's geometry/material out of a loaded (possibly nested) model scene. */
function extractMesh(model: THREE.Object3D): ExtractedModel {
  let found: THREE.Mesh | undefined;
  model.traverse((child) => {
    if (!found && child instanceof THREE.Mesh) found = child;
  });
  if (!found) {
    throw new Error("Model contains no Mesh to instance");
  }
  return { geometry: found.geometry, material: found.material };
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

function composeAt(
  matrix: THREE.Matrix4,
  x: number,
  z: number,
  scale: number,
): THREE.Matrix4 {
  return matrix.compose(
    new THREE.Vector3(x, 0, z),
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

  private readonly playerMesh: THREE.Mesh;
  private readonly foodMesh: THREE.InstancedMesh;
  private readonly botMeshes: Record<BotBehavior, THREE.InstancedMesh>;

  constructor(models: ModelCache) {
    const player = extractMesh(models.player_cell);
    this.playerMesh = new THREE.Mesh(player.geometry, player.material);
    this.group.add(this.playerMesh);

    const food = extractMesh(models.food);
    this.foodMesh = new THREE.InstancedMesh(food.geometry, food.material, MAX_FOOD_INSTANCES);
    this.foodMesh.count = 0;
    this.group.add(this.foodMesh);

    this.botMeshes = {
      wanderer: this.createBotInstancedMesh(models.bot_wanderer),
      hunter: this.createBotInstancedMesh(models.bot_hunter),
      fleer: this.createBotInstancedMesh(models.bot_fleer),
    };
    for (const mesh of Object.values(this.botMeshes)) this.group.add(mesh);
  }

  private createBotInstancedMesh(model: THREE.Object3D): THREE.InstancedMesh {
    const { geometry, material } = extractMesh(model);
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_BOTS_PER_BEHAVIOR);
    mesh.count = 0;
    return mesh;
  }

  updateFromSnapshot(snapshot: WorldSnapshot): void {
    this.updatePlayer(snapshot.player);
    this.updateFood(snapshot.food);
    this.updateBots(snapshot.bots);
  }

  private updatePlayer(player: WorldSnapshot["player"]): void {
    this.playerMesh.position.set(player.position.x, 0, player.position.z);
    const scale = radiusToScale(player.radius, "player_cell");
    this.playerMesh.scale.setScalar(scale);
  }

  private updateFood(food: WorldSnapshot["food"]): void {
    const count = Math.min(food.length, MAX_FOOD_INSTANCES);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const f = food[i];
      composeAt(matrix, f.position.x, f.position.z, radiusToScale(f.radius, "food"));
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
      const list = byBehavior[behavior];
      const count = Math.min(list.length, MAX_BOTS_PER_BEHAVIOR);
      const model = BOT_MODEL_FOR_BEHAVIOR[behavior];

      for (let i = 0; i < count; i++) {
        const bot = list[i];
        composeAt(matrix, bot.position.x, bot.position.z, radiusToScale(bot.radius, model));
        mesh.setMatrixAt(i, matrix);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.playerMesh.geometry.dispose();
    disposeMaterial(this.playerMesh.material);
    for (const mesh of [this.foodMesh, ...Object.values(this.botMeshes)]) {
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
      mesh.dispose();
    }
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const m of material) m.dispose();
  } else {
    material.dispose();
  }
}
