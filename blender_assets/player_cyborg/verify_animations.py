"""Re-import and verify the portable animation pack. Pass -- --preview to render its contact sheet."""

import math
import re
import sys
import tempfile
from pathlib import Path

import blf
import bpy
import imbuf
import OpenImageIO as oiio
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
FPS = 120
GUNS = {"Pistol": "pistol", "Shotgun": "shotgun", "AssaultRifle": "assault_rifle",
        "Sniper": "sniper", "Minigun": "minigun", "Grapple": "grapple", "Katana": "katana"}
POSE_PATH = re.compile(r'^pose\.bones\["(.+)"\]\.(location|rotation_quaternion|scale)$')
IDENTITY = Matrix.Identity(4)


class ImportedRig:
    def __init__(self, path):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path), bone_heuristic="BLENDER", disable_bone_shape=True)
        objs = set(bpy.data.objects) - before
        self.rig = next(o for o in objs if o.type == "ARMATURE")
        self.mesh = next(o for o in objs if o.type == "MESH")
        self.root = self.rig
        while self.root.parent and self.root.parent in objs:
            self.root = self.root.parent
        self.root_rest = self.root.matrix_world.copy()
        self.bones = self.rig.pose.bones
        self.clips = {}
        self.duration = {}
        animation = self.rig.animation_data
        if animation:
            for track in animation.nla_tracks:
                strip = track.strips[0]
                action = strip.action
                bag = action.layers[0].strips[0].channelbag(strip.action_slot)
                self.clips[track.name] = []
                for curve in bag.fcurves:
                    match = POSE_PATH.match(curve.data_path)
                    if not match:
                        raise ValueError(f"{path.name}: unsupported imported track {curve.data_path}")
                    joint, prop = match.groups()
                    self.clips[track.name].append((joint, prop, curve.array_index, curve))
                self.duration[track.name] = (action.frame_range[1] - action.frame_range[0]) / FPS
            self.rig.animation_data_clear()

    def pose(self, layers):
        # Evaluate imported F-curves in layer order. Clearing first keeps a prior
        # clip from leaving a planted foot, live plume or held grapple in the shot.
        for bone in self.bones:
            bone.matrix_basis = IDENTITY
            if bone.name.startswith(("FX.", "Burst.")) or bone.name == "GrappleCarry":
                bone.scale = (0.00001,) * 3
        for clip, seconds in layers:
            for joint, prop, index, curve in self.clips[clip]:
                getattr(self.bones[joint], prop)[index] = curve.evaluate(seconds * FPS)

    def point(self, joint):
        return (self.rig.matrix_world @ self.bones[joint].matrix).translation


def refresh():
    bpy.context.view_layer.update()


def place(body, props, layers, weapon=None, mechanism=()):
    body.pose(layers)
    refresh()
    for name, prop in props.items():
        prop.mesh.hide_render = name != weapon
        if name == weapon:
            prop.pose(mechanism)
            # Blender re-imports GLB geometry into Z-up space. Undo that file
            # basis at the boundary, keeping the exported socket adapter active.
            socket = body.rig.matrix_world @ body.bones["grip.R"].matrix
            prop.root.matrix_world = socket @ Matrix.Rotation(-math.pi / 2, 4, "X") @ prop.root_rest
    refresh()


def close(a, b, tol, label):
    error = (a - b).length if isinstance(a, Vector) else abs(a - b)
    if error > tol:
        raise ValueError(f"{label}: error {error:.5f} > {tol:.5f}")
    return error


def verify(body, props):
    for (name, prop), last in zip(((n, props[n]) for n in list(GUNS)[:6]), (10, 31, 14, 40, 6, 11)):
        close(prop.duration["Reload"], 236 / FPS, 0.0002, name + " drawer duration")
        close(prop.duration["Recoil"], last / FPS, 0.0002, name + " recoil duration")
        close(body.duration[name + ".Reload"], prop.duration["Reload"], 0.0002, name + " paired reload")
        close(body.duration[name + ".Fire"], prop.duration["Recoil"], 0.0002, name + " paired fire")
    close(body.duration["Pilot.Board"], .45, .001, "boarding")
    for clip in ("Katana.Swing", "Katana.ChargedSwing"):
        close(body.duration[clip], .6, .001, clip)
    close(body.duration["Katana.Charge"], 3, .001, "full charge")
    close(body.duration["Sniper.Inspect"], 3.8, .001, "inspection")

    for action in ("Ready", "Aim"):
        place(body, props, [("Idle.Armed", 0), ("Sniper." + action, 0)], "Sniper")
        muzzle = props["Sniper"].rig.matrix_world @ props["Sniper"].bones["Muzzle"].matrix
        forward = muzzle.to_quaternion() @ Vector((0, 1, 0))
        close(forward.angle(Vector((0, -1, 0))), 0, math.radians(2), "sniper bore " + action)
    # A zero-length edit bone can silently rotate the exported drawer sideways.
    sniper = props["Sniper"]
    sniper.root.matrix_world = IDENTITY
    values = []
    for f in (0, 120, 192, 236):
        sniper.pose([("Reload", f / FPS)])
        refresh()
        values.append(sniper.point("Drawer"))
    opened = values[1] - values[0]
    if opened.y >= -.10 or max(abs(opened.x), abs(opened.z)) > .002:
        raise ValueError(f"Sniper battery must slide rearwards along the bore: {tuple(opened)}")
    for p in values[2:]:
        close(p, values[0], .001, "sniper closed drawer")

    # The moving target is the external thumb/finger contact on the captive
    # rear lid. Checking only the Drawer pivot or the action duration cannot
    # detect an off hand that stays on the foregrip through the entire reload.
    max_lid_gap = 0
    for name in list(GUNS)[:5]:
        prop = props[name]
        if prop.bones['DrawerGrip'].parent.name != 'Drawer':
            raise ValueError(f'{name} contact does not follow its drawer')
        for base in (('Idle.Armed', 0), ('Hover.Left', .3)):
            def reload_at(f):
                place(body, props, [base, (name + '.Reload', f/FPS)], name, [('Reload', f/FPS)])
            reload_at(0)
            support = body.point('grip.L')
            for f in (51, 61, 80, 95, 119, 151, 167, 182, 192):
                reload_at(f)
                glove, lid = body.point('grip.L'), prop.point('DrawerGrip')
                max_lid_gap = max(max_lid_gap, close(glove, lid, .003, f'{name} drawer glove at {f}'))
                hand_q = (body.rig.matrix_world @ body.bones['grip.L'].matrix).to_quaternion()
                lid_q = (prop.rig.matrix_world @ prop.bones['DrawerGrip'].matrix).to_quaternion()
                angle = hand_q.rotation_difference(lid_q).angle
                close(min(angle, math.tau-angle), 0, math.radians(2), name + ' lid grip orientation')
            reload_at(236)
            close(body.point('grip.L'), support, .002, name + ' recovered support grip')
            if (body.point('grip.L') - prop.point('DrawerGrip')).length < .10:
                raise ValueError(name + ' support glove did not release the lid')

    run_nodes = {bone for bone, _, _, _ in body.clips["Run.Forward"]}
    aiming_nodes = {bone for bone, _, _, _ in body.clips["AssaultRifle.Ready"]}
    drawing_nodes = {bone for bone, _, _, _ in body.clips["Grapple.Draw.AssaultRifle"]}
    if run_nodes & aiming_nodes or any(b.endswith(".R") for b in drawing_nodes):
        raise ValueError("Locomotion or left-hand draw overrides a primary-weapon joint")

    # Verify the authored pickup itself with the neutral leg. Locomotion moves
    # the thigh independently; the live avatar's two-joint solve closes that gap.
    for phase, transfer in (("Draw", .225), ("Return", .295)):
        body.pose([("Grapple." + phase + ".AssaultRifle", transfer)])
        refresh()
        holster, hand = (body.bones[k].matrix for k in ("Holster.L", "grip.L"))
        close(holster.translation, hand.translation, .01, phase + " rest pickup position")
        angle = holster.to_quaternion().rotation_difference(hand.to_quaternion()).angle
        close(min(angle, abs(math.tau - angle)), 0, math.radians(3), phase + " rest pickup orientation")

    max_support = max_grapple = 0.0
    for base, t in (("Idle.Armed", 0), ("Run.Forward", .24), ("Hover.Forward", .45)):
        for name in ("Pistol", "Shotgun"):
            for action, elapsed in (("Ready", .4), ("Fire", .03), ("Aim", .5), ("Inspect", 1.8),
                                    ("Withdraw", .1), ("Equip", .1)):
                clips = [(base, t), (name + "." + action, elapsed)]
                for overlay in ([], [("Grapple.Held", .75)]):
                    place(body, props, clips + overlay, name)
                    station = "Body" if name == "Pistol" else "Support"
                    if (props[name].point(station) - body.point("grip.L")).length < .12:
                        raise ValueError(f"{name}.{action} free glove intersects the primary")
                    if overlay:
                        close(body.bones["GrappleCarry"].scale.x, 1, .001, "held receiver visible")
                        close(body.bones["GrapplePark"].scale.x, .00001, .001, "parked receiver hidden")
                        close(body.point("GrappleCarry"), body.point("grip.L"), .001, "held receiver")
        for name in ("AssaultRifle", "Sniper", "Minigun"):
            place(body, props, [(base, t), (name + ".Ready", 0)], name)
            max_support = max(max_support, close(props[name].point("Support"), body.point("grip.L"),
                                                  .018, name + " support hand"))
        for phase in (0, .14, .224, .226, .245, .345, .52):
            place(body, props, [(base, t), ("AssaultRifle.Ready", 0), ("Grapple.Draw.AssaultRifle", phase)],
                  "AssaultRifle")
            held = phase >= .225
            active, anchor = ("GrappleCarry", "grip.L") if held else ("GrapplePark", "Holster.L")
            for b, visible in (("GrappleCarry", held), ("GrapplePark", not held)):
                close(body.bones[b].scale.x, 1 if visible else .00001, .001, b + " visibility")
            max_grapple = max(max_grapple, close(body.point(active), body.point(anchor),
                                                 .001, base + " grapple contact at " + str(phase)))
        for action, transfer in (("Draw", .225), ("Return", .295)):
            place(body, props, [(base, t), ("AssaultRifle.Ready", 0),
                                (f"Grapple.{action}.AssaultRifle", transfer)], "AssaultRifle")
            holster, hand = (body.bones[k].matrix for k in ("Holster.L", "grip.L"))
            # During a stride the runtime follows the independently animated thigh.
            # This export still must describe a reachable gesture close to its rest target.
            close(holster.translation, hand.translation, .16, base + " live grip correction reach")
        place(body, props, [(base, t), ("AssaultRifle.Ready", 0), ("Grapple.Return.AssaultRifle", .52)],
              "AssaultRifle")
        close(body.point("GrapplePark"), body.point("Holster.L"), .001, "seated grapple")
        close(props["AssaultRifle"].point("Support"), body.point("grip.L"), .018, "return to rifle")

    for name, cross, finish in (("Swing", .20, .30), ("ChargedSwing", .14, .18)):
        tips = []
        for t in (.065 if name == "ChargedSwing" else .095, cross, finish):
            place(body, props, [("Katana." + name, t)], "Katana")
            tips.append(props["Katana"].point("Tip"))
        if not (tips[0].x < tips[1].x < tips[2].x and tips[1].y < tips[0].y and tips[1].y < tips[2].y):
            raise ValueError("Katana tip misses the forward, right-to-left arc: " + name)

    for clip, t, lit, burst in (("Idle.Armed", 0, False, False), ("Hover.Hold", .28, True, False),
                                 ("Hover.Shutdown", .29, False, False), ("Jump.PowerTakeoff", .10, True, True)):
        body.pose([(clip, t)])
        refresh()
        for kind, active in (("FX.", lit), ("Burst.", burst)):
            for b in (b for b in body.bones if b.name.startswith(kind)):
                if (max(b.scale) > .15) != active:
                    raise ValueError(f"{clip} left {b.name} at {tuple(b.scale)}")

    # The wrist-to-knuckle line measures the visible bend without relying on
    # a particular rest quaternion or the intentionally offset prop sockets.
    for name, clip, frames in [(n,n+'.Reload',(0,24,51,95,151,192,209,236)) for n in list(GUNS)[:5]] + [
            ('Katana', 'Katana.ChargedSwing', (0,8,12,17,21,31,42,72)),
            ('AssaultRifle','Grapple.Draw.AssaultRifle',(0,16,27,42,50,62)),
            ('Pistol','Grapple.Draw.Pistol',(0,16,27,42,50,62)),
            ('Pistol','Pistol.Inspect',(0,72,206,337,456)),
            ('Shotgun','Shotgun.Inspect',(0,72,206,337,456))]:
        for f in frames:
            body.pose([(clip, f/FPS)])
            refresh()
            for side in ('L','R'):
                wrist = body.point('hand.' + side)
                forearm = wrist - body.point('forearm.' + side)
                palm = body.point('middle.01.' + side) - wrist
                if forearm.angle(palm) > math.radians(88):
                    raise ValueError(f'{clip} wrist folded back at {f} ({side})')

    mesh = body.mesh
    boot_indices = {}
    for side in ("L", "R"):
        group = mesh.vertex_groups["foot." + side].index
        boot_indices[side] = [v.index for v in mesh.data.vertices if any(g.group == group and g.weight > .99 for g in v.groups)]
    for direction in ("Forward", "Backward", "Left", "Right"):
        clip = "Run." + direction
        for phase in (0, .10, .20, .39, .50, .60, .70, .89, 1):
            body.pose([(clip, phase * body.duration[clip])])
            refresh()
            obj = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            sole = {side: min((obj.matrix_world @ obj.data.vertices[i].co).z for i in indices)
                    for side, indices in boot_indices.items()}
            if phase in (.39, .89):
                if min(sole.values()) < .015:
                    raise ValueError(f"{clip} missing flight phase at {phase}: {sole}")
            else:
                stance = "L" if phase < .5 or phase == 1 else "R"
                close(sole[stance], 0, .009, f"{clip} grounded {stance} sole at {phase}")
    # mechaMount.test.ts sweeps the physical cabin against these wrapper-space
    # limits. Fit the visor and test all seated armor vertices in that same box.
    body.pose([("Pilot.Seated", 0)])
    refresh()
    obj = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    seated = [obj.matrix_world @ v.co for v in obj.data.vertices]
    glass = next(i for i, slot in enumerate(obj.material_slots) if slot.material.name.startswith("Visor_Smoked_Glass"))
    visor = [seated[v].z for p in obj.data.polygons if p.material_index == glass for v in p.vertices]
    offset = .5 - (min(visor) + max(visor)) / 2
    close(offset, -.847, .005, "Ironmaw seated visor offset")
    if not all(-.60 <= -v.x <= .60 and -1.10 <= v.z + offset <= 1.10 and -.74 <= v.y <= .60 for v in seated):
        raise ValueError("Seated character leaves Ironmaw's pilot clearance envelope")
    print(f"Verified {len(body.clips)} re-imported actions, 7 props. Sniper drawer {abs(opened.y):.3f} m. "
          f"Support/grapple/lid maximum gaps {max_support:.4f}/{max_grapple:.4f}/{max_lid_gap:.4f} m.", flush=True)


W, H = 360, 248
CELLS = [
    ("Forward run", [("Run.Forward", .075), ("AssaultRifle.Ready", 0)], "AssaultRifle", (), (-3,-4,1.5), (0,-.08,.95), 2.26),
    ("Power jump · burst", [("Jump.PowerTakeoff", .105)], None, (), (2.8,4,1.4), (0,0,.71), 2.52),
    ("Hover · four outlets", [("Hover.Hold", .35)], None, (), (2.5,4,-.50), (0,0,.78), 2.30),
    ("Pilot · seated", [("Pilot.Seated", 0)], None, (), (-4,-1,1.6), (0,-.10,.77), 1.83),
    ("Pistol · holder inspection", [("Pistol.Inspect", .86), ("Grapple.Held", 0)], "Pistol", (), (-.09,-.22,1.73), (-.115,-.43,1.43), .61),
    ("Sniper · battery out", [("Sniper.Reload", 1.18)], "Sniper", [("Reload", 1.18)], (.85,-2.4,1.95), None, .62),
    ("Sniper · battery seated", [("Sniper.Reload", 1.62)], "Sniper", [("Reload", 1.62)], (.85,-2.4,1.95), None, .62),
    ("Minigun · spin-up", [("Minigun.SpinUp", 1.4)], "Minigun", [("SpinUp", 1.4)], (-2.1,-3,1.8), (0,-.50,1.29), 1.48),
    ("Rifle · support hand", [("AssaultRifle.Ready", 0)], "AssaultRifle", (), (2.8,-1.7,1.7), (.10,-.18,1.22), 1.39),
    ("Grapple · draw", [("AssaultRifle.Ready", 0), ("AssaultRifle.Lowered", 0), ("Grapple.Draw.AssaultRifle", .33)], "AssaultRifle", (), (2.8,-1.7,1.7), (.10,-.18,1.22), 1.39),
    ("Grapple · held after release", [("AssaultRifle.Lowered", 0), ("Grapple.Held", .5)], "AssaultRifle", (), (2.35,-2.6,1.78), (.10,-.18,1.22), 1.39),
    ("Grapple · return", [("AssaultRifle.Ready", 0), ("Grapple.Return.AssaultRifle", .52)], "AssaultRifle", (), (2.8,-1.7,1.7), (.10,-.18,1.22), 1.39),
    ("Katana · wind-up", [("Katana.ChargedSwing", .065)], "Katana", (), (0,-4,1.8), (0,-.1,1.35), 2.14),
    ("Katana · contact", [("Katana.ChargedSwing", .14)], "Katana", (), (2.0,-3.3,1.8), (0,-.22,1.35), 2.14),
    ("Katana · follow-through", [("Katana.ChargedSwing", .18)], "Katana", (), (0,-4,1.8), (0,-.1,1.35), 2.14),
    ("Katana · recovery", [("Katana.ChargedSwing", .60)], "Katana", (), (0,-4,1.8), (0,-.1,1.35), 2.14),
]


def studio(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new("Preview environment")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.20, .26, .33, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .75
    for pos, power, size, tint in (((-3,-4,5), 680, 3.2, (1,.90,.76)),
                                   ((3,2,4), 840, 2.0, (.66,.86,1)),
                                   ((3,-3,1.8), 290, 2.8, (.8,.92,1))):
        bpy.ops.object.light_add(type="AREA", location=pos)
        obj = bpy.context.object
        obj.data.energy, obj.data.shape, obj.data.size, obj.data.color = power, "DISK", size, tint
        obj.rotation_euler = (Vector((0,0,1.0)) - obj.location).to_track_quat("-Z","Y").to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    camera.data.type = "ORTHO"
    return camera


def contact_sheet(body, props, camera, cells, title, output):
    scene = bpy.context.scene
    gap, caption, top = 12, 26, 48
    width = 4 * (W + gap) + gap
    height = top + math.ceil(len(cells)/4) * (H + caption + gap) + gap
    with tempfile.TemporaryDirectory(prefix="cyborg-reimport-") as directory:
        tmp = Path(directory)
        board = oiio.ImageBuf(oiio.ImageSpec(width, height, 3, oiio.UINT8))
        oiio.ImageBufAlgo.fill(board, (.078,.106,.133))
        labels = []
        for i, (label, layers, weapon, prop_layers, eye, target, span) in enumerate(cells):
            place(body, props, layers, weapon, prop_layers)
            if target is None:
                lid = props[weapon].point("DrawerGrip")
                target = lid.lerp(props[weapon].point("Body"), .22)
            camera.location = eye
            camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z","Y").to_euler()
            # Perspective rays originate at the visor. An orthographic framing
            # this close would put part of its near plane inside the breastplate.
            camera.data.type = "PERSP" if label == "Pistol · holder inspection" else "ORTHO"
            camera.data.lens = 17
            camera.data.clip_start = .016
            camera.data.ortho_scale = span * W / H
            if camera.data.type == "PERSP":
                prop = props[weapon]
                center = prop.point("Body").lerp(prop.point("Muzzle"), .44)
                center.z -= .04
                camera.rotation_euler = (center - camera.location).to_track_quat("-Z","Y").to_euler()
                refresh()
                obj = prop.mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
                projected = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(c)) for c in obj.bound_box]
                extent = max(max(abs(p.x-.5), abs(p.y-.5)) for p in projected)
                camera.data.lens *= min(1., .42 / extent)
            frame = tmp / f"view-{i}.png"
            scene.render.filepath = str(frame)
            bpy.ops.render.render(write_still=True)
            x = gap + i % 4 * (W + gap)
            y = top + i // 4 * (H + caption + gap)
            oiio.ImageBufAlgo.paste(board, x, y, 0, 0, oiio.ImageBuf(str(frame)))
            labels.append((label, x + 3, y + H + 19, 16))
        base = tmp / "board.png"
        board.write(str(base))
        buf = imbuf.load(str(base))
        with blf.bind_imbuf(0, buf):
            for label, x, y, size in [(title, gap, 32, 24), *labels]:
                blf.size(0, size)
                blf.position(0, x, height - y, 0)
                blf.color(0, .92, .95, .96, 1)
                blf.draw_buffer(0, label)
        imbuf.write(buf, filepath=str(base))
        oiio.ImageBuf(str(base)).write(str(output))


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    character = ImportedRig(HERE / "player_cyborg_animations.glb")
    props = {key: ImportedRig(HERE / "props" / (slug + ".glb")) for key, slug in GUNS.items()}
    verify(character, props)
    if "--preview" in sys.argv:
        camera = studio(bpy.context.scene)
        contact_sheet(character, props, camera, CELLS, "Cyborg animation library", HERE / "preview_animations.jpg")
        closeups = []
        for name in list(GUNS)[:5]:
            for f, stage in ((95, "drawer pulled"), (192, "lid seated")):
                closeups.append((name + " · " + stage, [(name+".Reload", f/FPS)], name,
                                 [("Reload", f/FPS)], (1.3,-1.9,2.4), None, .49))
        closeups.extend([("Hover · side", [("Hover.Forward", .22)], None, (), (3,1,1.52), (0,0,.62), 2.6),
                         ("Hover · rear", [("Hover.Hold", .30)], None, (), (1.5,4,.58), (0,0,.62), 2.6)])
        contact_sheet(character, props, camera, closeups, "Battery reloads and hover exhaust", HERE / "preview_reloads.jpg")
