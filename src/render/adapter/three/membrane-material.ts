import * as THREE from "three";

/**
 * Must match the Blender-authored material name in `tools/blender/generate_player_cell.py`'s
 * `make_material("MembraneMat", ...)` call — glTF's exporter writes that string as the
 * material's name in the exported file, and `GLTFLoader` sets `Material.name` from it on import,
 * so matching by name (not array/traversal position) survives the membrane/nucleus mesh order
 * changing in the Blender script without silently applying this to the wrong mesh.
 */
const MEMBRANE_MATERIAL_NAME = "MembraneMat";

/**
 * Epic 3, task 005 — SPEC.md's primary plan was `MeshPhysicalMaterial.transmission`; this
 * codebase's `WebGLRenderer` has no `scene.environment`/envMap (only a flat `scene.background`
 * color — see `scene.ts`), and real-browser verification during this task showed the result:
 * `transmission` without environment lighting to refract/reflect rendered the membrane as a
 * flat, fully opaque sphere — worse than before, since it also hid the nucleus that used to
 * show through the old plain alpha-blended material. That's SPEC.md's documented fallback
 * trigger ("if it doesn't look acceptable after real testing"), so this uses the fallback: a
 * custom `onBeforeCompile` fresnel rim-light injected into the original `MeshStandardMaterial`
 * (keeping its alpha-blend translucency intact, restoring the nucleus visibility), rather than
 * a full material swap to `MeshPhysicalMaterial`.
 */
const FRESNEL_COLOR = new THREE.Color(0.75, 0.92, 1.0);
const FRESNEL_POWER = 2.5;
const FRESNEL_INTENSITY = 0.6;

// Confirmed (not retuned) in task 006's playtest: a real close-up screenshot of a fresh player
// cell shows a clear bright rim at grazing angles with the nucleus still visible through the
// membrane — reads as glass/liquid rather than a flat disc or an obvious shader artifact.

/**
 * Finds the player cell's translucent membrane mesh inside its (possibly multi-primitive, see
 * `cell-mesh-factory.ts`'s `buildStaticObject`) loaded model and injects a fresnel rim-light
 * into its existing material via `onBeforeCompile`, so it reads as brighter/more reflective at
 * grazing viewing angles (a glass/liquid cue) instead of a flat alpha-blended disc — without
 * replacing the material or its alpha-blend transparency, which the nucleus mesh sitting just
 * inside it depends on staying visible through.
 *
 * No-op for any mesh whose material isn't named `MembraneMat` — this includes the player's own
 * nucleus mesh (deliberately untouched, per task 005's acceptance criteria) and every static
 * prop that also goes through `buildStaticObject` (none of which have a membrane material at
 * all), so this function is safe to call unconditionally without the caller needing to know
 * which object is actually the player.
 */
export function applyMembraneMaterial(playerObject: THREE.Object3D): void {
  playerObject.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material;
    if (Array.isArray(material) || material.name !== MEMBRANE_MATERIAL_NAME) return;

    const standard = material as THREE.MeshStandardMaterial;
    standard.onBeforeCompile = (shader) => {
      shader.uniforms.fresnelColor = { value: FRESNEL_COLOR };
      shader.uniforms.fresnelPower = { value: FRESNEL_POWER };
      shader.uniforms.fresnelIntensity = { value: FRESNEL_INTENSITY };

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
         varying vec3 vFresnelNormal;
         varying vec3 vFresnelViewDir;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vFresnelNormal = normalize(normalMatrix * normal);
         vFresnelViewDir = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
         varying vec3 vFresnelNormal;
         varying vec3 vFresnelViewDir;
         uniform vec3 fresnelColor;
         uniform float fresnelPower;
         uniform float fresnelIntensity;`,
      );
      // Injected right before dithering (the shader's last stage) so the rim-light additively
      // brightens the fully-lit-and-blended color rather than competing with lighting/alpha
      // computed earlier in the chain.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `float fresnelTerm = pow(1.0 - max(dot(normalize(vFresnelNormal), normalize(vFresnelViewDir)), 0.0), fresnelPower);
         gl_FragColor.rgb += fresnelColor * fresnelTerm * fresnelIntensity;
         #include <dithering_fragment>`,
      );
    };
    // Forces a shader recompile with the injected code above — without this, a material that
    // already compiled once (e.g. from an earlier frame) would keep using its cached program.
    standard.needsUpdate = true;
  });
}
