import * as THREE from "three";
import type { IRenderer } from "@/render/port/renderer.port";
import type { WorldSnapshot } from "@/world/service/world.service";
import { DEFAULT_ARENA_WIDTH } from "@/world/service/world.service";
import { createScene } from "./scene";
import { addLighting } from "./lighting";
import { adjustZoomForPlayerRadius, createCamera, updateCameraAspect, updateCameraPosition } from "./camera";
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
    updateCameraAspect(this.camera, safeAspect(container.clientWidth, container.clientHeight));
    container.appendChild(this.renderer.domElement);

    loadAllModels()
      .then((models) => {
        // `models` may be a partial cache (see loadAllModels's doc comment) — CellMeshFactory
        // tolerates missing entries, degrading only the entity type(s) whose model failed
        // rather than rendering nothing at all.
        this.meshFactory = new CellMeshFactory(models);
        this.scene.add(this.meshFactory.group);
      })
      .catch((err: unknown) => {
        // loadAllModels itself no longer rejects for per-model load failures (those degrade
        // gracefully — see its doc comment); this only catches genuinely unexpected errors
        // (e.g. constructing GLTFLoader itself failing). Rendering still works without entity
        // meshes (arena/lighting stay visible). Logged, not thrown, since init() has no
        // promise for a caller to await yet (task 017 decides how session/UI sequences startup).
        console.error("ThreeRenderer: failed to load models", err);
      });
  }

  render(snapshot: WorldSnapshot): void {
    if (!this.renderer) return;
    this.meshFactory?.updateFromSnapshot(snapshot);
    adjustZoomForPlayerRadius(this.camera, snapshot.player.radius);
    updateCameraPosition(this.camera, snapshot.player.position);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(width, height);
    updateCameraAspect(this.camera, safeAspect(width, height));
  }

  /**
   * Intentionally unreachable in the current wiring (this app never tears down its one
   * long-lived instance) — kept alive by this class's own tests only, until the app gains a
   * real teardown path (HMR support, embeddable widget use case, etc.). Not dead code to
   * delete; a future lint/dead-code pass just won't have call-site context for it yet.
   */
  dispose(): void {
    if (this.meshFactory) {
      // Remove before disposing: avoids any chance of the group's children still being
      // referenced by the scene's render graph while their GPU resources are being freed.
      this.scene.remove(this.meshFactory.group);
      this.meshFactory.dispose();
      this.meshFactory = undefined;
    }
    // createScene() (constructor) allocates the static floor/rim geometry+materials, which
    // THREE.WebGLRenderer.dispose() does NOT free for you — it only disposes renderer-internal
    // state (render lists, program cache, etc.), never the scene graph's own GPU resources.
    for (const name of ["arena-floor", "arena-rim"]) {
      const obj = this.scene.getObjectByName(name);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    }
    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
    this.renderer = undefined;
    this.container = undefined;
  }
}

/** Guards against Infinity/NaN propagating into the camera's projection matrix when a
 * container momentarily has zero height (display:none, not yet laid out, mid-reflow). */
function safeAspect(width: number, height: number): number {
  return height > 0 ? width / height : 1;
}
