"""Run with installed Blender in background; export without saving the .blend.

The five legacy actions retain their leading frame. New actions and locomotion
start at zero. Runtime yaw stays independently owned by the game.
"""
import bpy
import json
import struct
from pathlib import Path
from mathutils import Matrix

rig = bpy.data.objects['IRONMAW_RIG']
rig['live_leg_ik'] = False
rig['preview_clip'] = 0
rig['team_blue'] = 0
rig.animation_data.action = bpy.data.actions['Stomp']
rig.pose.bones['CTRL_RocketSlide_R'].matrix_basis = Matrix.Identity(4)
bpy.context.scene.frame_set(1)

# Pose-bone properties are authoring data; glTF exports data-bone extras.
slide = rig.pose.bones['CTRL_RocketSlide_R']
for key in ['muzzle_rest_position', 'muzzle_rest_direction', 'travel_m', 'anatomical_arm', 'physical_parent']:
    value = slide[key]
    rig.data.bones[slide.name][key] = list(value) if hasattr(value, 'to_list') else value

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.collections['IRONMAW • model only'].all_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
keys = []
for name in ['Walk', 'TurnLeft', 'TurnRight', 'HeadOpen', 'HeadClose', 'RocketFire']:
    action = bpy.data.actions[name]
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if bag:
                    for curve in bag.fcurves:
                        keys.extend(curve.keyframe_points)
for key in keys:
    key.co.x -= 1
    key.handle_left.x -= 1
    key.handle_right.x -= 1
path = Path(bpy.data.filepath).with_suffix('.glb')
try:
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS', export_anim_single_armature=True,
        export_force_sampling=True, export_frame_range=False, export_frame_step=1,
        export_def_bones=False, export_rest_position_armature=True, export_reset_pose_bones=True,
        export_skins=True, export_pointer_animation=False, export_extras=True,
        export_cameras=False, export_lights=False)
finally:
    for key in keys:
        key.co.x += 1
        key.handle_left.x += 1
        key.handle_right.x += 1

raw = path.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + length])
tail = raw[20 + length:]
excluded = {i for i, node in enumerate(gltf['nodes']) if node.get('name') in ['CTRL_WaistYaw', 'CTRL_Root']}
for animation in gltf['animations']:
    if animation['name'] in ['Walk', 'TurnLeft', 'TurnRight', 'HeadOpen', 'HeadClose', 'RocketFire']:
        animation['channels'] = [c for c in animation['channels'] if c['target']['node'] not in excluded]
for material in gltf['materials']:
    if material['name'] == 'IRONMAW_Eye_State':
        material['pbrMetallicRoughness']['baseColorFactor'] = [1, .018, .004, 1]
        material['emissiveFactor'] = [1, .018, .004]
        material.setdefault('extensions', {})['KHR_materials_emissive_strength'] = {'emissiveStrength': 1.35}
if 'KHR_materials_emissive_strength' not in gltf.setdefault('extensionsUsed', []):
    gltf['extensionsUsed'].append('KHR_materials_emissive_strength')
encoded = json.dumps(gltf, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
path.write_bytes(struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(tail))
    + struct.pack('<I4s', len(encoded), b'JSON') + encoded + tail)
print('GAME_ASSET', [(a['name'], a.get('extras')) for a in gltf['animations']])
print('MUZZLE', [(n['name'], n.get('extras')) for n in gltf['nodes'] if n.get('name') == slide.name])
