"""Generate the player cell model: translucent membrane sphere + solid nucleus core."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    # Outer membrane: translucent sphere
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, 0))
    membrane = bpy.context.active_object
    membrane.name = "PlayerCell_Membrane"
    membrane_mat = make_material("MembraneMat", (0.35, 0.75, 0.95), alpha=0.45, roughness=0.25)
    membrane.data.materials.append(membrane_mat)

    # Inner nucleus: smaller solid sphere
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.45, location=(0, 0, 0))
    nucleus = bpy.context.active_object
    nucleus.name = "PlayerCell_Nucleus"
    nucleus_mat = make_material("NucleusMat", (0.85, 0.95, 1.0), alpha=1.0, roughness=0.3)
    nucleus.data.materials.append(nucleus_mat)

    out_path = str(models_output_dir() / "player_cell.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
