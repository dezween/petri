import * as THREE from "three";

/**
 * Simple ambient + directional rig — enough to read the translucent/shaded materials from
 * the Blender models without per-object custom lighting.
 */
export function addLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(100, 300, 150);
  scene.add(directional);
}
