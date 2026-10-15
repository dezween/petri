export interface Vector2 {
  x: number;
  z: number;
}

export interface Circle {
  position: Vector2;
  radius: number;
}

export function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Two circles overlap when the distance between centers is less than the sum of their radii. */
export function isOverlapping(a: Circle, b: Circle): boolean {
  return distance(a.position, b.position) < a.radius + b.radius;
}

/**
 * Uniform random point within a disk of the given radius, centered at the origin. The
 * arena is circular (see world.service.ts's radial clamp), so spawners sample from here
 * rather than a bounding square — otherwise entities could land in a square "corner"
 * that's outside the visible circular floor. `Math.sqrt(rng())` on the radial component
 * is what makes the distribution uniform by area; a plain `rng() * maxRadius` would
 * cluster points toward the center instead.
 */
export function randomPointInDisk(rng: () => number, maxRadius: number): Vector2 {
  const r = maxRadius * Math.sqrt(rng());
  const theta = rng() * 2 * Math.PI;
  return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}
