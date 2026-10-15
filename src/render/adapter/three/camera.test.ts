import { describe, expect, it } from "vitest";
import { adjustZoomForPlayerRadius, createCamera, updateCameraAspect } from "./camera";

describe("createCamera", () => {
  it("creates an orthographic camera looking straight down at the origin", () => {
    const camera = createCamera(1.5);

    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.x).toBe(0);
    expect(camera.position.z).toBe(0);
  });

  it("applies the given aspect ratio to the frustum", () => {
    const camera = createCamera(2);
    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;

    expect(width / height).toBeCloseTo(2);
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
