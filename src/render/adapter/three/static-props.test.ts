import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildStaticProps } from "./static-props";
import type { ModelCache } from "./model-loader";

/** Mirrors cell-mesh-factory.test.ts's fakeModel: a Group wrapping a single Mesh, shaped like
 * what GLTFLoader actually returns. */
function fakeModel(): THREE.Object3D {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial()));
  return group;
}

/** Mirrors the real prop_empty_dish.glb/prop_pipette.glb shape: 2 primitives (different
 * materials), which GLTFLoader imports as 2 sibling Meshes, not 1 Mesh with a material array —
 * see cell-mesh-factory.ts's buildStaticObject doc comment. */
function fakeMultiMeshModel(): THREE.Object3D {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial()));
  group.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.1), new THREE.MeshStandardMaterial()));
  return group;
}

describe("buildStaticProps", () => {
  it("places one static Mesh per prop placement when every prop model loaded", () => {
    const models: ModelCache = {
      prop_empty_dish: fakeModel(),
      prop_pipette: fakeModel(),
      prop_droplet: fakeModel(),
    };

    const group = buildStaticProps(models);

    // 5 placements total (1 dish + 1 pipette + 3 droplets) per static-props.ts's PLACEMENTS.
    expect(group.children).toHaveLength(5);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
    }
  });

  it("skips only the placements whose model failed to load, keeping the rest", () => {
    const models: ModelCache = {
      prop_empty_dish: fakeModel(),
      // prop_pipette and prop_droplet both missing — simulates two failed/corrupt assets.
    };

    const group = buildStaticProps(models);

    // Only the 1 empty-dish placement should have built a mesh; the pipette placement and all
    // 3 droplet placements are skipped, not thrown — matching model-loader.ts's partial-cache
    // degrade-gracefully contract (never the old all-or-nothing failure mode).
    expect(group.children).toHaveLength(1);
  });

  it("produces an empty (but valid) group when every prop model is missing", () => {
    const group = buildStaticProps({});

    expect(group.children).toHaveLength(0);
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("applies each placement's fixed position and scale to its mesh", () => {
    const models: ModelCache = { prop_empty_dish: fakeModel() };

    const group = buildStaticProps(models);
    const mesh = group.children[0] as THREE.Mesh;

    // static-props.ts's PLACEMENTS entry for prop_empty_dish: x=996, z=836, scale=90.
    expect(mesh.position.x).toBeCloseTo(996);
    expect(mesh.position.z).toBeCloseTo(836);
    expect(mesh.position.y).toBeCloseTo(0);
    expect(mesh.scale.x).toBeCloseTo(90);
    expect(mesh.scale.y).toBeCloseTo(90);
    expect(mesh.scale.z).toBeCloseTo(90);
  });

  it("builds a Group (not a crash) for a prop whose model has more than one primitive, matching the real prop_empty_dish.glb/prop_pipette.glb shape", () => {
    // Regression test for the real bug task 016's Playwright playtest caught: prop_empty_dish
    // and prop_pipette each genuinely have 2 primitives (base+rim, shaft+bulb — different
    // materials), which used to make the whole CellMeshFactory constructor throw on startup
    // (since it called the strict single-mesh extractMesh for the player too) — aborting ALL
    // entity+prop rendering. buildStaticProps must place these as a Group of their meshes,
    // transformed together as one rigid unit, same as a single-mesh prop.
    const models: ModelCache = { prop_empty_dish: fakeMultiMeshModel() };

    const group = buildStaticProps(models);
    const placed = group.children[0];

    expect(placed).toBeInstanceOf(THREE.Group);
    expect((placed as THREE.Group).children).toHaveLength(2);
    for (const child of (placed as THREE.Group).children) expect(child).toBeInstanceOf(THREE.Mesh);
    // Position/scale still apply to the whole placed object, same as the single-mesh case.
    expect(placed.position.x).toBeCloseTo(996);
    expect(placed.position.z).toBeCloseTo(836);
    expect(placed.scale.x).toBeCloseTo(90);
  });

  it("makes every placed prop mesh cast shadows, including multi-primitive ones (Epic 3, task 003)", () => {
    const models: ModelCache = {
      prop_empty_dish: fakeMultiMeshModel(),
      prop_pipette: fakeModel(),
      prop_droplet: fakeModel(),
    };

    const group = buildStaticProps(models);

    for (const placed of group.children) {
      if (placed instanceof THREE.Mesh) {
        expect(placed.castShadow).toBe(true);
      } else {
        for (const child of (placed as THREE.Group).children) {
          expect((child as THREE.Mesh).castShadow).toBe(true);
        }
      }
    }
  });

  it("never mutates the input ModelCache or its model objects", () => {
    const model = fakeModel();
    const models: ModelCache = { prop_droplet: model };

    buildStaticProps(models);

    expect(models.prop_droplet).toBe(model);
  });
});
