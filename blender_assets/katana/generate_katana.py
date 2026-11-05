"""Run: blender --background --factory-startup --python generate_katana.py"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Author in game coordinates (Y up); Blender uses Z up. Grip center is the origin.
def blender_point(p):
    return (p[0], -p[2], p[1])

def game_point(p):
    return [round(p.x, 7), round(p.z, 7), round(-p.y, 7)]

def material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

black = material('Black molded plastic', tuple(linear(v / 255) for v in (8, 10, 14)), 0, .29)
silver = material('Bright polished silver', tuple(linear(v / 255) for v in (235, 240, 248)), .88, .22)
objects = []

def finish(obj, name, mat, bevel):
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new('Soft molded edges', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 2
    modifier = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    modifier.keep_sharp = True
    objects.append(obj)
    return obj

# Broad constant-width lower blade, a gently swept spine, and a single angled tip.
outline = []
for i in range(13):
    t = i / 12
    outline.append((.125 * t * t - .043, .165 + 1.035 * t))
outline.append((.18, 1.30))
for i in range(12, -1, -1):
    t = i / 12
    outline.append((.125 * t * t + .043, .165 + 1.035 * t))
n = len(outline)
vertices = [blender_point((x, y, z)) for z in (-.018, .018) for x, y in outline]
faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
mesh = bpy.data.meshes.new('Blade mesh')
mesh.from_pydata(vertices, [], faces)
mesh.update()
blade = bpy.data.objects.new('blade', mesh)
bpy.context.collection.objects.link(blade)
# Recalculate normals independently of the outline winding.
bpy.context.view_layer.objects.active = blade
blade.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
finish(blade, 'blade', black, .002)
blade.select_set(False)

bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.034, depth=.27)
grip = finish(bpy.context.object, 'grip', silver, .003)
for polygon in grip.data.polygons:
    polygon.use_smooth = len(polygon.vertices) == 4
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, .148))
guard = bpy.context.object
guard.scale = (.17, .10, .028)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
finish(guard, 'guard', black, .005)

# Export evaluated bevels and normals, so JSON and GLB share the authored surface.
bpy.context.view_layer.update()
parts = []
for obj in objects:
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    positions, normals = [], []
    for triangle in mesh.loop_triangles:
        for loop_index in triangle.loops:
            positions.extend(game_point(evaluated.matrix_world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co))
            normals.extend(game_point(mesh.corner_normals[loop_index].vector))
    parts.append({'name': obj.name, 'positions': positions, 'normals': normals,
                  'color': 0xEBF0F8 if obj == grip else 0x080A0E,
                  'metalness': .88 if obj == grip else 0, 'roughness': .22 if obj == grip else .29})
    evaluated.to_mesh_clear()
(OUT / 'katana.mesh.json').write_text(json.dumps({'parts': parts}, separators=(',', ':')) + '\n')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'katana.glb'), export_format='GLB', use_selection=True, export_apply=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world.color = (.22, .22, .22)
scene.view_settings.view_transform = 'AgX'

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

for location, energy, size in [((1, -3, 3), 450, 3), ((-2, -1, 1), 300, 2), ((1, 2, 2), 550, 2)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    point_at(light, (0, 0, .6))
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.7
scene.camera = camera
for name, location in [('front', (.07, -5, .59)), ('side', (5, 0, .59)), ('three_quarter', (2.5, -5, 1.7))]:
    camera.location = location
    point_at(camera, (.07, 0, .59))
    scene.render.filepath = str(OUT / f'preview_{name}.png')
    bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = blade
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'katana.blend'))
print('Katana exported:', sum(len(p['positions']) // 9 for p in parts), 'triangles')
