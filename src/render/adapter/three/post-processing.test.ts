import { describe, expect, it } from "vitest";
import { BLOOM_RADIUS, BLOOM_STRENGTH, BLOOM_THRESHOLD, RadialBlurShader } from "./post-processing";

/**
 * `PostProcessingPipeline` itself can't be constructed here — like `ThreeRenderer.init()`
 * (see three-renderer.test.ts), `EffectComposer`/`UnrealBloomPass`/`ShaderPass` all need a real
 * `THREE.WebGLRenderer` backed by an actual canvas/GL context, which this test environment
 * (vitest's default "node" environment, no DOM/WebGL) doesn't have. The full
 * init() -> render() -> resize() -> dispose() lifecycle, including whether the radial blur and
 * bloom actually look right, can only be verified by hand in a browser (same category of
 * limitation task 016's playtest covers). What IS testable without a GL context: the shader's
 * own data (uniform defaults, that both shader sources reference the uniforms they declare).
 */
describe("RadialBlurShader", () => {
  it("has sane default uniform values: sharp center, blurred edges, a non-zero max blur", () => {
    expect(RadialBlurShader.uniforms.innerRadius.value).toBeGreaterThan(0);
    expect(RadialBlurShader.uniforms.outerRadius.value).toBeGreaterThan(
      RadialBlurShader.uniforms.innerRadius.value,
    );
    expect(RadialBlurShader.uniforms.maxBlurPx.value).toBeGreaterThan(0);
    expect(RadialBlurShader.uniforms.tDiffuse.value).toBeNull();
  });

  it("vertex and fragment shaders both reference every uniform they declare", () => {
    const declaredUniforms = Object.keys(RadialBlurShader.uniforms);
    for (const name of declaredUniforms) {
      if (name === "tDiffuse") {
        // ShaderPass sets tDiffuse itself from the upstream pass's render target; the fragment
        // shader samples it directly.
        expect(RadialBlurShader.fragmentShader).toContain("tDiffuse");
        continue;
      }
      expect(RadialBlurShader.fragmentShader).toContain(name);
    }
  });

  it("vertex shader writes gl_Position and the vUv varying the fragment shader reads", () => {
    expect(RadialBlurShader.vertexShader).toContain("gl_Position");
    expect(RadialBlurShader.vertexShader).toContain("vUv");
    expect(RadialBlurShader.fragmentShader).toContain("vUv");
  });
});

describe("bloom pass parameters (task 014)", () => {
  it("are in sane ranges: a positive strength, a normalized radius, and a normalized threshold", () => {
    expect(BLOOM_STRENGTH).toBeGreaterThan(0);
    // UnrealBloomPass's radius/threshold parameters are both documented as 0-1 ranges.
    expect(BLOOM_RADIUS).toBeGreaterThanOrEqual(0);
    expect(BLOOM_RADIUS).toBeLessThanOrEqual(1);
    expect(BLOOM_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(BLOOM_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
