"""Generate the hunter bot model: elongated bacillus rod shape."""
import sys
import math
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    # Central cylinder body (rod)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.5, depth=1.2, location=(0, 0, 0),
        rotation=(math.radians(90), 0, 0),
    )
    cylinder = bpy.context.active_object
    cylinder.name = "BotHunter_Rod"

    # Rounded caps at each end
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, 0.6, 0))
    cap1 = bpy.context.active_object
    cap1.name = "BotHunter_CapFront"

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, -0.6, 0))
    cap2 = bpy.context.active_object
    cap2.name = "BotHunter_CapBack"

    mat = make_material("HunterMat", (0.85, 0.25, 0.15), alpha=1.0, roughness=0.45)
    for obj in (cylinder, cap1, cap2):
        obj.data.materials.append(mat)

    # Join into a single mesh
    bpy.ops.object.select_all(action='DESELECT')
    cylinder.select_set(True)
    cap1.select_set(True)
    cap2.select_set(True)
    bpy.context.view_layer.objects.active = cylinder
    bpy.ops.object.join()
    cylinder.name = "BotHunter_Body"

    out_path = str(models_output_dir() / "bot_hunter.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
