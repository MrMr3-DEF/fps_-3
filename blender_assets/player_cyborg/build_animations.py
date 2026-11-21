"""Build the separate cyborg animation library from the original artist scenes.

Run from anywhere with Blender 5.2 in background mode. See ANIMATIONS.md.
"""
import json
import math
import struct
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from cyborg_equipment import add_equipment


FPS = 120
IDENTITY = Matrix.Identity(4)
CHANNELS = {
    "rotation_quaternion": ("rotation", 4),
    "location": ("translation", 3),
    "scale": ("scale", 3),
}
GRAPPLE_ANCHORS = {'GrappleCarry', 'GrapplePark'}


def hidden_at_rest(name):
    return name.startswith(('FX.', 'Burst.')) or name == 'GrappleCarry'


class ClipAuthor:
    """One sparse set of samples supplies the editable action and the glTF clip.

    A locomotion clip must never acquire implicit arm keys during Blender export:
    an idle arm key would override an equipped gun when the two are layered.
    """
    def __init__(self, rig):
        self.rig = rig
        self.out = HERE
        self.samples = {}
        self.durations = {}
        self.changed = set()
        self.refresh()

    def refresh(self):
        self.bones = self.rig.pose.bones
        self.local_rest = {}
        for bone in self.rig.data.bones:
            mat = bone.matrix_local.copy()
            self.local_rest[bone.name] = bone.parent.matrix_local.inverted() @ mat if bone.parent else mat
        for bone in self.bones:
            bone.rotation_mode = 'QUATERNION'

    def reset(self):
        for name, _ in self.changed:
            self.bones[name].matrix_basis = IDENTITY
        self.changed.clear()

    def change(self, name, prop, value):
        setattr(self.bones[name], prop, value)
        self.changed.add((name, prop))

    def rot(self, name, angles):
        self.change(name, 'rotation_quaternion', Euler(tuple(math.radians(v) for v in angles)).to_quaternion())

    def move(self, name, value):
        self.change(name, 'location', value)

    def scale(self, name, value):
        self.change(name, 'scale', value)

    def bone_matrix(self, name):
        bone = self.bones[name]
        local = self.local_rest[name] @ bone.matrix_basis
        return self.bone_matrix(bone.parent.name) @ local if bone.parent else local

    def parent_frame(self, name):
        parent = self.bones[name].parent
        return self.bone_matrix(parent.name) @ self.local_rest[name] if parent else self.local_rest[name]

    def orient(self, name, absolute_quat):
        self.change(name, 'rotation_quaternion', self.parent_frame(name).to_quaternion().inverted() @ absolute_quat)

    def world_rot(self, name, delta):
        self.orient(name, delta @ self.bones[name].bone.matrix_local.to_quaternion())

    def world_pose(self, name, position, quaternion):
        parent = self.parent_frame(name)
        self.move(name, parent.inverted() @ Vector(position))
        self.change(name, 'rotation_quaternion', parent.to_quaternion().inverted() @ quaternion)

    def arm(self, side, wrist_xyz, palm_absolute_quat, elbow_pole_xyz, palm_weight):
        upper, lower, hand = (f'{stem}.{side}' for stem in ('upper_arm', 'forearm', 'hand'))
        shoulder = self.bone_matrix(upper).translation
        line = Vector(wrist_xyz) - shoulder
        length_a, length_b = (self.bones[n].bone.length for n in (upper, lower))
        distance = min(max(line.length, abs(length_a - length_b) + .00001), length_a + length_b - .00001)
        axis = line.normalized()
        pole = Vector(elbow_pole_xyz) - shoulder
        # Select the bend plane using the actual finger direction. An elbow
        # driven only by a fixed pole makes the wrist fold back as the gun turns.
        finger = self.bones['middle.01.' + side].bone.head_local
        rest_hand = self.bones[hand].bone
        palm_axis = rest_hand.matrix_local.to_quaternion().inverted() @ (finger - rest_hand.head_local).normalized()
        forearm_axis = palm_absolute_quat @ palm_axis
        preferred = -forearm_axis + axis * forearm_axis.dot(axis)
        normal = pole - axis * pole.dot(axis)
        # Near full extension the wrist has little leverage over the elbow;
        # retaining an outward pole there avoids a bend-plane flip.
        normal.normalize()
        preferred -= normal * min(0, preferred.dot(normal))
        normal = normal * .49 + preferred * palm_weight
        if normal.length < .00001:
            normal = axis.orthogonal()
        along = (length_a**2 + distance**2 - length_b**2) / (2 * distance)
        elbow = shoulder + axis * along + normal.normalized() * math.sqrt(max(0, length_a**2 - along**2))
        end = shoulder + axis * distance
        for name, direction in ((upper, elbow - shoulder), (lower, end - elbow)):
            rest = self.bones[name].bone
            swing = (rest.tail_local - rest.head_local).rotation_difference(direction)
            self.world_rot(name, swing)
        # Pronation belongs along the long forearm. Transfer its twist while
        # preserving both joint locations and the exact surface grasp.
        lower_q = self.bone_matrix(lower).to_quaternion()
        hand_rest = self.local_rest[hand].to_quaternion()
        relative = lower_q.inverted() @ palm_absolute_quat @ hand_rest.inverted()
        twist = relative.to_swing_twist('Y')[1]
        self.orient(lower, lower_q @ Quaternion((0, 1, 0), math.sin(twist) * 1.10))
        self.orient(hand, palm_absolute_quat)

    def grip(self, side, position, quaternion, elbow_pole, palm_weight=1.15):
        # The attachment sits inside the curled fingers, offset from the wrist.
        socket = self.local_rest[f'grip.{side}'] @ self.bones[f'grip.{side}'].matrix_basis
        palm = quaternion @ socket.to_quaternion().inverted()
        wrist = Vector(position) - palm @ socket.translation
        self.arm(side, wrist, palm, elbow_pole, palm_weight)

    def action(self, name, duration_seconds, sample_fn, times):
        if name in self.samples or bpy.data.actions.get(name):
            raise ValueError(f'Duplicate character action {name}')
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        action.slots.new('OBJECT', self.rig.name)
        action.layers.new('Pose').strips.new(type='KEYFRAME')
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, duration_seconds * FPS
        self.samples[name] = {}
        self.durations[name] = duration_seconds
        self.extend_action(name, duration_seconds, sample_fn, times)

    def extend_action(self, name, duration_seconds, sample_fn, times):
        if abs(self.durations[name] - duration_seconds) > 1e-5:
            raise ValueError(f'Duration mismatch for {name}')
        times = sorted({round(float(t), 8) for t in (0, *times, duration_seconds)})
        if times[0] < -1e-6 or times[-1] > duration_seconds + 1e-6:
            raise ValueError(f'Keys beyond {name} duration: {times[0]}, {times[-1]}')
        poses = []
        for t in times:
            self.reset()
            sample_fn(t)
            poses.append({key: tuple(getattr(self.bones[key[0]], key[1])) for key in self.changed})
        self.reset()
        action = bpy.data.actions[name]
        bag = action.layers[0].strips[0].channelbag(action.slots[0], ensure=True)
        for key in sorted(set().union(*(p.keys() for p in poses))):
            bone, prop = key
            if key in self.samples[name]:
                raise ValueError(f'Duplicate {name} track {key}')
            default = (1, 0, 0, 0) if prop == 'rotation_quaternion' else (1, 1, 1) if prop == 'scale' else (0, 0, 0)
            values = [pose.get(key, default) for pose in poses]
            if prop == 'rotation_quaternion':
                for i in range(1, len(values)):
                    if sum(a*b for a, b in zip(values[i-1], values[i])) < 0:
                        values[i] = tuple(-n for n in values[i])
            pairs = list(zip(times, values))
            # Drop interiors of constant stretches, preserving the ends for the
            # interpolation into and out of a held grip, planted foot or glow.
            pairs = [p for i, p in enumerate(pairs) if i in (0, len(pairs)-1) or
                     max(abs(v-w) for v,w in zip(p[1], values[i-1])) > 1e-7 or
                     max(abs(v-w) for v,w in zip(p[1], values[i+1])) > 1e-7]
            self.samples[name][key] = pairs
            path = self.bones[bone].path_from_id(prop)
            for component in range(len(default)):
                curve = bag.fcurves.new(data_path=path, index=component, group_name=bone)
                curve.keyframe_points.add(len(pairs))
                curve.keyframe_points.foreach_set('co', [n for t, v in pairs for n in (t*FPS, v[component])])
                for point in curve.keyframe_points:
                    point.interpolation = 'CONSTANT' if bone in GRAPPLE_ANCHORS else 'LINEAR'
                curve.update()


def add_glb_clips(path, ctx):
    """Use the skin exporter's actual joint binds; store only authored tracks."""
    raw = path.read_bytes()
    json_size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+json_size])
    binary = bytearray(raw[20+json_size+8:][:doc['buffers'][0]['byteLength']])
    indices = {n['name']: i for i, n in enumerate(doc['nodes']) if 'name' in n}
    shared = {}

    def accessor(rows, width, time=False):
        data = array('f', (x for row in rows for x in row)).tobytes()
        key = (width, time, data)
        if key in shared:
            return shared[key]
        offset = len(binary)
        binary.extend(data)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0, byteOffset=offset, byteLength=len(data)))
        acc = dict(bufferView=view, componentType=5126, count=len(rows), type={1:'SCALAR',3:'VEC3',4:'VEC4'}[width])
        if time:
            acc.update(min=rows[0], max=rows[-1])
        idx = len(doc['accessors'])
        doc['accessors'].append(acc)
        shared[key] = idx
        return idx

    doc['animations'] = []
    for name, paths in ctx.samples.items():
        samplers, channels = [], []
        for (bone, prop), pairs in paths.items():
            idx = indices[bone]
            node = doc['nodes'][idx]
            x,y,z = node.get('translation', (0,0,0))
            rx,ry,rz,rw = node.get('rotation', (0,0,0,1))
            sx,sy,sz = node.get('scale', (1,1,1))
            rotation = Quaternion((rw,rx,ry,rz))
            target, width = CHANNELS[prop]
            values = []
            for _, value in pairs:
                if target == 'rotation':
                    q = rotation @ Quaternion(value)
                    q.normalize()
                    values.append([q.x,q.y,q.z,q.w])
                elif target == 'translation':
                    v = rotation @ Vector((value[0]*sx,value[1]*sy,value[2]*sz))
                    values.append([x+v.x,y+v.y,z+v.z])
                else:
                    values.append([sx*value[0],sy*value[1],sz*value[2]])
            channels.append(dict(sampler=len(samplers),target=dict(node=idx,path=target)))
            interpolation = 'STEP' if bone in GRAPPLE_ANCHORS else 'LINEAR'
            samplers.append(dict(input=accessor([[t] for t,_ in pairs],1,True),output=accessor(values,width),interpolation=interpolation))
        doc['animations'].append(dict(name=name,channels=channels,samplers=samplers))
    # Keep nozzles dark when no thrust action is playing. Their inverse-bind
    # matrices come from the full-size mesh and are valid even at ignition.
    for node in doc['nodes']:
        if hidden_at_rest(node.get('name','')):
            node['scale'] = [0.00001]*3
    doc['buffers'][0]['byteLength'] = len(binary)
    binary.extend(b'\0' * (-len(binary)%4))
    header = json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
    header += b' '*(-len(header)%4)
    path.write_bytes(struct.pack('<4sII', b'glTF',2,28+len(header)+len(binary)) +
                     struct.pack('<I4s',len(header),b'JSON')+header+
                     struct.pack('<I4s',len(binary),b'BIN\0')+binary)


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def editing_views(rig):
    collection = bpy.data.collections.new('Animation review cameras')
    bpy.context.scene.collection.children.link(collection)
    for label, eye, target, lens in (
        ('Holder · visor', (0, -.205, 1.69), (0, -.85, 1.35), 19),
        ('Side · hands and holster', (3, -.65, 1.48), (0, -.12, 1.10), 53),
        ('Rear · flight outlets', (1.05, 3.40, 1.14), (0, .03, .86), 53),
    ):
        data = bpy.data.cameras.new(label)
        obj = bpy.data.objects.new(label, data)
        collection.objects.link(obj)
        data.lens, data.clip_start, data.display_size = lens, .012, .085
        mat = (Vector(target)-Vector(eye)).to_track_quat('-Z', 'Y').to_matrix().to_4x4()
        mat.translation = Vector(eye)
        if label.startswith('Holder'):
            bone = rig.data.bones['head']
            obj.parent, obj.parent_type, obj.parent_bone = rig, 'BONE', 'head'
            parent = bone.matrix_local @ Matrix.Translation((0, bone.length, 0))
            obj.matrix_basis = parent.inverted() @ mat
        else:
            obj.matrix_world = mat


def editing_reference(rig):
    """Supply unkeyed bones when scrubbing sparse actions in the Action Editor."""
    action = bpy.data.actions.new('Rest values · editing underlay')
    slot = action.slots.new('OBJECT', rig.name)
    bag = action.layers.new('Rest').strips.new(type='KEYFRAME').channelbag(slot, ensure=True)
    for bone in rig.pose.bones:
        bone.matrix_basis = IDENTITY
        if hidden_at_rest(bone.name):
            bone.scale = (0.00001,) * 3
        for prop in CHANNELS:
            path = bone.path_from_id(prop)
            for index, value in enumerate(getattr(bone, prop)):
                bag.fcurves.new(data_path=path, index=index, group_name=bone.name).keyframe_points.insert(0, value)
    track = rig.animation_data_create().nla_tracks.new()
    track.name = 'Rest values for unkeyed channels'
    strip = track.strips.new('Rest', 0, action)
    strip.extrapolation = 'HOLD'
    strip.action_slot = slot


def grapple_handoff(ctx):
    # glTF has fixed parentage. Switch rigid geometry where the closed glove
    # meets the holster, then the active prop inherits its real parent even when
    # an independent walk, hover, recoil or grapple-pull layer moves the torso.
    for name in ctx.samples:
        draw = name.startswith('Grapple.Draw.')
        stow = name.startswith('Grapple.Return.')
        if not (draw or stow or name in ('Grapple.Held', 'Grapple.Fire', 'Grapple.Latch', 'Grapple.Pull',
                                         'Grapple.Retract', 'Grapple.Miss', 'Grapple.Reload')):
            continue
        swap = .225 if draw else round(ctx.durations[name] - .225, 8)

        def display(t, draw=draw, stow=stow, swap=swap):
            held = t >= swap if draw else t < swap if stow else True
            ctx.scale('GrappleCarry', (1 if held else .00001,) * 3)
            ctx.scale('GrapplePark', (.00001 if held else 1,) * 3)

        duration = ctx.durations[name]
        ctx.extend_action(name, duration, display, [swap] if draw or stow else [])


def export_body(ctx, meshes):
    # Join only temporary duplicates: in the editing scene every armor plate,
    # holster panel and nozzle remains available for independent adjustment.
    copies = []
    for source in meshes:
        copy = source.copy()
        copy.data = source.data.copy()
        bpy.context.scene.collection.objects.link(copy)
        copies.append(copy)
    activate(copies[0])
    for copy in copies:
        copy.select_set(True)
    bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = 'Cyborg • equipped armor'
    mesh.data.name = 'Cyborg • equipped armor'
    ctx.rig.select_set(True)
    path = HERE / 'player_cyborg_animations.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),use_selection=True,export_animations=False,
        export_cameras=False,export_lights=False,export_extras=True,export_skins=True,
        export_def_bones=False,export_rest_position_armature=True)
    bpy.data.objects.remove(mesh,do_unlink=True)
    add_glb_clips(path,ctx)


def build():
    import cyborg_motion, cyborg_combat, cyborg_props
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'player_cyborg.blend'), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    rig = next(obj for obj in scene.objects if obj.type=='ARMATURE')
    for b in rig.pose.bones:
        b.matrix_basis = IDENTITY
    meshes = [obj for obj in scene.objects if obj.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers)]
    meshes.extend(add_equipment(rig))
    ctx = ClipAuthor(rig)
    cyborg_motion.build_motion(ctx)
    gear = {key: cyborg_props.load_gear(key) for key in cyborg_props.GRIPS}
    cyborg_combat.build_combat(ctx, gear)
    meshes.extend(cyborg_props.make_embedded_grapple(ctx, gear["grapple"]))
    grapple_handoff(ctx)
    for bone in rig.pose.bones:
        bone.matrix_basis = IDENTITY
    bpy.context.view_layer.update()
    export_body(ctx,meshes)
    previews = cyborg_props.build_props(ctx, gear)
    editing_views(rig)
    bpy.data.texts.load(str(HERE/'ANIMATIONS.md'), internal=True)
    activate(rig)
    editing_reference(rig)
    preferred = bpy.data.actions['AssaultRifle.Reload']
    previews['assault_rifle'].animation_data.nla_tracks['Reload'].mute = False
    rig.animation_data.action = preferred
    rig.animation_data.action_slot = preferred.slots[0]
    scene.frame_end = round(preferred.frame_end)
    scene.frame_set(0)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_distance = 3.8
                area.spaces.active.region_3d.view_location = (0,0,1)
                area.spaces.active.region_3d.view_rotation = Euler((math.radians(79),0,math.radians(-28))).to_quaternion()
                area.spaces.active.overlay.show_extras = False
                area.spaces.active.overlay.show_relationship_lines = False
                area.spaces.active.shading.color_type = 'MATERIAL'
            elif area.type == 'DOPESHEET_EDITOR' and area.ui_type == 'TIMELINE':
                area.ui_type = 'DOPESHEET'
                area.spaces.active.mode='ACTION'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'player_cyborg_animations.blend'),compress=True)
    print(f'Built cyborg pack with {len(ctx.samples)} character actions.')


if __name__ == '__main__':
    build()
