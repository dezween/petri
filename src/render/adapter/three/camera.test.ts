import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { adjustZoomForPlayerRadius, createCamera, updateCameraAspect, updateCameraPosition } from "./camera";

describe("createCamera", () => {
  it("creates an orthographic camera tilted away from the old straight-down view", () => {
    const camera = createCamera(1.5);

    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.x).toBe(0);
    // Epic 3, task 001: no longer 0 — the camera sits offset along -Z to achieve the tilt.
    expect(camera.position.z).toBeLessThan(0);
  });

  it("looks at the origin with a non-degenerate up vector (forward and up aren't parallel)", () => {
    const camera = createCamera(1);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const up = camera.up.clone().normalize();
    const cross = new THREE.Vector3().crossVectors(forward, up);

    // A zero cross product would mean forward/up are parallel — the exact degenerate case the
    // old straight-down view had to special-case `camera.up` to avoid (see createCamera's
    // comment). Tilted, this should no longer be an issue with the default (0,1,0) up.
    expect(cross.length()).toBeGreaterThan(0.01);
  });

  it("applies the given aspect ratio to the frustum", () => {
    const camera = createCamera(2);
    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;

    expect(width / height).toBeCloseTo(2);
  });
});

describe("updateCameraPosition", () => {
  it("keeps the same tilt offset createCamera establishes, just recentered on the player", () => {
    const camera = createCamera(1);
    const initialOffsetZ = camera.position.z; // the tilt offset, since createCamera targets (0,0,0)

    updateCameraPosition(camera, { x: 50, z: 30 });

    expect(camera.position.x).toBe(50);
    // Same tilt offset relative to the player's z, not reset to the world origin's offset.
    expect(camera.position.z).toBeCloseTo(30 + initialOffsetZ);
  });

  it("produces no jump between createCamera's initial pose and the first follow-update at the origin", () => {
    const camera = createCamera(1);
    const initialPosition = camera.position.clone();

    updateCameraPosition(camera, { x: 0, z: 0 });

    expect(camera.position.distanceTo(initialPosition)).toBeCloseTo(0);
  });
});

describe("updateCameraAspect", () => {
  it("rescales the frustum width while preserving its height", () => {
    const camera = createCamera(1);
    const heightBefore = camera.top - camera.bottom;

    updateCameraAspect(camera, 2);

    expect(camera.top - camera.bottom).toBeCloseTo(heightBefore);
    expect((camera.right - camera.left) / (camera.top - camera.bottom)).toBeCloseTo(2);
  });
});

describe("adjustZoomForPlayerRadius", () => {
  it("widens the frustum as the player's radius grows", () => {
    const camera = createCamera(1);

    adjustZoomForPlayerRadius(camera, 10);
    const smallPlayerHeight = camera.top - camera.bottom;

    adjustZoomForPlayerRadius(camera, 200);
    const bigPlayerHeight = camera.top - camera.bottom;

    expect(bigPlayerHeight).toBeGreaterThan(smallPlayerHeight);
  });

  it("never zooms in tighter than the configured minimum, even at radius 0", () => {
    const camera = createCamera(1);
    adjustZoomForPlayerRadius(camera, 0);

    expect(camera.top - camera.bottom).toBeGreaterThan(0);
  });

  it("preserves the current aspect ratio after zooming", () => {
    const camera = createCamera(1.7);
    adjustZoomForPlayerRadius(camera, 50);

    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;
    expect(width / height).toBeCloseTo(1.7);
  });
});
