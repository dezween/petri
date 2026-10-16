import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyMembraneMaterial } from "./membrane-material";

function namedStandardMesh(materialName: string, color = 0x5abaf2): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45 });
  material.name = materialName;
  return new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), material);
}

/** Minimal fake of the `shader` object Three.js passes into `onBeforeCompile` — enough surface
 * for the fresnel injection to run its string replacements and set its uniforms against, without
 * needing a real WebGL shader compiler. Every chunk this module's injection targets must be
 * present or its `.replace()` calls silently no-op (that would be a false pass), so this
 * includes all four of them. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: "#include <common>\nvoid main() {\n#include <begin_vertex>\n}",
    fragmentShader: "#include <common>\nvoid main() {\n#include <dithering_fragment>\n}",
  };
}

/** Every material has a no-op `onBeforeCompile` by default (Three.js base class behavior), so
 * merely checking it's "a function" can't distinguish "untouched" from "fresnel-injected" — this
 * actually invokes it against a fake shader and checks the injection's own uniform landed. */
function wasFresnelInjected(material: THREE.MeshStandardMaterial): boolean {
  const shader = fakeShader();
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as never);
  return "fresnelColor" in shader.uniforms;
}

describe("applyMembraneMaterial", () => {
  it("injects a fresnel onBeforeCompile hook into the mesh named MembraneMat", () => {
    const membrane = namedStandardMesh("MembraneMat");
    const group = new THREE.Group();
    group.add(membrane);

    applyMembraneMaterial(group);

    const shader = fakeShader();
    (membrane.material as THREE.MeshStandardMaterial).onBeforeCompile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as never,
    );
    expect(shader.uniforms.fresnelColor?.value).toBeInstanceOf(THREE.Color);
    expect(shader.uniforms.fresnelPower?.value).toBeGreaterThan(0);
    expect(shader.fragmentShader).toContain("fresnelTerm");
    expect(shader.vertexShader).toContain("vFresnelNormal");
  });

  it("keeps the membrane's material instance and its alpha-blend transparency intact (the nucleus depends on it staying translucent)", () => {
    const membrane = namedStandardMesh("MembraneMat");
    const originalMaterial = membrane.material;

    applyMembraneMaterial(membrane);

    // Same material instance, not swapped for a different one — this is an in-place
    // onBeforeCompile injection, not a material replacement.
    expect(membrane.material).toBe(originalMaterial);
    const material = membrane.material as THREE.MeshStandardMaterial;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.45, 2);
  });

  it("leaves the nucleus (or any other non-membrane mesh) untouched", () => {
    const membrane = namedStandardMesh("MembraneMat");
    const nucleus = namedStandardMesh("NucleusMat");
    const group = new THREE.Group();
    group.add(membrane, nucleus);

    applyMembraneMaterial(group);

    expect(wasFresnelInjected(nucleus.material as THREE.MeshStandardMaterial)).toBe(false);
  });

  it("is a safe no-op on an object with no MembraneMat mesh (e.g. a static prop)", () => {
    const prop = namedStandardMesh("PropMat");

    expect(() => applyMembraneMaterial(prop)).not.toThrow();
    expect(wasFresnelInjected(prop.material as THREE.MeshStandardMaterial)).toBe(false);
  });
});
