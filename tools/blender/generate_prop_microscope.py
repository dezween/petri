"""Generate the big decorative microscope prop that frames the petri dish — one large,
detailed static background piece (not instanced, so a real poly/material budget applies)
built from a base, a curved arm, a focus-knob pair, an eyepiece head, a 3-lens objective
turret, and a condenser beneath the stage. Positioned/scaled by
src/render/adapter/three/static-props.ts, angle-relative to the dish like every other prop.

Coordinate convention matches the other prop scripts: the model is authored directly in a
Y-up layout (location's 2nd component is height) so it exports to glTF's Y-up convention
without needing an extra axis-conversion step.
"""
import sys
import math
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import clear_scene, make_material, models_output_dir  # noqa: E402


def main():
    clear_scene()

    body_mat = make_material("MicroscopeBodyMat", (0.07, 0.075, 0.09), roughness=0.35, metallic=0.15)
    chrome_mat = make_material("MicroscopeChromeMat", (0.78, 0.79, 0.82), roughness=0.08, metallic=0.9)
    brass_mat = make_material("MicroscopeBrassMat", (0.65, 0.48, 0.2), roughness=0.25, metallic=0.75)
    lens_mat = make_material("MicroscopeLensMat", (0.55, 0.72, 0.82), alpha=0.5, roughness=0.05, metallic=0.1)

    parts = []

    def add(obj, mat, name):
        obj.name = name
        obj.data.materials.append(mat)
        parts.append(obj)
        return obj

    # --- Base: a wide, slightly tapered foot the whole instrument stands on ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.6, depth=0.35, location=(0, 0.18, 0))
    base = add(bpy.context.active_object, body_mat, "Microscope_Base")
    base.scale = (1.0, 1.0, 0.62)  # oval footprint, not a perfect circle

    # Chrome trim ring around the base's upper edge
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.55, minor_radius=0.05, major_segments=32, minor_segments=8,
        location=(0, 0.34, 0), rotation=(math.radians(90), 0, 0),
    )
    base_trim = add(bpy.context.active_object, chrome_mat, "Microscope_BaseTrim")
    base_trim.scale = (1.0, 1.0, 0.62)

    # --- Arm: a curved column rising from the back of the base, built from 5 stacked,
    # progressively offset segments so it reads as a sweeping C-curve rather than a straight
    # pole — this is the single biggest silhouette element, so it carries most of the "looks
    # like a real microscope arm" read.
    arm_segment_count = 6
    arm_height = 4.6
    arm_base_x = -1.1
    for i in range(arm_segment_count):
        t = i / (arm_segment_count - 1)
        # Curve: sweeps from behind the base (-x) up and forward (+x) as it rises, like a
        # microscope's classic C-arm silhouette.
        x = arm_base_x + math.sin(t * math.pi * 0.55) * 1.35
        y = 0.35 + t * arm_height
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.26 - 0.07 * t, depth=arm_height / arm_segment_count * 1.25, location=(x, y, 0))
        seg = add(bpy.context.active_object, body_mat, f"Microscope_Arm_{i}")
        # Tilt each segment slightly to follow the curve's local tangent.
        seg.rotation_euler.z = -t * math.radians(28)

    arm_top_y = 0.35 + arm_height
    arm_top_x = arm_base_x + math.sin(0.55 * math.pi) * 1.35

    # --- Head + eyepiece: sits atop the arm, angled back toward the viewer ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.42, depth=0.55, location=(arm_top_x, arm_top_y + 0.25, 0))
    head = add(bpy.context.active_object, body_mat, "Microscope_Head")
    head.rotation_euler.x = math.radians(20)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.16, depth=1.1, location=(arm_top_x - 0.15, arm_top_y + 0.85, -0.3))
    eyepiece = add(bpy.context.active_object, chrome_mat, "Microscope_Eyepiece")
    eyepiece.rotation_euler.x = math.radians(35)

    # Eyepiece lens glint at the very top
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, segments=12, ring_count=8, location=(arm_top_x - 0.28, arm_top_y + 1.35, -0.6))
    add(bpy.context.active_object, lens_mat, "Microscope_EyepieceLens")

    # --- Focus adjustment knobs: a coarse/fine pair on each side of the arm's midsection ---
    knob_y = 0.35 + arm_height * 0.42
    knob_x = arm_base_x + math.sin(0.42 * math.pi * 0.55 / 0.55) * 0  # placeholder unused
    knob_center_x = arm_base_x + math.sin(0.42 * math.pi * 0.55) * 1.35
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.22, depth=0.16, location=(knob_center_x + side * 0.32, knob_y, 0))
        knob = add(bpy.context.active_object, brass_mat, f"Microscope_FocusKnob_{side}")
        knob.rotation_euler.x = math.radians(90)
        # Small grip ridges: four thin boxes around the knob's rim read as knurling at a glance.
        for ridge_i in range(4):
            angle = ridge_i * math.pi / 2
            rx = knob_center_x + side * 0.32 + math.cos(angle) * 0.21
            rz = math.sin(angle) * 0.21
            bpy.ops.mesh.primitive_cube_add(size=0.05, location=(rx, knob_y, rz))
            ridge = add(bpy.context.active_object, brass_mat, f"Microscope_FocusKnobRidge_{side}_{ridge_i}")
            ridge.scale = (1, 1.8, 1)

    # --- Objective turret: a disc with 3 lens barrels hanging below, under the head, pointing
    # down toward the stage — the part that most reads as "this is definitely a microscope"
    # from the game's tilted top-down camera angle. ---
    turret_x = arm_top_x
    turret_y = 1.1
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.38, depth=0.14, location=(turret_x, turret_y, 0))
    turret_disc = add(bpy.context.active_object, chrome_mat, "Microscope_TurretDisc")

    barrel_lengths = (0.55, 0.42, 0.68)
    for i, length in enumerate(barrel_lengths):
        angle = i * (2 * math.pi / 3)
        bx = turret_x + math.cos(angle) * 0.24
        bz = math.sin(angle) * 0.24
        by = turret_y - 0.1 - length / 2
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.09, depth=length, location=(bx, by, bz))
        add(bpy.context.active_object, body_mat, f"Microscope_ObjectiveBarrel_{i}")
        # Lens glass at the tip of each barrel.
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.085, depth=0.03, location=(bx, by - length / 2 - 0.015, bz))
        add(bpy.context.active_object, lens_mat, f"Microscope_ObjectiveLens_{i}")

    # --- Stage: a wide flat plate extending from the base toward where the dish sits —
    # this is the piece that visually reads as "the dish is sitting on the microscope's
    # stage" even though the actual gameplay dish is a separate object elsewhere in the
    # scene — the plate just needs to gesture toward it. ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=2.3, depth=0.1, location=(0.6, 0.42, 0))
    stage = add(bpy.context.active_object, chrome_mat, "Microscope_Stage")
    stage.scale = (1.3, 1.0, 1.3)

    # Stage clips: two small L-shaped brackets on the stage plate.
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=0.22, location=(0.6 + side * 1.9, 0.52, side * 0.9))
        clip = add(bpy.context.active_object, chrome_mat, f"Microscope_StageClip_{side}")
        clip.scale = (0.4, 1, 1.6)

    # --- Condenser: a tapered lens assembly beneath the stage, on a thin support column ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.07, depth=0.5, location=(0.6, 0.12, 0))
    add(bpy.context.active_object, body_mat, "Microscope_CondenserPost")
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.22, radius2=0.1, depth=0.3, location=(0.6, 0.35, 0))
    add(bpy.context.active_object, body_mat, "Microscope_CondenserHousing")
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.1, depth=0.02, location=(0.6, 0.47, 0))
    add(bpy.context.active_object, lens_mat, "Microscope_CondenserLens")

    # --- Join everything into one object, keeping per-face material slots (glTF preserves
    # multiple materials across a join — same approach already validated for the player cell
    # and bot models in this project's history). ---
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = "Microscope_Body"

    out_path = str(models_output_dir() / "prop_microscope.glb")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print(f"Exported: {out_path}")


main()
