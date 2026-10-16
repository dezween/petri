"""Generate the pipette decorative prop: a glass-like shaft, a tapered tip, and a rubber bulb
-- static background scene dressing (Epic 2, task 011)."""
import sys
import math
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    # Main glass shaft, lying on its side (rotated like the hunter bot's rod).
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10, radius=0.09, depth=1.6, location=(0, 0, 0.3),
        rotation=(math.radians(90), 0, 0),
    )
    shaft = bpy.context.active_object
    shaft.name = "PropPipette_Shaft"

    # Tapered glass tip -- a cone narrowing to a point.
    bpy.ops.mesh.primitive_cone_add(
        vertices=10, radius1=0.09, radius2=0.01, depth=0.35, location=(0, 0, -0.675),
        rotation=(math.radians(90), 0, 0),
    )
    tip = bpy.context.active_object
    tip.name = "PropPipette_Tip"

    glass_mat = make_material("PropPipetteGlassMat", (0.85, 0.9, 0.9), alpha=0.6, roughness=0.15)
    shaft.data.materials.append(glass_mat)
    tip.data.materials.append(glass_mat)

    # Rubber bulb at the opposite end.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.17, location=(0, 0, 1.25))
    bulb = bpy.context.active_object
    bulb.name = "PropPipette_Bulb"
    bulb_mat = make_material("PropPipetteBulbMat", (0.55, 0.2, 0.22), alpha=1.0, roughness=0.6)
    bulb.data.materials.append(bulb_mat)

    bpy.ops.object.select_all(action='DESELECT')
    shaft.select_set(True)
    tip.select_set(True)
    bulb.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    shaft.name = "PropPipette_Body"

    out_path = str(models_output_dir() / "prop_pipette.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
