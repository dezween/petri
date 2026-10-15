"""Shared helpers for the headless Blender model-generation scripts.

Not runnable standalone -- imported by each ``generate_*.py`` script via:

    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from _common import clear_scene, make_material, models_output_dir
"""
from pathlib import Path

import bpy


def clear_scene():
    """Remove every object, mesh, and material from the default scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def make_material(name, color, alpha=1.0, roughness=0.4):
    """Create a simple Principled-BSDF material, optionally translucent.

    When ``alpha < 1.0`` the material is switched to alpha-blended so the
    glTF exporter emits ``alphaMode: "BLEND"`` and folds the alpha value
    into ``baseColorFactor`` (verified against the Blender 5.2 glTF
    exporter -- see docs/REVIEW.md WR-04).
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = 'BLEND'
    return mat


def models_output_dir():
    """Return `src/assets/models/`, resolved relative to this file's repo location.

    This makes every generator script portable across machines/checkouts
    instead of hardcoding one developer's absolute filesystem path
    (see docs/REVIEW.md CR-01).
    """
    repo_root = Path(__file__).resolve().parent.parent.parent
    out_dir = repo_root / "src" / "assets" / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir
