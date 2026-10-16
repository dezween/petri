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

  it("never mutates the input ModelCache or its model objects", () => {
    const model = fakeModel();
    const models: ModelCache = { prop_droplet: model };

    buildStaticProps(models);

    expect(models.prop_droplet).toBe(model);
  });
});
