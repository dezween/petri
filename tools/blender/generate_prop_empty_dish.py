"""Generate the empty-petri-dish decorative prop: a small shallow dish with a glassy rim,
scaled-down echo of the main arena's own floor+rim, used as static background scene dressing
(Epic 2, task 011)."""
import sys
import math
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    # Shallow disc base -- a squashed cylinder reads as a dish without needing a separate rim
    # torus to be watertight; low segment count keeps it cheap since it's static background decor.
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.4, depth=0.08, location=(0, 0.04, 0),
    )
    base = bpy.context.active_object
    base.name = "PropEmptyDish_Base"
    base_mat = make_material("PropEmptyDishBaseMat", (0.82, 0.87, 0.85), alpha=1.0, roughness=0.5)
    base.data.materials.append(base_mat)

    # Thin rim ring sitting on the base's edge, same idea as the main arena's glass-tinted rim.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.4, minor_radius=0.045, major_segments=24, minor_segments=8,
        location=(0, 0.04, 0), rotation=(math.radians(90), 0, 0),
    )
    rim = bpy.context.active_object
    rim.name = "PropEmptyDish_Rim"
    rim_mat = make_material("PropEmptyDishRimMat", (0.67, 0.83, 0.80), alpha=0.55, roughness=0.25)
    rim.data.materials.append(rim_mat)

    bpy.ops.object.select_all(action='DESELECT')
    base.select_set(True)
    rim.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    base.name = "PropEmptyDish_Body"

    out_path = str(models_output_dir() / "prop_empty_dish.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
