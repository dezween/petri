import * as THREE from "three";

/** Petri-dish floor color — pale, slightly warm white. */
const FLOOR_COLOR = 0xf2f6f2;
/** Glass-like rim color — faint blue-green tint. */
const RIM_COLOR = 0xaad4cc;
const RIM_OPACITY = 0.55;
/** Rim tube thickness relative to the arena, kept thin so it reads as a dish edge, not a wall. */
const RIM_TUBE_RADIUS_FRACTION = 0.015;

/** Dark, matte lab-bench surface — deliberately contrasts against the pale FLOOR_COLOR/RIM_COLOR
 * and the pale background rather than competing with them. */
const BENCH_COLOR = 0x33393a;
/**
 * Epic 2, task 010: sized to stay fully visible beneath the camera's frustum at the most
 * extreme case — Large arena (width 2000, so a 1000-radius player roam area) combined with
 * the camera's maximum zoom-out (player radius at the victory cap: 2000 * 0.375 = 750) and a
 * generously wide aspect ratio (ultrawide/multi-monitor, assumed up to ~3:1). Worked out from
 * `camera.ts`'s `adjustZoomForPlayerRadius`: halfHeight at that player radius is
 * 600 + 750 * (2.2/4) ≈ 1012, so halfWidth at aspect 3 ≈ 3037. The camera can additionally be
 * up to 1000 units off-origin (the player's own roam radius), so the farthest point the
 * frustum could need covered from world origin is on the order of
 * 1000 + sqrt(1012² + 3037²) ≈ 4200. 6000 leaves comfortable headroom beyond that worst case.
 */
const BENCH_RADIUS = 6000;

/**
 * Builds the static scene content: the lab-bench ground plane, the flat arena floor, and its
 * petri-dish rim at the boundary. Built directly with Three.js primitives — no Blender model
 * for any of this, since it's all static, non-instanced geometry.
 */
export function createScene(arenaWidth: number): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8f0ee);

  scene.add(buildLabBench());

  const { floor, rim } = buildArenaFloorAndRim(arenaWidth);
  scene.add(floor);
  scene.add(rim);

  return scene;
}

/**
 * The lab-bench plane the dish "sits on". Centered on the world origin (not the player) and
 * sized (see `BENCH_RADIUS`) to always extend past the camera's frustum regardless of arena
 * size or player position, so — unlike the floor/rim — it never needs rebuilding when
 * `ThreeRenderer.setArenaWidth` changes the arena size; it's built once in `createScene` and
 * left alone for the renderer's lifetime.
 */
function buildLabBench(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(BENCH_RADIUS, 48);
  const material = new THREE.MeshStandardMaterial({
    color: BENCH_COLOR,
    roughness: 0.85,
    metalness: 0.05,
  });
  const bench = new THREE.Mesh(geometry, material);
  bench.rotation.x = -Math.PI / 2;
  // Slightly below the dish floor (which sits at y=0) to avoid z-fighting where they overlap.
  bench.position.y = -0.5;
  bench.name = "lab-bench";
  return bench;
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
