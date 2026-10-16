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
 * extreme case. Re-derived for the 10-arena-size follow-up — the largest size is now 3250
 * (`ARENA_SIZES` in `src/ui/adapter/dom/menu.adapter.ts`), not the original fixed Large (2000):
 * a 1625-radius player roam area combined with the camera's maximum zoom-out (player radius at
 * the victory cap: 3250 * 0.375 ≈ 1219) and a generously wide aspect ratio
 * (ultrawide/multi-monitor, assumed up to ~3:1). Worked out from `camera.ts`'s
 * `adjustZoomForPlayerRadius`: halfHeight at that player radius is 600 + 1219 * (2.2/4) ≈ 1270,
 * so halfWidth at aspect 3 ≈ 3811. The camera can additionally be up to 1625 units off-origin
 * (the player's own roam radius), so the farthest point the frustum could need covered from
 * world origin is on the order of 1625 + sqrt(1270² + 3811²) ≈ 5642. 7000 leaves comfortable
 * headroom beyond that worst case (the original 6000 would have left only ~360 units of
 * margin at this new maximum, tighter than this constant's original intent).
 */
const BENCH_RADIUS = 7000;

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
    // Fully matte (roughness=1, metalness=0): task 016's Playwright playtest found that the
    // original roughness=0.85/metalness=0.05 values put a visible specular highlight on this
    // huge flat disc under the scene's DirectionalLight — a classic "specular ring" artifact on
    // large flat ground planes, made worse by this geometry's coarse 48-segment triangulation
    // (faceting the ring into a visible polygon) and further amplified by task 014's bloom pass
    // (specular highlights are bright, easily crossing BLOOM_THRESHOLD). A true matte lab-bench
    // surface shouldn't show a specular highlight at all, so eliminating it at the material
    // level is the correct fix, not just a band-aid for this one light's angle.
    roughness: 1,
    metalness: 0,
  });
  const bench = new THREE.Mesh(geometry, material);
  bench.rotation.x = -Math.PI / 2;
  // Slightly below the dish floor (which sits at y=0) to avoid z-fighting where they overlap.
  bench.position.y = -0.5;
  bench.name = "lab-bench";
  // Epic 3, task 002: receives shadows cast by entities/props (task 003); nothing shadows onto
  // it from below, so it's not a caster — see docs/epic-3/SPEC.md's Design Decision 2.
  bench.receiveShadow = true;
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
  // Epic 3, task 002: receives shadows cast by entities/props (task 003) — not a caster, see
  // buildLabBench's identical comment / SPEC.md's Design Decision 2.
  floor.receiveShadow = true;

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
  // Epic 3, task 002: receives shadows — not a caster, see buildLabBench's identical comment.
  rim.receiveShadow = true;

  return { floor, rim };
}
