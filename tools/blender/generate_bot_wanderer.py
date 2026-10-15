"""Generate the wanderer bot model: simple calm round cell."""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(0, 0, 0))
    body = bpy.context.active_object
    body.name = "BotWanderer_Body"
    mat = make_material("WandererMat", (0.4, 0.75, 0.55), alpha=1.0, roughness=0.5)
    body.data.materials.append(mat)

    out_path = str(models_output_dir() / "bot_wanderer.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
