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

    # Join into a single mesh (mirroring generate_bot_hunter.py/generate_bot_fleer.py) — each
    # source object keeps its own material slot across the join, so the translucent-membrane +
    # solid-nucleus two-tone look survives in the exported glTF as one mesh with two material
    # slots. Without this, the exported model has two sibling mesh nodes and
    # cell-mesh-factory.ts's extractMesh() (which only keeps the first Mesh found) would
    # silently drop one of them.
    bpy.ops.object.select_all(action='DESELECT')
    membrane.select_set(True)
    nucleus.select_set(True)
    bpy.context.view_layer.objects.active = membrane
    bpy.ops.object.join()
    membrane.name = "PlayerCell_Full"

    out_path = str(models_output_dir() / "player_cell.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
