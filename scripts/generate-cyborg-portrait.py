"""Blender background script: blender -b -P scripts/generate-cyborg-portrait.py"""
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets"
GLB = ROOT / "blender_assets" / "player_cyborg" / "player_cyborg_animations.glb"


def point_at(obj, point):
    obj.rotation_euler = (point - obj.location).to_track_quat("-Z", "Y").to_euler()


def softbox(name, location, energy, size, color, point):
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.energy, lamp.shape, lamp.size, lamp.color = energy, "DISK", size, color
    obj = bpy.data.objects.new(name, lamp)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, point)


def render(scene, filename):
    scene.render.filepath = str(OUT / filename)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB), import_pack_images=True)
    scene = bpy.context.scene
    for obj in scene.objects:
        obj.animation_data_clear()
        if obj.type == "ARMATURE":
            for bone in obj.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 96
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Portrait studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.46, .52, .60, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .50
    focus = Vector((0, -.02, 1.55))
    camera = bpy.data.cameras.new("Portrait")
    camera.type, camera.ortho_scale = "ORTHO", .65
    scene.camera = bpy.data.objects.new("Portrait", camera)
    scene.collection.objects.link(scene.camera)
    scene.camera.location = focus + Vector((.92, -2.7, .27))
    point_at(scene.camera, focus)
    softbox("Key", (-.8, -1.25, 2.9), 65, 1.05, (1, .9, .8), focus)
    softbox("Fill", (1.05, -.5, 2), 34, .82, (.74, .87, 1), focus)
    softbox("Rim", (.45, .68, 2.15), 48, .65, (.77, .87, 1), focus)

    OUT.mkdir(parents=True, exist_ok=True)
    materials = {slot.material for obj in scene.objects if obj.type == "MESH" for slot in obj.material_slots}
    accents = {mat for mat in materials if mat.name.startswith("Suit_")}
    if not accents:
        raise ValueError("The cyborg has no colorable suit materials")
    # Keep neutral reflections beneath the color overlay at antialiased edges.
    for mat in accents:
        bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (.025, .025, .025, 1)
        bsdf.inputs["Emission Strength"].default_value = 0
    render(scene, "cyborg-portrait.png")

    # A holdout surface occludes farther accents while leaving those pixels
    # transparent. The resulting alpha mask uses the exact beauty camera.
    for mat in materials:
        nodes = mat.node_tree.nodes
        output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL" and node.is_active_output)
        shader = nodes.new("ShaderNodeEmission" if mat in accents else "ShaderNodeHoldout")
        mat.node_tree.links.new(shader.outputs[0], output.inputs["Surface"])
    render(scene, "cyborg-portrait-accents.png")


if __name__ == "__main__":
    main()
