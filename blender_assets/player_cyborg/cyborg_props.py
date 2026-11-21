"""Fit the authored gear to a shared grip frame and bake portable rigid prop rigs."""
from dataclasses import dataclass, field
from math import pi, sqrt
from pathlib import Path
import json
import re
import struct

import bpy
from mathutils import Euler, Matrix, Vector


SOURCE = Path(__file__).resolve().parents[1]
# Grip coordinates are in the source files' evaluated world metres. +Y is the bore.
GRIPS = {
    "pistol": (0, -.090, -.090), "shotgun": (0, -.141, -.084),
    "assault_rifle": (0, -.124, -.103), "sniper": (0, -.090, -.090),
    "minigun": (0, -.071, .108), "grapple": (0, -.090, -.090),
    "katana": (0, 0, 0),
}
SUPPORT = {"assault_rifle": (0, .293, -.007), "shotgun": (0, .285, .032),
           "sniper": (0, .220, .040), "minigun": (-.055, .082, -.230)}
MUZZLES = {"assault_rifle": "Muzzle collar", "shotgun": "Twin barrel",
           "sniper": "Muzzle block", "pistol": "Recessed nose", "grapple": "Recessed nose",
           "minigun": "Barrel 1", "katana": "blade"}
FPS = 120
RELOAD_END = 236


@dataclass
class Gear:
    name: str
    points: list = field(default_factory=list)
    groups: dict = field(default_factory=dict)
    faces: list = field(default_factory=list)
    slots: list = field(default_factory=list)
    materials: dict = field(default_factory=dict)
    normals: list = field(default_factory=list)
    bones: dict = field(default_factory=lambda: {"Body": (None, Vector((0, 0, 0)))})
    rotations: dict = field(default_factory=dict)
    lid_points: list = field(default_factory=list)
    lamps: dict = field(default_factory=dict)
    reload: list = field(default_factory=list)
    recoil: list = field(default_factory=list)


def focused_object(obj):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def prop_material(gear, source, kind):
    if kind == "blade":
        name = "Katana blade"
    elif kind == "frost":
        name = "Prop · frosted glass"
    elif kind == "lamp":
        name = gear.name + " · energized glass"
    else:
        name = "Prop · " + re.sub(r"( • drawer)?(\.\d{3})?$", "", source.name)
    if name not in gear.materials:
        mat = bpy.data.materials.get(name)
        if not mat:
            mat = bpy.data.materials.new(name)
            mat.use_nodes = True
            target = mat.node_tree.nodes.get("Principled BSDF")
            bsdf = source.node_tree.nodes.get("Principled BSDF") if source.node_tree else None
            rgba = (.17, .20, .23, 1.) if kind == "frost" else tuple(source.diffuse_color)
            mat.diffuse_color = rgba
            target.inputs["Base Color"].default_value = rgba
            target.inputs["Metallic"].default_value = .12 if kind == "frost" else (
                bsdf.inputs["Metallic"].default_value if bsdf else source.metallic)
            target.inputs["Roughness"].default_value = .45 if kind == "frost" else (
                bsdf.inputs["Roughness"].default_value if bsdf else source.roughness)
            if kind == "lamp":
                target.inputs["Emission Color"].default_value = rgba
                target.inputs["Emission Strength"].default_value = 1.65
        gear.materials[name] = mat
    return list(gear.materials).index(name)


def light_bone_name(part):
    if part == "Cuboid battery":
        return "CellLight"
    if part.startswith("Rear lid"):
        return "LidLight"
    if part == "Core stripe":
        return "ReceiverLight"
    if part == "Recessed nose":
        return "NoseLight"
    return re.sub(r"[^a-zA-Z0-9]", "", part) + "Light"


def get_curves(action):
    return {(fc.data_path, fc.array_index): fc
            for layer in action.layers for strip in layer.strips
            for bag in strip.channelbags for fc in bag.fcurves}


def source_motion(gear, actions):
    for name in ("Reload", "Recoil"):
        f = get_curves(actions[name])
        for frame in range(int(actions[name].frame_range.y) + 1):
            # The two original rigs' local X translations become forward-axis metres.
            val = lambda path, axis=0: f[path, axis].evaluate(frame)
            if name == "Reload":
                gear.reload.append((.1 * val('pose.bones["Battery"].location'),
                                    val('pose.bones["Weapon"]["charge"]'),
                                    val('pose.bones["Battery"]["charge"]')))
            else:
                gear.recoil.append((.1 * val('pose.bones["Weapon"].location'),
                                    -val('pose.bones["Weapon"].rotation_euler', 1)))


def read_part(gear, name, obj, transform, deps):
    if obj.type not in {"MESH", "FONT", "CURVE"}:
        return
    if gear.name != "katana" and obj.parent_bone not in {"Weapon", "Battery"}:
        return
    if gear.name == "katana" and name not in {"blade", "guard", "grip"}:
        return
    evaluated = obj.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    matrix = transform @ evaluated.matrix_world
    nmat = matrix.to_3x3().inverted().transposed()
    parent = "Drawer" if obj.parent_bone == "Battery" else "Body"
    if gear.name == "minigun" and (name.startswith("Barrel ") or name in {
            "Square brace", "Brace hub", "Front retaining band"}):
        parent = "Rotor"
    positions = [matrix @ v.co for v in mesh.vertices]
    if parent == "Drawer" and name.startswith("Rear lid • ") and name.split(" • ", 1)[1] not in {"index", "Core stripe"}:
        gear.lid_points.extend(positions)
    barrel = gear.name == "minigun" and name.startswith("Barrel ") and name[7:].isdigit()
    if barrel or name == MUZZLES[gear.name]:
        axis = 2 if gear.name == "katana" else 1
        limit = max(p[axis] for p in positions)
        cap = [p for p in positions if p[axis] > limit - .001]
        opening = sum(cap, Vector((0, 0, 0))) / len(cap)
        if barrel:
            gear.bones["Bore" + name[7:]] = ("Rotor", opening)
        if name == MUZZLES[gear.name]:
            # Muzzle is a stable effects attachment. The runtime moves it to the
            # highest real bore as the rotor turns inside the stationary housing.
            gear.bones["Tip" if gear.name == "katana" else "Muzzle"] = (
                "Body" if barrel else parent, opening)
    mesh.calc_loop_triangles()
    corner_normals = [(nmat @ n.vector).normalized() for n in mesh.corner_normals]
    cache = {}
    light_points = []
    light = light_bone_name(name)
    for tri in mesh.loop_triangles:
        source = mesh.materials[tri.material_index]
        glowing = source.name.startswith(("Core •", "Battery glass"))
        for glow in range(2 if glowing else 1):
            group = light if glow else parent
            slot = prop_material(gear, source, "lamp" if glow else "frost" if glowing else "blade" if gear.name == "katana" and name == "blade" else "surface")
            indices = []
            for v, loop in zip(tri.vertices, tri.loops):
                key = (v, group)
                if key not in cache:
                    p = positions[v].copy()
                    if glow:
                        p += (nmat @ mesh.vertices[v].normal).normalized() * .00035
                        light_points.append(p)
                    i = len(gear.points)
                    gear.points.append(p)
                    gear.groups.setdefault(group, []).append(i)
                    cache[key] = i
                indices.append(cache[key])
                gear.normals.append(corner_normals[loop])
            gear.faces.append(indices)
            gear.slots.append(slot)
    # A progressively filling luminous shell over a frosted solid makes the
    # source's shader drivers visible in standard glTF TRS animation channels.
    if light_points:
        spans = [max(p[i] for p in light_points) - min(p[i] for p in light_points)
                 for i in range(3)]
        axis = max(range(3), key=spans.__getitem__)
        pivot = sum(light_points, Vector((0, 0, 0))) / len(light_points)
        pivot[axis] = min(p[axis] for p in light_points)
        gear.bones[light] = (parent, pivot)
        gear.lamps[light] = (axis, name == "Cuboid battery")
    evaluated.to_mesh_clear()


def load_gear(name):
    gear = Gear(name)
    path = SOURCE / ("katana" if name == "katana" else "firearms") / (name + ".blend")
    # Removing exactly the appended datablocks preserves the character's original
    # scene, its NLA library and any user-authored images or unused materials.
    before = set(bpy.data.user_map())
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        names = list(src.objects)
        action_names = list(src.actions)
        dst.objects, dst.actions = names.copy(), action_names.copy()
    source_ids = set(bpy.data.user_map()) - before
    group = bpy.data.collections.new("Temporary authored prop geometry")
    bpy.context.scene.collection.children.link(group)
    try:
        objects = dict(zip(names, dst.objects))
        for obj in objects.values():
            group.objects.link(obj)
            if obj.type == "ARMATURE":
                obj.animation_data_clear()
                for b in obj.pose.bones:
                    b.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        transform = Matrix.Translation(-Vector(GRIPS[name]))
        if name == "katana":
            # The source edge lies on -X. The grip socket points along +Y.
            transform = Matrix.Rotation(-pi / 2, 4, "Z") @ Matrix.Scale(.82, 4)
        else:
            source_motion(gear, dict(zip(action_names, dst.actions)))
            a = next(o for o in objects.values() if o.type == "ARMATURE")
            drawer = transform @ a.matrix_world @ a.data.bones["Battery"].head_local
            gear.bones["Drawer"] = ("Body", drawer)
        if name == "minigun":
            gear.bones["Rotor"] = ("Body", transform @ Vector((0, .02, -.060)))
        if name in SUPPORT:
            gear.bones["Support"] = ("Body", Vector(SUPPORT[name]))
        deps = bpy.context.evaluated_depsgraph_get()
        for part, obj in objects.items():
            read_part(gear, part, obj, transform, deps)
        if gear.lid_points and name != "grapple":
            # Pinch the near side of the solid rear plate. The rearward bone
            # pivot and the luminous strip are both inside the mechanism.
            low = [min(v[i] for v in gear.lid_points) for i in range(3)]
            high = [max(v[i] for v in gear.lid_points) for i in range(3)]
            point = Vector((low[0] + .006, low[1] + .005, (low[2] + high[2]) / 2))
            gear.bones["DrawerGrip"] = ("Drawer", point)
            # Thumb over the upper lip and fingers over its aft corner. The
            # angled sniper buttplate is presented broadside to the opposite hand.
            slope, cant = {"pistol": (18, 12), "shotgun": (20, 2), "assault_rifle": (19, 3),
                           "sniper": (8, -8), "minigun": (8, 24)}[name]
            gear.rotations["DrawerGrip"] = Euler((slope*pi/180, 0, cant*pi/180)).to_quaternion()
        assert gear.points and ("Tip" if name == "katana" else "Muzzle") in gear.bones
        return gear
    finally:
        bpy.data.collections.remove(group)
        bpy.data.batch_remove(ids=source_ids)


def add_bones(gear, rig, names, matrix):
    focused_object(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone, (parent, position) in gear.bones.items():
        name = names[bone]
        eb = rig.data.edit_bones.get(name)
        if eb is None:
            eb = rig.data.edit_bones.new(name)
            # A fresh edit bone has zero length. Assigning its matrix here
            # silently discards its axis and points all mechanisms vertically.
            eb.head = matrix @ position
            axes = matrix.to_3x3()
            if bone in gear.rotations:
                axes = axes @ gear.rotations[bone].to_matrix()
            eb.tail = eb.head + axes.col[1].normalized() * .026
            eb.align_roll(axes.col[2])
    for bone, (parent, _) in gear.bones.items():
        if parent:
            rig.data.edit_bones[names[bone]].parent = rig.data.edit_bones[names[parent]]
    bpy.ops.object.mode_set(mode="OBJECT")


def add_mesh(gear, rig, names, matrix, collection, label):
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata([matrix @ p for p in gear.points], [], gear.faces)
    for mat in gear.materials.values():
        mesh.materials.append(mat)
    mesh.polygons.foreach_set("material_index", gear.slots)
    mesh.polygons.foreach_set("use_smooth", [True] * len(gear.faces))
    rot = matrix.to_3x3()
    mesh.normals_split_custom_set([(rot @ n).normalized() for n in gear.normals])
    mesh.update()
    obj = bpy.data.objects.new(label, mesh)
    collection.objects.link(obj)
    for bone, indices in gear.groups.items():
        name = names[bone]
        vg = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        vg.add(indices, 1., "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Rigid prop mechanisms", "ARMATURE")
    mod.object = rig
    return obj


def charge_scale(axis, amount):
    scale = [1., 1., 1.]
    scale[axis] = max(.0001, amount)
    return tuple(scale)


def make_embedded_grapple(ctx, gear):
    """Add the skinned holstered/held grapple and its character-mixer reload tracks."""
    rig = ctx.rig
    names = {b: "Grapple" + b for b in gear.bones}
    names["Body"] = "GrappleCarry"
    matrix = rig.data.bones["GrappleCarry"].matrix_local.copy()
    add_bones(gear, rig, names, matrix)
    collection = rig.users_collection[0]
    held = add_mesh(gear, rig, names, matrix, collection, "Grapple · hand mechanism")
    parked = add_mesh(gear, rig, dict.fromkeys(gear.groups, "GrapplePark"),
                      rig.data.bones["GrapplePark"].matrix_local, collection, "Grapple · holstered")
    ctx.refresh()

    def sample(t):
        travel, receiver, cell = gear.reload[round(t * FPS)]
        ctx.move(names["Drawer"], (0, travel, 0))
        for b, (axis, battery) in gear.lamps.items():
            ctx.scale(names[b], charge_scale(axis, cell if battery else receiver))

    times = [n / FPS for n in range(RELOAD_END + 1)]
    ctx.extend_action("Grapple.Reload", RELOAD_END / FPS, sample, times)
    return [held, parked]


def prop_action(rig, label, name, end, sample, frames):
    action = bpy.data.actions.new(label + " · " + name)
    action.use_fake_user = True
    anim = rig.animation_data_create()
    anim.action = action
    for f in frames:
        sample(f)
    # Unrelated clips must be independent: the caller may layer only the rotor
    # over reload, or fire the body clip by itself in a weapon-only preview.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = "LINEAR"
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0, end
    anim.action = None
    track = anim.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.extrapolation = "NOTHING"
    track.mute = True
    return track


def animate_prop(gear, rig):
    tracks = []
    label = gear.name.replace("_", " ").title()
    bones = rig.pose.bones
    def reload(frame):
        travel, receiver, cell = gear.reload[frame]
        drawer = bones["Drawer"]
        drawer.location = (0, travel, 0)
        drawer.keyframe_insert("location", frame=frame, group="Battery drawer")
        for light, (axis, battery) in gear.lamps.items():
            bone = bones[light]
            bone.scale = charge_scale(axis, cell if battery else receiver)
            bone.keyframe_insert("scale", frame=frame, group="Charge glass")
    tracks.append(prop_action(rig, label, "Reload", RELOAD_END, reload, range(RELOAD_END + 1)))
    def fire(frame):
        travel, rise = gear.recoil[frame]
        b = bones["Body"]
        b.rotation_mode = "XYZ"
        b.rotation_euler = (rise, 0, 0)
        b.location = (0, travel, 0)
        b.keyframe_insert("rotation_euler", frame=frame, group="Standalone recoil")
        b.keyframe_insert("location", frame=frame, group="Standalone recoil")
    tracks.append(prop_action(rig, label, "Recoil", len(gear.recoil)-1, fire, range(len(gear.recoil))))
    if gear.name == "minigun":
        for name, end, angle in [
                ("SpinUp", 360, lambda u: 24*pi*(.2*u+.8*u*u)),
                ("Spin", 17, lambda u: 2*pi*u),
                ("SpinDown", 180, lambda u: 10*pi*(2*u-u*u))]:
            def spin(f):
                rotor = bones["Rotor"]
                rotor.rotation_mode = "XYZ"
                rotor.rotation_euler.y = angle(f / end)
                rotor.keyframe_insert("rotation_euler", frame=f, group="Barrel cluster")
            frames = sorted({*range(0, end + 1, 3), end})
            tracks.append(prop_action(rig, label, name, end, spin, frames))
    for b in bones:
        b.matrix_basis = Matrix.Identity(4)
    return tracks


def align_attachment(path):
    # glTF stores mesh data in a Y-up basis, while a joint retains its own
    # local axes. An adapter makes socket.add(prop.scene) align +Y to sights
    # and +Z to the top without any per-engine or per-weapon correction.
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    for scene in doc["scenes"]:
        roots = scene["nodes"]
        scene["nodes"] = [len(doc["nodes"])]
        doc["nodes"].append({"name": "GripSocketAdapter", "children": roots,
                             "rotation": [sqrt(.5), 0, 0, sqrt(.5)]})
    header = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    tail = raw[20+size:]
    path.write_bytes(struct.pack("<4sIII4s", b"glTF", 2, 20+len(header)+len(tail),
                                 len(header), b"JSON") + header + tail)


def build_props(ctx, equipment):
    """Export grip-origin GLBs and retain switchable primary props on the Blender rig."""
    folder = Path(ctx.out) / "props"
    folder.mkdir(exist_ok=True, parents=True)
    master = bpy.data.collections.new("Fitted primary weapons · show one")
    bpy.context.scene.collection.children.link(master)
    scene = bpy.context.scene
    previous_fps, previous_frame = scene.render.fps, scene.frame_current
    scene.render.fps = FPS
    preview = {}
    for key, gear in equipment.items():
        label = key.replace("_", " ").title()
        collection = bpy.data.collections.new("Preview · " + label)
        master.children.link(collection)
        data = bpy.data.armatures.new(label + " mechanism")
        rig = bpy.data.objects.new(label + " · grip", data)
        collection.objects.link(rig)
        names = {b: b for b in gear.bones}
        add_bones(gear, rig, names, Matrix.Identity(4))
        obj = add_mesh(gear, rig, names, Matrix.Identity(4), collection, label + " · surfaces")
        tracks = animate_prop(gear, rig) if gear.reload else []
        focused_object(rig)
        obj.select_set(True)
        scene.frame_set(0)
        bpy.ops.export_scene.gltf(
            filepath=str(folder / (key + ".glb")), export_format="GLB",
            use_selection=True, export_animations=bool(tracks), export_animation_mode="NLA_TRACKS",
            export_frame_range=False, export_force_sampling=True,
            export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
            export_cameras=False, export_lights=False, export_def_bones=False)
        align_attachment(folder / (key + ".glb"))
        if key == "grapple":
            # An independently replaceable GLB accompanies the instance already
            # skinned into the cyborg. Keeping it in the scene would double its glass.
            standalone_actions = [strip.action for track in tracks for strip in track.strips]
            mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.meshes.remove(mesh)
            bpy.data.objects.remove(rig, do_unlink=True)
            bpy.data.armatures.remove(data)
            for action in standalone_actions:
                bpy.data.actions.remove(action)
            bpy.data.collections.remove(collection)
            continue
        rig.parent = ctx.rig
        rig.parent_type = "BONE"
        rig.parent_bone = "grip.R"
        # Blender parents to the end of a bone, while the agreed attachment for
        # engines and IK is the bone origin.
        rig.matrix_basis = Matrix.Translation((0, -ctx.rig.data.bones["grip.R"].length, 0))
        collection.hide_render = collection.hide_viewport = key != "assault_rifle"
        preview[key] = rig
    scene.render.fps = previous_fps
    scene.frame_set(previous_frame)
    focused_object(ctx.rig)
    return preview
