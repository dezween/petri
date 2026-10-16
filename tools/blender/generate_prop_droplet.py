"""Generate the agar-droplet decorative prop: a small translucent teardrop -- static background
scene dressing (Epic 2, task 011)."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    # Rounded body -- a slightly flattened icosphere reads as a settled droplet of liquid
    # rather than a perfect ball.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.22, location=(0, 0.18, 0))
    body = bpy.context.active_object
    body.name = "PropDroplet_Body"
    body.scale = (1.0, 0.85, 1.0)

    # Small cone on top gives the classic teardrop point.
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.09, radius2=0.0, depth=0.18, location=(0, 0.42, 0))
    point = bpy.context.active_object
    point.name = "PropDroplet_Point"

    mat = make_material("PropDropletMat", (0.88, 0.72, 0.28), alpha=0.55, roughness=0.1)
    body.data.materials.append(mat)
    point.data.materials.append(mat)

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    point.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "PropDroplet_Shape"

    out_path = str(models_output_dir() / "prop_droplet.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
