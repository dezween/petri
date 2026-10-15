import * as THREE from "three";
import type { IRenderer } from "@/render/port/renderer.port";
import type { WorldSnapshot } from "@/world/service/world.service";
import { DEFAULT_ARENA_WIDTH } from "@/world/service/world.service";
import { createScene } from "./scene";
import { addLighting } from "./lighting";
import { adjustZoomForPlayerRadius, createCamera, updateCameraAspect } from "./camera";
import { loadAllModels } from "./model-loader";
import { CellMeshFactory } from "./cell-mesh-factory";

/**
 * `IRenderer` implementation backed by Three.js — the only place in this codebase that
 * imports `three`. `init()` kicks off model loading in the background; until it resolves,
 * `render()` still runs (camera/arena/lighting are already live), it just has no entity
 * meshes to update yet, matching 012's "empty scene" behavior rather than blocking startup.
 */
export class ThreeRenderer implements IRenderer {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private renderer?: THREE.WebGLRenderer;
  private container?: HTMLElement;
  private meshFactory?: CellMeshFactory;

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

    loadAllModels()
      .then((models) => {
        this.meshFactory = new CellMeshFactory(models);
        this.scene.add(this.meshFactory.group);
      })
      .catch((err: unknown) => {
        // Rendering still works without entity meshes (arena/lighting stay visible); this
        // just means entities never appear. Logged, not thrown, since init() has no promise
        // for a caller to await yet (task 017 decides how session/UI sequences startup).
        console.error("ThreeRenderer: failed to load models", err);
      });
  }

  render(snapshot: WorldSnapshot): void {
    if (!this.renderer) return;
    this.meshFactory?.updateFromSnapshot(snapshot);
    adjustZoomForPlayerRadius(this.camera, snapshot.player.radius);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(width, height);
    updateCameraAspect(this.camera, width / height);
  }

  dispose(): void {
    this.meshFactory?.dispose();
    this.meshFactory = undefined;
    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
    this.renderer = undefined;
    this.container = undefined;
  }
}
