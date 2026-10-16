import * as THREE from "three";

/** Petri-dish floor color — pale, slightly warm white. */
const FLOOR_COLOR = 0xf2f6f2;
/** Glass-like rim color — faint blue-green tint. */
const RIM_COLOR = 0xaad4cc;
const RIM_OPACITY = 0.55;
/** Rim tube thickness relative to the arena, kept thin so it reads as a dish edge, not a wall. */
const RIM_TUBE_RADIUS_FRACTION = 0.015;

/**
 * Builds the static scene content: the flat arena floor and its petri-dish rim at the
 * boundary. Built directly with Three.js primitives — no Blender model for the arena itself,
 * since it's the only static, non-instanced piece of geometry on screen.
 */
export function createScene(arenaWidth: number): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8f0ee);

  const { floor, rim } = buildArenaFloorAndRim(arenaWidth);
  scene.add(floor);
  scene.add(rim);

  return scene;
}

/**
 * The `arenaWidth`-dependent part of `createScene`, factored out so `ThreeRenderer.setArenaWidth`
 * (task 001, Epic 2) can rebuild just the floor/rim in place on an already-live scene — without
 * reconstructing the whole `THREE.Scene` and losing the lighting/entity-mesh group already added
 * to it.
 */
export function buildArenaFloorAndRim(arenaWidth: number): { floor: THREE.Mesh; rim: THREE.Mesh } {
  const arenaRadius = arenaWidth / 2;

  const floorGeometry = new THREE.CircleGeometry(arenaRadius, 64);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR,
    roughness: 0.9,
    metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  // CircleGeometry lies flat in XY by default; rotate it onto the XZ ground plane this
  // codebase's Vector2 ({x, z}) assumes.
  floor.rotation.x = -Math.PI / 2;
  floor.name = "arena-floor";

  const rimTubeRadius = arenaRadius * RIM_TUBE_RADIUS_FRACTION;
  const rimGeometry = new THREE.TorusGeometry(arenaRadius, rimTubeRadius, 16, 96);
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: RIM_COLOR,
    transparent: true,
    opacity: RIM_OPACITY,
    roughness: 0.2,
    metalness: 0.1,
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  // TorusGeometry lies flat in XY by default too; same rotation as the floor.
  rim.rotation.x = -Math.PI / 2;
  rim.name = "arena-rim";

  return { floor, rim };
}
