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
