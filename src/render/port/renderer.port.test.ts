import { describe, expect, it } from "vitest";
import type { IRenderer } from "./renderer.port";
import type { WorldSnapshot } from "@/world/service/world.service";
import type { Vector2 } from "@/world/domain/geometry";

/** Proves the interface is implementable by a trivial no-op (per 011's acceptance criteria). */
class NoOpRenderer implements IRenderer {
  initCalls = 0;
  renderCalls = 0;
  setArenaWidthCalls = 0;
  spawnEatBurstCalls = 0;

  init(_container: HTMLElement): void {
    this.initCalls++;
  }

  render(_snapshot: WorldSnapshot, _deltaTime: number): void {
    this.renderCalls++;
  }

  spawnEatBurst(_position: Vector2, _color: number): void {
    this.spawnEatBurstCalls++;
  }

  resize(_width: number, _height: number): void {}

  setArenaWidth(_width: number): void {
    this.setArenaWidthCalls++;
  }

  dispose(): void {}
}

describe("IRenderer", () => {
  it("is implementable by a no-op mock with no WebGL context", () => {
    const renderer = new NoOpRenderer();
    const fakeSnapshot: WorldSnapshot = {
      player: { id: "p1", position: { x: 0, z: 0 }, radius: 10, mass: 25 },
      bots: [],
      food: [],
      arenaWidth: 1000,
    };

    renderer.init({} as HTMLElement);
    renderer.render(fakeSnapshot, 1 / 60);
    renderer.spawnEatBurst({ x: 0, z: 0 }, 0xffffff);
    renderer.resize(800, 600);
    renderer.setArenaWidth(1500);
    renderer.dispose();

    expect(renderer.initCalls).toBe(1);
    expect(renderer.renderCalls).toBe(1);
    expect(renderer.spawnEatBurstCalls).toBe(1);
    expect(renderer.setArenaWidthCalls).toBe(1);
  });
});
