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

    const group = buildStaticProps(models, 2000);

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

    const group = buildStaticProps(models, 2000);

    // Only the 1 empty-dish placement should have built a mesh; the pipette placement and all
    // 3 droplet placements are skipped, not thrown — matching model-loader.ts's partial-cache
    // degrade-gracefully contract (never the old all-or-nothing failure mode).
    expect(group.children).toHaveLength(1);
  });

  it("produces an empty (but valid) group when every prop model is missing", () => {
    const group = buildStaticProps({}, 2000);

    expect(group.children).toHaveLength(0);
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("applies each placement's angle/rim-offset-derived position and scale to its mesh", () => {
    const models: ModelCache = { prop_empty_dish: fakeModel() };
    const arenaWidth = 2000;

    const group = buildStaticProps(models, arenaWidth);
    const mesh = group.children[0] as THREE.Mesh;

    // static-props.ts's PLACEMENTS entry for prop_empty_dish: angle = atan2(836, 996),
    // offsetFromRim = 300, scale = 90. At arenaWidth=2000 (radius 1000) that's distance 1300
    // from the origin at that angle — reproducing this layout's original fixed-position design
    // (which was hand-picked at exactly this arena size), now derived instead of hardcoded.
    const expectedDistance = arenaWidth / 2 + 300;
    const expectedAngle = Math.atan2(836, 996);
    expect(mesh.position.x).toBeCloseTo(Math.cos(expectedAngle) * expectedDistance);
    expect(mesh.position.z).toBeCloseTo(Math.sin(expectedAngle) * expectedDistance);
    expect(mesh.position.y).toBeCloseTo(0);
    expect(mesh.scale.x).toBeCloseTo(90);
    expect(mesh.scale.y).toBeCloseTo(90);
    expect(mesh.scale.z).toBeCloseTo(90);
  });

  it("regression: moves a prop further from the origin as arenaWidth grows, always staying outside the rim", () => {
    // The bug this fixes: props used to sit at a fixed absolute distance from the origin, so
    // they ended up INSIDE the dish once arena sizes grew past the old fixed radius they were
    // placed outside of. Every placement's real distance from the origin must now track
    // arenaWidth/2 (the rim) plus its offsetFromRim, for every selectable arena size.
    const models: ModelCache = { prop_droplet: fakeModel() };

    for (const arenaWidth of [1000, 1750, 2000, 3250]) {
      const group = buildStaticProps(models, arenaWidth);
      const mesh = group.children[0] as THREE.Mesh;
      const distanceFromOrigin = Math.hypot(mesh.position.x, mesh.position.z);
      const rimRadius = arenaWidth / 2;

      expect(distanceFromOrigin).toBeGreaterThan(rimRadius);
      // offsetFromRim is 300 for every current PLACEMENTS entry (see static-props.ts) — assert
      // the real margin, not just ">", so a future placement with a wildly different offset
      // (or a regression back to a fixed absolute position) would actually fail this.
      expect(distanceFromOrigin).toBeCloseTo(rimRadius + 300);
    }
  });

  it("builds a Group (not a crash) for a prop whose model has more than one primitive, matching the real prop_empty_dish.glb/prop_pipette.glb shape", () => {
    // Regression test for the real bug task 016's Playwright playtest caught: prop_empty_dish
    // and prop_pipette each genuinely have 2 primitives (base+rim, shaft+bulb — different
    // materials), which used to make the whole CellMeshFactory constructor throw on startup
    // (since it called the strict single-mesh extractMesh for the player too) — aborting ALL
    // entity+prop rendering. buildStaticProps must place these as a Group of their meshes,
    // transformed together as one rigid unit, same as a single-mesh prop.
    const models: ModelCache = { prop_empty_dish: fakeMultiMeshModel() };

    const group = buildStaticProps(models, 2000);
    const placed = group.children[0];

    expect(placed).toBeInstanceOf(THREE.Group);
    expect((placed as THREE.Group).children).toHaveLength(2);
    for (const child of (placed as THREE.Group).children) expect(child).toBeInstanceOf(THREE.Mesh);
    // Position/scale still apply to the whole placed object, same as the single-mesh case.
    // Same angle/offsetFromRim-derived expectation as the single-mesh position test above.
    const expectedDistance = 2000 / 2 + 300;
    const expectedAngle = Math.atan2(836, 996);
    expect(placed.position.x).toBeCloseTo(Math.cos(expectedAngle) * expectedDistance);
    expect(placed.position.z).toBeCloseTo(Math.sin(expectedAngle) * expectedDistance);
    expect(placed.scale.x).toBeCloseTo(90);
  });

  it("makes every placed prop mesh cast shadows, including multi-primitive ones (Epic 3, task 003)", () => {
    const models: ModelCache = {
      prop_empty_dish: fakeMultiMeshModel(),
      prop_pipette: fakeModel(),
      prop_droplet: fakeModel(),
    };

    const group = buildStaticProps(models, 2000);

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

    buildStaticProps(models, 2000);

    expect(models.prop_droplet).toBe(model);
  });
});
