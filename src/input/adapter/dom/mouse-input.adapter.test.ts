import { describe, expect, it, vi } from "vitest";
import { computeDirectionFromPointer, MouseInputAdapter } from "./mouse-input.adapter";

describe("computeDirectionFromPointer", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };

  it("returns the zero vector when the cursor is exactly at the center", () => {
    expect(computeDirectionFromPointer(100, 50, rect)).toEqual({ x: 0, z: 0 });
  });

  it("normalizes a diagonal offset to unit length", () => {
    const direction = computeDirectionFromPointer(200, 150, rect); // offset (100, 100) from center
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1, 10);
    expect(direction.x).toBeCloseTo(direction.z, 10);
  });

  it("maps screen-right to world -x and screen-down to world -z (verified against the tilted camera's real THREE.js basis vectors — see this function's doc comment)", () => {
    const right = computeDirectionFromPointer(300, 50, rect); // straight right of center
    expect(right.x).toBeCloseTo(-1, 10);
    expect(right.z).toBeCloseTo(0, 10);

    const down = computeDirectionFromPointer(100, 150, rect); // straight below center
    expect(down.x).toBeCloseTo(0, 10);
    expect(down.z).toBeCloseTo(-1, 10);
  });
});

/** Minimal duck-typed stand-in for HTMLElement — no jsdom in this project's vitest setup. */
function createFakeContainer() {
  const listeners = new Map<string, (event: PointerEvent) => void>();
  return {
    addEventListener: vi.fn((type: string, handler: (event: PointerEvent) => void) => {
      listeners.set(type, handler);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 200, height: 100 })),
    fire(type: string, event: Partial<PointerEvent>) {
      listeners.get(type)?.(event as PointerEvent);
    },
  };
}

describe("MouseInputAdapter", () => {
  it("defaults to a zero direction before any pointer movement", () => {
    const container = createFakeContainer();
    const adapter = new MouseInputAdapter(container as unknown as HTMLElement);
    expect(adapter.getDirection()).toEqual({ x: 0, z: 0 });
  });

  it("registers exactly one listener, for pointermove — no mouse/touch/keyboard listeners", () => {
    const container = createFakeContainer();
    new MouseInputAdapter(container as unknown as HTMLElement);
    expect(container.addEventListener).toHaveBeenCalledTimes(1);
    expect(container.addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });

  it("updates the direction on pointermove, relative to the container's center", () => {
    const container = createFakeContainer();
    const adapter = new MouseInputAdapter(container as unknown as HTMLElement);

    container.fire("pointermove", { clientX: 200, clientY: 50 });

    const direction = adapter.getDirection();
    expect(direction.x).toBeCloseTo(-1, 10);
    expect(direction.z).toBeCloseTo(0, 10);
  });

  it("dispose() removes the pointermove listener", () => {
    const container = createFakeContainer();
    const adapter = new MouseInputAdapter(container as unknown as HTMLElement);

    adapter.dispose();

    expect(container.removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });
});
