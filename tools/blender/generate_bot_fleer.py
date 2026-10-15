"""Generate the fleer bot model: small round cell with thin flagella-like spikes."""
import sys
import math
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402

def main():
    clear_scene()

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.8, location=(0, 0, 0))
    body = bpy.context.active_object
    body.name = "BotFleer_Body"

    mat = make_material("FleerMat", (0.95, 0.85, 0.35), alpha=1.0, roughness=0.5)
    body.data.materials.append(mat)

    # Thin spike/flagella protrusions around the body
    spikes = []
    num_spikes = 6
    for i in range(num_spikes):
        angle = (2 * math.pi / num_spikes) * i
        x = math.cos(angle) * 0.9
        y = math.sin(angle) * 0.9
        bpy.ops.mesh.primitive_cone_add(
            vertices=6, radius1=0.08, radius2=0.0, depth=0.5,
            location=(x, y, 0),
            rotation=(0, math.radians(90), angle),
        )
        spike = bpy.context.active_object
        spike.name = f"BotFleer_Spike_{i}"
        spike.data.materials.append(mat)
        spikes.append(spike)

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    for s in spikes:
        s.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "BotFleer_Full"

    out_path = str(models_output_dir() / "bot_fleer.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")

main()
