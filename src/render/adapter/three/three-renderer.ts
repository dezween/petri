import * as THREE from "three";
import type { IRenderer } from "@/render/port/renderer.port";
import type { WorldSnapshot } from "@/world/service/world.service";
import { DEFAULT_ARENA_WIDTH } from "@/world/service/world.service";
import { createScene } from "./scene";
import { addLighting } from "./lighting";
import { adjustZoomForPlayerRadius, createCamera, updateCameraAspect } from "./camera";

/**
 * `IRenderer` implementation backed by Three.js. Built up incrementally: this stage (012)
 * wires the static scene/camera/lighting and a working init/render/resize/dispose lifecycle
 * with an empty arena (no entities yet — model loading and mesh sync land in 013-015).
 */
export class ThreeRenderer implements IRenderer {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private renderer?: THREE.WebGLRenderer;
  private container?: HTMLElement;

  constructor(arenaWidth: number = DEFAULT_ARENA_WIDTH) {
    this.scene = createScene(arenaWidth);
    addLighting(this.scene);
    this.camera = createCamera(1);
  }

  init(container: HTMLElement): void {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    updateCameraAspect(this.camera, container.clientWidth / container.clientHeight);
    container.appendChild(this.renderer.domElement);
  }

  render(snapshot: WorldSnapshot): void {
    if (!this.renderer) return;
    adjustZoomForPlayerRadius(this.camera, snapshot.player.radius);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(width, height);
    updateCameraAspect(this.camera, width / height);
  }

  dispose(): void {
    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
    this.renderer = undefined;
    this.container = undefined;
  }
}
