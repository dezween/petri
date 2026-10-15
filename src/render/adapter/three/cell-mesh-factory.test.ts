import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CellMeshFactory, radiusToScale } from "./cell-mesh-factory";
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

  it("throws loudly (instead of silently dropping meshes) when a model contains more than one unjoined Mesh", () => {
    // Regression test for the player_cell.glb bug: before its Blender script joined the
    // membrane + nucleus objects into one mesh, the exported model had two sibling meshes
    // and extractMesh() silently kept only the first one. extractMesh must now fail loudly
    // instead, so this class of bug can't silently regress.
    const cache = fakeModelCache();
    cache.player_cell = fakeMultiMeshModel();

    expect(() => new CellMeshFactory(cache)).toThrow(/2 meshes/);
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
