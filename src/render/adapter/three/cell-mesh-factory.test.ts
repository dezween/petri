import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CellMeshFactory, computeBobOffset, extractMesh, phaseOffsetForId, radiusToScale } from "./cell-mesh-factory";
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

describe("computeBobOffset", () => {
  it("stays within the configured amplitude band", () => {
    for (let t = 0; t < 10; t += 0.1) {
      const offset = computeBobOffset(t, 0);
      expect(Math.abs(offset)).toBeLessThanOrEqual(3 + 1e-9); // BOB_AMPLITUDE = 3
    }
  });

  it("is zero at t=0 with a zero phase, and oscillates (not constant) over time", () => {
    expect(computeBobOffset(0, 0)).toBeCloseTo(0);
    const atZero = computeBobOffset(0, 0);
    const later = computeBobOffset(0.3, 0);
    expect(later).not.toBeCloseTo(atZero, 5);
  });

  it("a nonzero phase offset shifts the wave, producing a different value at the same t", () => {
    const unphased = computeBobOffset(0.2, 0);
    const phased = computeBobOffset(0.2, Math.PI / 2);
    expect(phased).not.toBeCloseTo(unphased, 5);
  });
});

describe("phaseOffsetForId", () => {
  it("is stable for the same id across calls", () => {
    expect(phaseOffsetForId("food-42")).toBe(phaseOffsetForId("food-42"));
  });

  it("gives different ids different phases (not every id collapsing to the same offset)", () => {
    const phases = ["food-1", "food-2", "bot-1", "bot-2", "bot-3"].map(phaseOffsetForId);
    const distinct = new Set(phases.map((p) => p.toFixed(6)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("always returns a value in [0, 2π)", () => {
    for (const id of ["a", "food-1", "bot-999", ""]) {
      const phase = phaseOffsetForId(id);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
    }
  });
});

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

    factory.updateFromSnapshot(snapshot, 0);

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

    factory.updateFromSnapshot(snapshot, 0);

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

    factory.updateFromSnapshot(snapshot, 0);

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
    factory.updateFromSnapshot(snapshot, 0);

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

  it("elevates entities a fraction of their own radius above the floor, not y=0 (Epic 3, task 003)", () => {
    // Regression test for a real visual bug a Playwright screenshot caught: at y=0, a sphere's
    // own origin/center sits exactly at floor height, so half its geometry is embedded in the
    // floor and its own shadow falls almost directly beneath its self-occluding upper half —
    // invisible. Elevating by a fraction of the entity's radius surfaces enough of it for a
    // shadow to actually show.
    const factory = new CellMeshFactory(fakeModelCache());
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 40, mass: 25 },
      bots: [bot("b1", "hunter", 5, 20)],
      food: [], // kept empty so the food InstancedMesh's count stays 0 — otherwise it'd also
      // match the "count === 1" lookup below and this test would silently check the wrong mesh.
      arenaWidth: 1000,
    };

    factory.updateFromSnapshot(snapshot, 0);

    const playerMesh = factory.group.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    expect(playerMesh.position.y).toBeGreaterThan(0);
    // Player has no bob phase offset (see computeBobOffset's player call site), and at
    // elapsedTime=0 sin(0)=0 regardless — so this stays an exact check of the elevation alone.
    expect(playerMesh.position.y).toBeCloseTo(40 * 0.4);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const hunterMesh = factory.group.children.find(
      (c) => c instanceof THREE.InstancedMesh && (c as THREE.InstancedMesh).count === 1,
    ) as THREE.InstancedMesh;
    hunterMesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);
    // Bots DO get a per-id bob phase (Epic 3, task 004), so even at elapsedTime=0 the expected
    // Y includes whatever that entity's bob offset is at t=0 — not just the bare elevation.
    expect(position.y).toBeCloseTo(20 * 0.4 + computeBobOffset(0, phaseOffsetForId("b1")));
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

  it("bobs the player mesh's Y position over time as accumulated deltaTime advances (Epic 3, task 004)", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 10, mass: 1 },
      bots: [],
      food: [],
      arenaWidth: 1000,
    };

    factory.updateFromSnapshot(snapshot, 0);
    const playerMesh = factory.group.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    const yAtStart = playerMesh.position.y;

    factory.updateFromSnapshot(snapshot, 0.3); // advance the internal elapsed-time clock
    const yLater = playerMesh.position.y;

    expect(yLater).not.toBeCloseTo(yAtStart, 5);
  });

  it("gives same-type bots different Y offsets at the same instant, so they don't bob in lockstep", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const snapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 10, mass: 1 },
      bots: [bot("wanderer-a", "wanderer", 0, 10), bot("wanderer-b", "wanderer", 50, 10)],
      food: [],
      arenaWidth: 1000,
    };

    // A nonzero elapsedTime so a zero-phase entity wouldn't coincidentally also read as 0 here.
    factory.updateFromSnapshot(snapshot, 1.23);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const wandererMesh = factory.group.children.find(
      (c) => c instanceof THREE.InstancedMesh && (c as THREE.InstancedMesh).count === 2,
    ) as THREE.InstancedMesh;

    wandererMesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);
    const yA = position.y;

    wandererMesh.getMatrixAt(1, matrix);
    position.setFromMatrixPosition(matrix);
    const yB = position.y;

    expect(yA).not.toBeCloseTo(yB, 5);
  });

  it("reuses the same InstancedMesh objects across calls instead of rebuilding them", () => {
    const factory = new CellMeshFactory(fakeModelCache());
    const before = factory.group.children.filter((c) => c instanceof THREE.InstancedMesh);

    factory.updateFromSnapshot(
      {
        player: { id: "p1", position: { x: 0, z: 0 }, radius: 1, mass: 1 },
        bots: [bot("b1", "wanderer", 0, 1)],
        food: [],
        arenaWidth: 1000,
      },
      0,
    );
    const after = factory.group.children.filter((c) => c instanceof THREE.InstancedMesh);

    expect(after).toEqual(before); // same object identities, not recreated
  });
});
