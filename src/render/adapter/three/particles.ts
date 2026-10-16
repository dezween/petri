import * as THREE from "three";
import type { Vector2 } from "@/world/domain/geometry";

/** How many particles one `burst()` call spawns. */
const PARTICLES_PER_BURST = 8;
/** How long a single particle lives before it's recycled, in seconds. */
const LIFETIME_SECONDS = 0.4;
/** Outward speed range (world units/sec) — randomized per-particle within this band so a
 * burst reads as a little scatter rather than a perfect ring. */
const MIN_SPEED = 60;
const MAX_SPEED = 140;
/** Upper bound on particles alive at once, across every in-flight burst combined. Eating is
 * frequent (potentially several times a second during active play), so this exists to keep a
 * hard ceiling on the geometry buffer size rather than growing it per-burst — a burst that
 * would exceed the remaining budget is silently truncated (fewer particles that burst), never
 * dropped as a whole, so eating still always visibly reads as "something happened". */
const MAX_PARTICLES = 240;

const CENTER_COLOR = new THREE.Color();

interface ActiveParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  r: number;
  g: number;
  b: number;
}

/**
 * A small, cheap burst-particle effect for "something just got eaten" — one `THREE.Points`
 * cloud shared across every burst (not one object per particle, not one system per burst), so
 * the draw-call cost stays constant regardless of how often eating happens. Particles live in
 * a dense array rebuilt into the position/color buffers each `update()`; dead ones are
 * filtered out (not left as disabled holes), so the buffer's `drawRange` always exactly covers
 * the live count with no per-vertex visibility flag needed.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private particles: ActiveParticle[] = [];

  constructor(private readonly capacity: number = MAX_PARTICLES) {
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    // Positions span arbitrary world-space locations and are rewritten every frame — a
    // bounding-sphere-based frustum cull computed from a stale/empty buffer would just as
    // likely hide a visible burst as cull an offscreen one, so skip that check entirely.
    this.points.frustumCulled = false;
  }

  /** Spawns a burst of particles at `position`, tinted `color` (a `0xRRGGBB` hex integer, the
   * same format `THREE.Color` accepts everywhere else in this codebase). Never throws — if the
   * pool is already at capacity, spawns as many as the remaining budget allows (down to zero),
   * rather than growing the buffer or dropping the whole burst. */
  burst(position: Vector2, color: number): void {
    const budget = Math.min(PARTICLES_PER_BURST, this.capacity - this.particles.length);
    if (budget <= 0) return;

    CENTER_COLOR.set(color);
    for (let i = 0; i < budget; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      this.particles.push({
        x: position.x,
        y: 0,
        z: position.z,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        // Mild upward drift, never downward — reads as a little "pop" rather than debris
        // falling, matching the petri-dish theme's gentle/organic tone.
        vy: Math.random() * speed * 0.4,
        age: 0,
        r: CENTER_COLOR.r,
        g: CENTER_COLOR.g,
        b: CENTER_COLOR.b,
      });
    }
  }

  /** Advances every live particle by `deltaTime` seconds, ages out (recycles) any past their
   * lifetime, and rewrites the GPU-bound buffers to match. Call once per frame, regardless of
   * whether any `burst()` happened that frame — this is what actually makes bursts fade. */
  update(deltaTime: number): void {
    if (this.particles.length > 0) {
      this.particles = this.particles.filter((p) => {
        p.age += deltaTime;
        if (p.age >= LIFETIME_SECONDS) return false;
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.z += p.vz * deltaTime;
        return true;
      });
    }

    const count = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const base = i * 3;
      this.positions[base] = p.x;
      this.positions[base + 1] = p.y;
      this.positions[base + 2] = p.z;
      // Fade toward transparent-black as a particle ages — vertexColors has no separate alpha
      // channel on THREE.PointsMaterial without a custom shader, so darkening toward the
      // material's opaque-black fallback is the cheap approximation used here instead.
      const fade = 1 - p.age / LIFETIME_SECONDS;
      this.colors[base] = p.r * fade;
      this.colors[base + 1] = p.g * fade;
      this.colors[base + 2] = p.b * fade;
    }

    this.geometry.setDrawRange(0, count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  /** Number of particles currently alive, across every in-flight burst. Exposed for tests
   * (acceptance criteria: repeated bursts don't grow this unboundedly once `update()` has had
   * time to age them out) — not used by any runtime caller. */
  get activeCount(): number {
    return this.particles.length;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
