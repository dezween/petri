"""Generate the food model: tiny bright coccus particle, lowest poly of all models."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.25, location=(0, 0, 0))
    body = bpy.context.active_object
    body.name = "Food_Body"
    mat = make_material("FoodMat", (0.95, 0.35, 0.65), alpha=1.0, roughness=0.3)
    body.data.materials.append(mat)

    out_path = str(models_output_dir() / "food.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
