import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CellMeshFactory, extractMesh, radiusToScale } from "./cell-mesh-factory";
import type { ModelCache, ModelName } from "./model-loader";
import type { WorldSnapshot } from "@/world/service/world.service";
import type { Bot } from "@/world/domain/bot.entity";

/** Builds a fake loaded-model scene shaped like what GLTFLoader actually returns: a Group
 * wrapping a Mesh. Lets CellMeshFactory's real extraction/instancing logic run without a
 * real GLTFLoader or WebGL context. */
function fakeModel(): THREE.Object3D {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial(),
  );
  group.add(mesh);
  return group;
}

function fakeModelCache(): ModelCache {
  const names: ModelName[] = ["player_cell", "bot_wanderer", "bot_hunter", "bot_fleer", "food"];
  const cache = {} as ModelCache;
  for (const name of names) cache[name] = fakeModel();
  return cache;
}

/** Mirrors the shape `player_cell.glb` had before its Blender script joined the membrane +
 * nucleus objects: two sibling Meshes under one Group, neither nested inside the other. */
function fakeMultiMeshModel(): THREE.Object3D {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial()),
  );
  group.add(
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial()),
  );
  return group;
}

function bot(id: string, behavior: Bot["behavior"], x: number, radius: number): Bot {
  return { id, behavior, position: { x, z: 0 }, radius, mass: radius * radius };
}

describe("radiusToScale", () => {
  it("divides world radius by the model's own base radius", () => {
    // food's Blender base radius is 0.25 (tools/blender/generate_food.py).
    expect(radiusToScale(0.25, "food")).toBeCloseTo(1);
    expect(radiusToScale(2.5, "food")).toBeCloseTo(10);
  });
});

describe("CellMeshFactory", () => {
  it("starts with zero live instances for food and every bot behavior", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const instancedMeshes = factory.group.children.filter(
      (c) => c instanceof THREE.InstancedMesh,
    ) as THREE.InstancedMesh[];

    expect(instancedMeshes).toHaveLength(4); // food + 3 bot behaviors
    for (const mesh of instancedMeshes) expect(mesh.count).toBe(0);
  });

  it("positions and scales the player mesh from the snapshot", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 10, z: -5 }, radius: 2, mass: 1 },
      bots: [],
      food: [],
      arenaWidth: 1000,
    };

    factory.updateFromSnapshot(snapshot);

    const playerMesh = factory.group.children.find(
      (c) => c instanceof THREE.Mesh,
    ) as THREE.Mesh;
    expect(playerMesh.position.x).toBeCloseTo(10);
    expect(playerMesh.position.z).toBeCloseTo(-5);
    expect(playerMesh.scale.x).toBeCloseTo(radiusToScale(2, "player_cell"));
  });

  it("sets the instance count to the live food count, capped at the max", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const food = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      position: { x: i, z: 0 },
      radius: 0.25,
      mass: 1,
    }));
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 1, mass: 1 },
      bots: [],
      food,
      arenaWidth: 1000,
    };

    factory.updateFromSnapshot(snapshot);

    const foodMesh = factory.group.children.find(
      (c) => c instanceof THREE.InstancedMesh,
    ) as THREE.InstancedMesh;
    expect(foodMesh.count).toBe(5);
  });

  it("routes each bot behavior to its own instanced mesh and scales per-instance", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const bots = [bot("b1", "hunter", 0, 1), bot("b2", "fleer", 10, 2)];
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 1, mass: 1 },
      bots,
      food: [],
      arenaWidth: 1000,
    };

    factory.updateFromSnapshot(snapshot);

    const instancedMeshes = factory.group.children.filter(
      (c) => c instanceof THREE.InstancedMesh,
    ) as THREE.InstancedMesh[];
    const nonEmpty = instancedMeshes.filter((m) => m.count > 0);
    expect(nonEmpty).toHaveLength(2); // hunter's mesh and fleer's mesh each got exactly 1
    for (const mesh of nonEmpty) expect(mesh.count).toBe(1);
  });

  it("builds the player as a Group of all its meshes when the model has more than one primitive, instead of crashing", () => {
    // Regression test for the real bug task 016's Playwright playtest caught: player_cell.glb
    // legitimately has 2 primitives (translucent membrane + opaque nucleus, different
    // materials), and GLTFLoader imports that as 2 sibling THREE.Mesh nodes, not 1 Mesh with a
    // material array. CellMeshFactory's constructor used to call the strict single-mesh
    // extractMesh() for the player too, so it threw on every real startup — aborting ALL
    // entity+prop rendering, not just the player's. It must now build a Group containing both
    // meshes and treat that Group as a single rigid unit for position/scale, same as it would
    // treat a plain Mesh.
    const cache = fakeModelCache();
    cache.player_cell = fakeMultiMeshModel();

    const factory = new CellMeshFactory(cache);
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 7, z: -3 }, radius: 2, mass: 1 },
      bots: [],
      food: [],
      arenaWidth: 1000,
    };
    factory.updateFromSnapshot(snapshot);

    const playerObject = factory.group.children.find((c) => c instanceof THREE.Group) as THREE.Group;
    expect(playerObject).toBeInstanceOf(THREE.Group);
    expect(playerObject.children).toHaveLength(2);
    for (const child of playerObject.children) expect(child).toBeInstanceOf(THREE.Mesh);
    // Position/scale applied once to the Group moves/scales both meshes together.
    expect(playerObject.position.x).toBeCloseTo(7);
    expect(playerObject.position.z).toBeCloseTo(-3);
    expect(playerObject.scale.x).toBeCloseTo(radiusToScale(2, "player_cell"));

    expect(() => factory.dispose()).not.toThrow();
  });

  it("extractMesh (the strict single-mesh path used for InstancedMesh bots/food) still throws on a multi-mesh model", () => {
    // InstancedMesh genuinely can't represent a multi-primitive model without more work (see
    // extractMesh's doc comment) — none of the bot/food models currently need more than one
    // primitive, and this throw is the intentional signal if that ever changes, not a bug.
    expect(() => extractMesh(fakeMultiMeshModel())).toThrow(/2 meshes/);
  });

  it("makes the player mesh, food, and every bot InstancedMesh cast shadows (Epic 3, task 003)", () => {
    const factory = new CellMeshFactory(fakeModelCache());

    const playerMesh = factory.group.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    expect(playerMesh.castShadow).toBe(true);

    const instancedMeshes = factory.group.children.filter(
      (c) => c instanceof THREE.InstancedMesh,
    ) as THREE.InstancedMesh[];
    expect(instancedMeshes).toHaveLength(4); // food + 3 bot behaviors
    for (const mesh of instancedMeshes) expect(mesh.castShadow).toBe(true);
  });

  it("casts shadows from every child mesh when the player model has more than one primitive", () => {
    const cache = fakeModelCache();
    cache.player_cell = fakeMultiMeshModel();
    const factory = new CellMeshFactory(cache);

    const playerGroup = factory.group.children.find((c) => c instanceof THREE.Group) as THREE.Group;
    expect(playerGroup.children).toHaveLength(2);
    for (const child of playerGroup.children) {
      expect((child as THREE.Mesh).castShadow).toBe(true);
    }
  });

  it("reuses the same InstancedMesh objects across calls instead of rebuilding them", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const before = factory.group.children.filter((c) => c instanceof THREE.InstancedMesh);

    factory.updateFromSnapshot({
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 1, mass: 1 },
      bots: [bot("b1", "wanderer", 0, 1)],
      food: [],
      arenaWidth: 1000,
    });
    const after = factory.group.children.filter((c) => c instanceof THREE.InstancedMesh);

    expect(after).toEqual(before); // same object identities, not recreated
  });
});
