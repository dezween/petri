import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Epic 2, task 013's "blur the background, keep the dish sharp" effect is NOT implemented with
 * a real depth-of-field/bokeh pass, deliberately. A camera-depth-based DOF pass (Three.js's
 * bundled `BokehPass`) blurs by distance *along the camera's view axis*. This scene's camera
 * (`camera.ts`) is a top-down orthographic camera looking straight down a fixed height — the
 * dish floor, the bench, every prop, and every entity all sit at (or extremely near) y=0, so
 * they're all at essentially the *same* camera-space depth. A real DOF pass would have nothing
 * to key off here; it could not distinguish "dish" from "background" because depth doesn't
 * vary between them in this layout. This is exactly the scenario task 013's own doc anticipated
 * ("if a real DOF pass proves too expensive or fiddly to tune well for this scene's geometry, a
 * cheaper faked approach ... is an acceptable substitute").
 *
 * The substitute: a radial blur keyed on distance from the center of the screen, not distance
 * from the camera. This works for this specific camera setup because `camera.ts`'s
 * `updateCameraPosition` keeps the camera centered on the player, and the player is always
 * within the dish — so "near the center of the screen" and "inside/near the dish" are
 * correlated in practice, while the bench/props (task 010-012) sit further out, near the
 * screen's periphery. It's a cheap single-pass box blur, not a true Gaussian/bokeh, chosen for
 * simplicity and performance (task 013's acceptance criteria explicitly deprioritizes visual
 * perfection in favor of "no measurable frame-time regression").
 */
export const RadialBlurShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    // NDC-ish distance-from-center (0 = screen center, ~1.0-1.4 = corners) at which the blur
    // begins ramping in / reaches its maximum. Tuned so the dish (which fills roughly the
    // central half of the view at typical zoom) stays sharp, and the bench/props beyond it
    // soften — exact values are a judgment call, re-tuned for real in task 016's playtest.
    innerRadius: { value: 0.42 },
    outerRadius: { value: 0.9 },
    // Max blur kernel radius in screen pixels at/beyond outerRadius.
    maxBlurPx: { value: 6.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float innerRadius;
    uniform float outerRadius;
    uniform float maxBlurPx;
    varying vec2 vUv;

    void main() {
      vec2 aspectCorrected = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      float dist = length(aspectCorrected);
      float t = smoothstep(innerRadius, outerRadius, dist);

      if (t <= 0.0) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      float blurPx = t * maxBlurPx;
      vec2 texel = blurPx / resolution;

      vec4 sum = vec4(0.0);
      sum += texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 0.0, -1.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 1.0, -1.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2(-1.0,  0.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 0.0,  0.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 1.0,  0.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2(-1.0,  1.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 0.0,  1.0));
      sum += texture2D(tDiffuse, vUv + texel * vec2( 1.0,  1.0));
      gl_FragColor = sum / 9.0;
    }
  `,
};

/**
 * Wraps an `EffectComposer` pipeline: base scene render -> radial background blur (013) ->
 * screen. Shared infrastructure for task 014 (bloom), which will add a pass to this same
 * composer rather than standing up a second, competing pipeline.
 */
export class PostProcessingPipeline {
  private readonly composer: EffectComposer;
  private readonly radialBlurPass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.radialBlurPass = new ShaderPass(RadialBlurShader);
    this.radialBlurPass.uniforms.resolution.value.set(width, height);
    this.composer.addPass(this.radialBlurPass);
  }

  render(): void {
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.radialBlurPass.uniforms.resolution.value.set(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
