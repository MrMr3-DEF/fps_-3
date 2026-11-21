"""Cyborg upper-body actions. Distances are Blender metres in the rig's space."""

from dataclasses import dataclass
from math import atan2, pi, radians

from mathutils import Euler, Matrix, Quaternion, Vector


def v(x, y, z):
    return Vector((x, y, z))


def turn(x=0, y=0, z=0):
    return Euler(tuple(map(radians, (x, y, z))), "XYZ").to_quaternion()


SIGHTLINE = Quaternion((0, 0, 1), pi)  # Socket +Y sights along character −Y.
R_POLE = v(-.50, .045, 1.05)
L_POLE = v(.50, .035, 1.07)
READY_TIME = 1.6
RELOAD_END = 236 / 120


@dataclass(frozen=True)
class Pose:
    center: Vector
    rotation: Quaternion  # From the weapon's neutral, forward-facing orientation.

    def blend(self, other, weight):
        return Pose(self.center.lerp(other.center, weight),
                    self.rotation.slerp(other.rotation, weight))

    def offset(self, xyz=(0, 0, 0), angles=(0, 0, 0)):
        return Pose(self.center + Vector(xyz), turn(*angles) @ self.rotation)

    @property
    def socket(self):
        return self.rotation @ SIGHTLINE


@dataclass(frozen=True)
class Firearm:
    name: str
    ready: Pose
    support: Vector
    support_roll: float
    recoil_frames: tuple
    recoil_travel: float
    recoil_pitch: float


# The socket origin sits inside the right-hand grip. Offsets below land inside
# the exported foregrip/handguard housing; the minigun's right hand goes OVER
# the carry handle while its left hand cups the stationary motor casing.
FIREARMS = (
    Firearm("Pistol", Pose(v(-.09, -.405, 1.39), turn(1)), v(.075, .010, -.037),
            15, (2, 5, 10), .021, 4.5),
    Firearm("Shotgun", Pose(v(-.07, -.242, 1.34), turn()), v(0, -.285, .032),
            75, (7, 17, 31), .044, 8),
    Firearm("AssaultRifle", Pose(v(-.06, -.237, 1.36), turn()), v(0, -.293, -.007),
            4, (3, 8, 14), .024, 4.5),
    Firearm("Sniper", Pose(v(-.205, -.300, 1.345), turn()), v(0, -.220, .040),
            73, (9, 22, 40), .039, 5.5),
    Firearm("Minigun", Pose(v(-.083, -.272, 1.26), turn()), v(.055, -.082, -.230),
            85, (2, 3, 6), .009, 1.4),
)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def sample(keys, time):
    if time <= keys[0][0]:
        return keys[0][1]
    for (start, a), (end, b) in zip(keys, keys[1:]):
        if time <= end:
            w = smooth((time - start) / (end - start))
            return a.blend(b, w) if isinstance(a, Pose) else a + (b - a) * w
    return keys[-1][1]


def frames(*numbers):
    return [n / 120 for n in numbers]


def sample_times(keys, subdivisions=1):
    times = [k[0] for k in keys]
    return [a + (b - a) * i / subdivisions
            for a, b in zip(times, times[1:]) for i in range(subdivisions)] + times[-1:]


def fingers(ctx, side, closure, trigger=0, support=False, sword=False):
    # Flexion is positive local X on both fitted gloves. Distribute closure
    # progressively down each chain; the index has an independent trigger curl.
    direction = 1 if side == "R" else -1
    for digit, spread, angles in (
        ("thumb", 11, (28, 35, 18)),
        ("index", -3, (49, 63, 39) if support or sword else
         (25 + trigger * 12, 38 + trigger * 17, 17 + trigger * 12)),
        ("middle", 0, (52, 70, 47)),
        ("ring", 1.5, (58, 76, 49)),
        ("pinky", 3, (62, 78, 51)),
    ):
        for segment, angle in enumerate(angles, 1):
            splay = spread * closure * direction if segment == 1 else 0
            ctx.rot(f"{digit}.{segment:02d}.{side}", (angle * closure, 0, splay))


def virtual_palm(ctx, side, center, grasp, prop_socket, pole, origin_offset=None, palm_weight=1.15):
    """Solve the grasp, then mount the prop in its own frame, at the same hand.

    A longitudinal carry bar crosses the palm differently from a pistol grip.
    Keeping the socket a hand child also preserves contact between keyed samples.
    """
    ctx.grip(side, center, grasp, pole, palm_weight)
    bone = "grip." + side
    fitted_point = ctx.bone_matrix(bone).translation
    if origin_offset is not None:
        fitted_point -= origin_offset
    ctx.world_pose(bone, fitted_point, prop_socket)


# Palm frames and bore frames are independent. The right thumb stays above
# the trigger while the raked grip crosses the palm diagonally. On the heavy
# carry bar the fingers point across the bar with the palm facing down.
OVERHAND = Matrix(((0, 0, 1), (0, -1, 0), (1, 0, 0))).to_quaternion()


def align_grasp(ctx, side, center, orientation, max_swivel):
    # Swivel around the local handle, leaving the contact point and thumb side
    # intact. Short pistol grips allow less rotation than the plain sword hilt.
    shoulder = ctx.bone_matrix("upper_arm." + side).translation
    approach = orientation.inverted() @ (center - shoulder)
    angle = atan2(-approach.x, max(.035, approach.y))
    limit = radians(max_swivel)
    return orientation @ Quaternion((0,0,1), max(-limit, min(limit, angle)))


def dominant_grasp(ctx, gun, pose):
    if gun.name == "Minigun":
        return pose.rotation @ OVERHAND @ turn(x=19, z=-18)
    swivel = align_grasp(ctx, "R", pose.center, pose.socket, 50)
    return swivel @ turn(x=25 if gun.name == "Pistol" else 30)


def support_pose(ctx, gun, pose):
    center = pose.center + pose.rotation @ gun.support
    orientation = pose.rotation @ turn(y=gun.support_roll) @ SIGHTLINE
    palm = align_grasp(ctx, "L", center, orientation, 50 if gun.name == "Pistol" else 28)
    return Pose(center, palm @ SIGHTLINE.inverted())


def fit_to_reach(ctx, pose, grasps):
    # One rigid translation keeps BOTH glove contacts fixed on the weapon.
    # Independently clamping each wrist with IK would leave a hovering hand,
    # particularly under the heavy motor or at the end of a sword sweep.
    bones = ctx.rig.data.bones
    bounds = []
    for side, point, grasp in grasps:
        hand = bones["hand." + side].matrix_local
        relative = hand.inverted() @ bones["grip." + side].matrix_local
        wrist = point - (grasp @ relative.to_quaternion().inverted()) @ relative.translation
        shoulder = ctx.bone_matrix("upper_arm." + side).translation
        reach = bones["upper_arm." + side].length + bones["forearm." + side].length - .012
        bounds.append((wrist - shoulder, reach))
    correction = Vector((0, 0, 0))
    for _ in range(8):
        complete = True
        for line, reach in bounds:
            target = line + correction
            if target.length > reach + .00001:
                correction -= target.normalized() * (target.length - reach)
                complete = False
        if complete:
            break
    return Pose(pose.center + correction, pose.rotation)


def fit_gun(ctx, gun, pose):
    off = support_pose(ctx, gun, pose)
    dominant = dominant_grasp(ctx, gun, pose)
    return fit_to_reach(ctx, pose, (("R", pose.center, dominant), ("L", off.center, off.socket)))


def light(gun):
    return gun.name in ("Pistol", "Shotgun")


def ready_pose(gun):
    return gun.ready.offset((-.085, -.015, -.005), (0, -4, 0)) if light(gun) else gun.ready


def free_left(ctx):
    # The free glove waits just outside the holster, clear of the receiver.
    hip = ctx.bone_matrix("Holster.L")
    return Pose(hip.translation + v(.052, -.055, .110), hip.to_quaternion() @ SIGHTLINE.inverted())


def solo_right(ctx, gun, pose, trigger=0):
    grasp = dominant_grasp(ctx, gun, pose)
    pose = fit_to_reach(ctx, pose, (("R", pose.center, grasp),))
    virtual_palm(ctx, "R", pose.center, grasp, pose.socket, R_POLE)
    fingers(ctx, "R", 1, trigger)


def firearm_pose(ctx, gun, pose, trigger=0, closure=1):
    if light(gun):
        solo_right(ctx, gun, pose, trigger)
        off = free_left(ctx)
        ctx.grip("L", off.center, off.socket, L_POLE)
        fingers(ctx, "L", .22)
        return
    pose = fit_gun(ctx, gun, pose)
    virtual_palm(ctx, "R", pose.center, dominant_grasp(ctx, gun, pose), pose.socket, R_POLE)
    fingers(ctx, "R", 1, trigger)
    off = support_pose(ctx, gun, pose)
    ctx.grip("L", off.center, off.socket, L_POLE)
    fingers(ctx, "L", closure, support=True)


def sight_pose(gun):
    # Sniper optics are in the visor. Its long stock clears the right side
    # of the collar without yawing the bore across the reticle.
    if gun.name == "Sniper":
        return gun.ready.offset((-.010, -.008, .030))
    if gun.name == "Minigun":
        return gun.ready.offset((.010, -.010, .055))
    return ready_pose(gun).offset((.025, -.008, .076))


# Present each receiver in the left hand’s workspace. The sniper presents
# its buttplate broadside; the belt-sized minigun motor stays below the wrists.
# The right grip supports the weapon throughout, including the free reach.
SERVICE = {
    "Pistol": ("pistol", Pose(v(-.035,-.345,1.31), turn(20,-12,-30)), v(.045,-.012,.045)),
    "Shotgun": ("shotgun", Pose(v(-.090,-.340,1.34), turn(23,-13,-50)), v(.075,-.030,.025)),
    "AssaultRifle": ("assault_rifle", Pose(v(-.10,-.355,1.315), turn(18,-16,-61)), v(.070,-.025,.038)),
    "Sniper": ("sniper", Pose(v(-.145,-.352,1.31), turn(10,-6,-78)), v(.035,-.062,.037)),
    "Minigun": ("minigun", Pose(v(-.075,-.310,1.36), turn(8,-16,-44)), v(.080,-.048,-.008)),
}


def manual_reload(ctx, gun, gear):
    _, presentation, clearance = SERVICE[gun.name]
    base, end = ready_pose(gun), RELOAD_END
    rest_curl = .22 if light(gun) else 1
    gun_keys = [(0, base), (8/120, base), (44/120, presentation),
                (192/120, presentation), (228/120, base), (end, base)]
    target = gear.bones["DrawerGrip"][1]
    drawer_grasp = gear.rotations["DrawerGrip"]

    def pose_at(t):
        f = t * 120
        pose = sample(gun_keys, t)
        off = free_left(ctx) if light(gun) else support_pose(ctx, gun, pose)
        frame = min(236, round(f))
        at_lid = pose.center + pose.socket @ (target + v(0, gear.reload[frame][0], 0))
        lid = Pose(at_lid, pose.socket @ drawer_grasp @ SIGHTLINE.inverted())
        reach = sample([(0, 0), (8/120, 0), (44/120, 1), (198/120, 1), (229/120, 0), (end, 0)], t)
        left = off.blend(lid, reach)
        # Arc the open glove outside the receiver, with the full extraction
        # corridor kept straight while the fingers have possession of the lid.
        left = left.offset(clearance * (4 * reach * (1 - reach)))
        right = dominant_grasp(ctx, gun, pose)
        fitted = fit_to_reach(ctx, pose, (("R", pose.center, right), ("L", left.center, left.socket)))
        translation = fitted.center - pose.center
        virtual_palm(ctx, "R", fitted.center, right, fitted.socket, R_POLE)
        ctx.grip("L", left.center + translation, left.socket, L_POLE)
        fingers(ctx, "R", 1)
        curl = sample([(0,rest_curl), (8/120,rest_curl), (19/120,.18), (42/120,.18), (51/120,.74),
                       (192/120,.74), (198/120,.19), (218/120,.19), (231/120,rest_curl), (end,rest_curl)], t)
        fingers(ctx, "L", curl, support=True)
        body_look(ctx, 10 * reach, -6 * reach)

    frames = sorted({*range(0, 237, 3), 8, 19, 42, 44, 51, 95, 151, 192, 198, 218, 228, 229, 231, 236})
    ctx.action(gun.name + ".Reload", end, pose_at, [f / 120 for f in frames])


def inspect_path(gun):
    base = ready_pose(gun)
    # Show the two sides by pitching the elbows and rolling the forearms.
    # A long stock and a heavy motor need smaller arcs than the short pistol.
    yaw = {"Pistol": 59, "Shotgun": 30, "AssaultRifle": 27,
           "Sniper": 17, "Minigun": 23}[gun.name]
    presented = base.offset((-.023, .001, .057), (-12, -14, yaw))
    reverse = base.offset((-.040, .012, .038), (5, 24, yaw * .58))
    return [(0, base), (.6, presented), (1, presented), (1.72, reverse),
            (2.03, reverse), (2.81, presented), (3.2, presented), (3.8, base)]


def body_look(ctx, pitch, yaw=0, roll=0):
    ctx.world_rot("head", turn(pitch, roll, yaw))


def firearm_actions(ctx, gun, gear):
    base = ready_pose(gun)
    for name, pose in (("Ready", base), ("Aim", sight_pose(gun))):
        def breathe(t, pose=pose, aim=name == "Aim"):
            weight = sample([(0, 0), (READY_TIME / 2, 1), (READY_TIME, 0)], t)
            firearm_pose(ctx, gun, pose.offset((0, 0, (.0018 if aim else .005) * weight)))
        ctx.action(f"{gun.name}.{name}", READY_TIME, breathe, [0, READY_TIME / 2, READY_TIME])

    peak, halfway, end = gun.recoil_frames
    recoil = list(zip(frames(0, peak, halfway, end), [0, 1, .47, 0]))

    def fire(t):
        w = sample(recoil, t)
        firearm_pose(ctx, gun, base.offset((0, gun.recoil_travel * w, .006 * w),
                                            (-gun.recoil_pitch * w, 0, 0)), trigger=w)
    ctx.action(f"{gun.name}.Fire", end / 120, fire, sample_times(recoil))

    if light(gun):
        # Sparse right-arm clips remain available for independent hand layers.
        for name, pose in (("Ready", base), ("Aim", sight_pose(gun))):
            ctx.action(gun.name + ".OneHand" + name, READY_TIME,
                       lambda _, p=pose: solo_right(ctx, gun, p), [0, READY_TIME])
        def solo_fire(t):
            weight = sample(recoil, t)
            solo_right(ctx, gun, base.offset((0, gun.recoil_travel * weight, .006 * weight),
                                             (-gun.recoil_pitch * weight, 0, 0)), weight)
        ctx.action(gun.name + ".OneHandFire", end / 120, solo_fire, sample_times(recoil))
    else:
        lowered = Pose(v(-.30, -.15, 1.13), turn(53 if gun.name == "Sniper" else 61, -9, 8))
        ctx.action(gun.name + ".Lowered", READY_TIME,
                   lambda _: solo_right(ctx, gun, lowered), [0, READY_TIME])

    manual_reload(ctx, gun, gear)
    inspect = inspect_path(gun)

    def inspect_sample(t):
        w = sample([(0, 0), (.6, 1), (3.2, 1), (3.8, 0)], t)
        body_look(ctx, 10 * w, -5 * w, -3 * w)
        firearm_pose(ctx, gun, sample(inspect, t))
    ctx.action(f"{gun.name}.Inspect", 3.8, inspect_sample, sample_times(inspect, 2))

    low = base.offset((-.05, .035, -.105), (32, -4, -5))
    for name, start, finish in (("Withdraw", base, low), ("Equip", low, base)):
        def switch(t, start=start, finish=finish):
            firearm_pose(ctx, gun, start.blend(finish, smooth(t / .15)))
        ctx.action(f"{gun.name}.{name}", .15, switch, [0, .05, .10, .15])

    if gun.name == "Minigun":
        for name, duration, start, end in (("SpinUp", 3.0, 0, 1), ("SpinDown", 1.5, 1, 0)):
            def spin(t, start=start, end=end, duration=duration):
                w = start + (end - start) * smooth(t / duration)
                firearm_pose(ctx, gun, base.offset((.008*w, .013*w, -.019*w), (-2*w, 0, 0)),
                             trigger=w)
            ctx.action("Minigun." + name, duration, spin, [0, duration / 2, duration])


def blade_pose(xyz, yaw, from_upright, edge_turn):
    return Pose(Vector(xyz), turn(z=yaw) @ turn(x=from_upright) @ turn(z=edge_turn))


SWORD_READY = blade_pose((-.066, -.348, 1.255), -15, 37, 10)
SWORD_HELD = blade_pose((-.170, -.273, 1.386), -35, 28, 28)
SWORD_RAISED = blade_pose((-.225, -.265, 1.473), -69, 73, 72)


def forward_cut():
    pose = blade_pose((-.025, -.390, 1.408), 0, 85, 88)
    # The fitted tip curves 14.7 cm behind the straight hilt axis. Cross the
    # actual tip through the sightline at impact while keeping the edge leading.
    tip = pose.rotation @ v(0, .147, 1.065).normalized()
    return Pose(pose.center, tip.rotation_difference(v(0, -1, 0)) @ pose.rotation)


SWORD_CONTACT = forward_cut()
SWORD_FOLLOW = blade_pose((.115, -.314, 1.310), 64, 101, 100)


def sword_grasps(ctx, pose):
    axis = pose.rotation @ v(0,0,1)
    upper, lower = pose.center + axis * .045, pose.center - axis * .068
    # Both hands wrap the same hilt, with the thumbs facing the guard. Fingers
    # can roll around the hilt throughout the arc without rotating the edge.
    def wrap(side, target):
        elbow = R_POLE if side == "R" else L_POLE
        approach = (target - elbow).normalized()
        # Carry a neutral wrap around the blade's tilt. A pure projection of
        # the elbow onto the hilt plane flips when the sword points at it.
        neutral = v(.62 if side == "R" else -.65, -.78, 0).normalized()
        across = v(0,0,1).rotation_difference(axis) @ neutral
        inward = across.cross(axis).normalized()
        frame = Matrix((inward, across, axis)).transposed().to_quaternion()
        local = frame.inverted() @ approach
        swivel = -.88 * local.x
        tilt = .46 * local.z
        palm = frame @ turn(z=swivel*180/pi, x=tilt*180/pi)
        # At a fast crossover the hilt can point along the forearm. Keep
        # both hands on their stations while relaxing the wrist around the hilt.
        for _ in range(2):
            ctx.grip(side, target, palm, elbow, palm_weight=.70)
            wrist = ctx.bone_matrix("hand." + side).translation
            knuckles = ctx.bone_matrix("middle.01." + side).translation - wrist
            forearm = wrist - ctx.bone_matrix("forearm." + side).translation
            angle = knuckles.angle(forearm)
            if angle <= radians(55):
                break
            swing = knuckles.rotation_difference(forearm)
            palm = Quaternion().slerp(swing, (angle-radians(55))/angle) @ palm
        return palm
    right, left = wrap("R", upper), wrap("L", lower)
    return (("R", upper, right), ("L", lower, left))


def fit_sword(ctx, pose):
    return fit_to_reach(ctx, pose, sword_grasps(ctx, pose))


def pommel_pose(ctx, pose):
    _, center, grasp = sword_grasps(ctx, pose)[1]
    return Pose(center, grasp @ SIGHTLINE.inverted())


def sword_pose(ctx, pose):
    pose = fit_sword(ctx, pose)
    (_, upper, right), (_, lower, left) = sword_grasps(ctx, pose)
    virtual_palm(ctx, "R", upper, right, pose.socket, R_POLE, upper - pose.center, palm_weight=.70)
    fingers(ctx, "R", .94, sword=True)
    ctx.grip("L", lower, left, L_POLE, palm_weight=.70)
    fingers(ctx, "L", .94, sword=True)


def sword_actions(ctx):
    def path(name, keys, body_twist=None, look=None, subdivisions=2):
        def animate(t):
            if body_twist:
                ctx.world_rot("chest", turn(z=sample(body_twist, t)))
            if look:
                body_look(ctx, sample(look, t))
            sword_pose(ctx, sample(keys, t))
        ctx.action("Katana." + name, keys[-1][0], animate, sample_times(keys, subdivisions))

    ready, held = SWORD_READY, SWORD_HELD
    path("Ready", [(0, ready), (.8, ready.offset((0, 0, .005))), (1.6, ready)])
    aimed = ready.offset((.010, -.012, .055), (-4, 0, 4))
    path("Aim", [(0, aimed), (.8, aimed.offset((0, 0, .002))), (1.6, aimed)])
    path("Charge", [(0, ready), (.45, ready.blend(held, .52)), (1.65, ready.blend(held, .86)),
                    (3, held)])
    path("ChargedHold", [(0, held), (.5, held.offset((0, 0, .003))), (1, held)])
    path("Cancel", [(0, held), (.16, ready)])
    for name, initial, contact, finish, hold in (
        ("Swing", ready, .20, .30, .30), ("ChargedSwing", held, .14, .18, .35)
    ):
        windup = .065 if name == "ChargedSwing" else .095
        keys = [(0, initial), (windup, SWORD_RAISED), (contact, SWORD_CONTACT),
                (finish, SWORD_FOLLOW)]
        if hold > finish:
            keys.append((hold, SWORD_FOLLOW))
        keys.append((.6, ready))
        twist = [(0, 0), (windup, -13), (contact, 0), (finish, 15), (.6, 0)]
        path(name, keys, body_twist=twist, subdivisions=7)
    shown = blade_pose((-.112, -.361, 1.336), -28, 31, 40)
    shown_back = blade_pose((-.071, -.349, 1.307), -8, 48, -22)
    path("Inspect", [(0, ready), (.6, shown), (1, shown), (1.85, shown_back),
                     (2.15, shown_back), (3.2, shown), (3.8, ready)],
         look=[(0, 0), (.6, 5), (3.2, 5), (3.8, 0)])
    low = blade_pose((-.219, -.231, 1.12), -35, 72, 10)
    path("Withdraw", [(0, ready), (.15, low)])
    path("Equip", [(0, low), (.15, ready)])


GRAPPLE_AIM = Pose(v(.245, -.480, 1.390), turn())


def hold_grapple(ctx, pose, trigger=0):
    ctx.grip("L", pose.center, pose.socket, L_POLE)
    fingers(ctx, "L", 1, trigger)


def grapple_handoff(ctx, name, starting_hand, is_sword):
    # The dominant hand keeps its weapon action while the left hand leaves
    # and later returns to its particular foregrip.
    from_light = name in ("Pistol", "Shotgun")
    times = [0, .065, .140, .205, .245, .345, .425, .47, .52]
    duration = times[-1]

    def draw(t):
        # Brace the torso relative to the moving pelvis during the handoff.
        # Otherwise a hover lean or a sword twist moves the wrist off the
        # hip-mounted receiver at the instant ownership changes.
        ctx.rot("spine", (0, 0, 0))
        ctx.rot("chest", (0, 0, 0))
        matrix = ctx.bone_matrix("Holster.L")
        hip = Pose(matrix.translation, matrix.to_quaternion() @ SIGHTLINE.inverted())
        approach = hip.offset((.037, -.035, .087))
        # The holster is open along its -Y axis. Keep the orientation fixed
        # for this entire extraction distance before turning the muzzle.
        clear = hip.offset(matrix.to_quaternion() @ v(0, -.25, 0))
        midpoint = clear.blend(GRAPPLE_AIM, .47).offset((.026, -.040, .004))
        origin = starting_hand()
        withdraw = origin.blend(approach, .28).offset((.015 if from_light else .075, .016, -.010))
        hand = sample(list(zip(times, [origin, withdraw, approach, hip, hip, clear,
                                       midpoint, GRAPPLE_AIM, GRAPPLE_AIM])), t)
        ctx.grip("L", hand.center, hand.socket, L_POLE)
        closure = sample([(0, .22 if from_light else .94 if is_sword else 1), (.065, .34), (.140, .12),
                          (.205, .23), (.245, 1), (duration, 1)], t)
        # Match the trigger finger at both ends of each handoff. The holster
        # supports the weight until the fingers close in the parked position.
        fingers(ctx, "L", closure, support=not from_light and t < .14, sword=is_sword and t < .14)

    dense = sample_times(list(zip(times, times)), 2)
    ctx.action("Grapple.Draw." + name, duration, draw, dense)
    ctx.action("Grapple.Return." + name, duration, lambda t: draw(duration - t),
               sorted(duration - s for s in dense))


def grapple_actions(ctx):
    for gun in FIREARMS:
        def starting_hand():
            return free_left(ctx) if light(gun) else support_pose(ctx, gun, fit_gun(ctx, gun, gun.ready))
        grapple_handoff(ctx, gun.name, starting_hand, False)
    grapple_handoff(ctx, "Katana", lambda: pommel_pose(ctx, fit_sword(ctx, SWORD_READY)), True)
    recoil = list(zip(frames(0, 2, 6, 11), [0, 1, .47, 0]))

    ctx.action("Grapple.Held", 1, lambda _: hold_grapple(ctx, GRAPPLE_AIM), [0, 1])

    def launch(t):
        w = sample(recoil, t)
        hold_grapple(ctx, GRAPPLE_AIM.offset((0, .022*w, .004*w), (-4*w, 0, 0)), w)
    ctx.action("Grapple.Fire", 11 / 120, launch, sample_times(recoil))

    pull = GRAPPLE_AIM.offset((-.025, -.026, .035), (-7, 0, 4))
    keys = [(0, GRAPPLE_AIM), (.15, pull)]
    ctx.action("Grapple.Latch", .15, lambda t: hold_grapple(ctx, sample(keys, t)),
               sample_times(keys, 2))
    tense = [(0, pull), (.4, pull.offset((0, .010, -.005))), (.8, pull)]
    ctx.action("Grapple.Pull", .8, lambda t: hold_grapple(ctx, sample(tense, t)),
               sample_times(tense, 2))
    back = [(0, pull), (.08, pull.offset((.012, .048, -.025), (-6, 0, 0))), (.25, GRAPPLE_AIM)]
    ctx.action("Grapple.Retract", .25, lambda t: hold_grapple(ctx, sample(back, t)),
               sample_times(back, 2))
    miss = [(0, GRAPPLE_AIM), (.10, GRAPPLE_AIM.offset((.018, .035, -.020), (6, 0, -3))),
            (.25, GRAPPLE_AIM)]
    ctx.action("Grapple.Miss", .25, lambda t: hold_grapple(ctx, sample(miss, t)),
               sample_times(miss, 2))
    down = GRAPPLE_AIM.offset((.045, .032, -.012), (53, 12, -12))
    reload = [(0, GRAPPLE_AIM), (9/120, GRAPPLE_AIM), (38/120, GRAPPLE_AIM.blend(down,.78)),
              (51/120, down), (192/120, down), (205/120, GRAPPLE_AIM.blend(down,.77)),
              (224/120, GRAPPLE_AIM.blend(down,.13)), (RELOAD_END, GRAPPLE_AIM)]
    ctx.action("Grapple.Reload", RELOAD_END, lambda t: hold_grapple(ctx, sample(reload, t)),
               sample_times(reload, 2))


def build_combat(ctx, gear):
    for gun in FIREARMS:
        firearm_actions(ctx, gun, gear[SERVICE[gun.name][0]])
    sword_actions(ctx)
    grapple_actions(ctx)
    for name, pitch, yaw in (("Up", -30, 0), ("Down", 32, 0), ("Left", 0, 54),
                             ("Right", 0, -54)):
        def look(t, pitch=pitch, yaw=yaw):
            w = smooth(t / .25)
            ctx.world_rot("neck", turn(pitch * .32 * w, 0, yaw * .33 * w))
            body_look(ctx, pitch * w, yaw * w)
        ctx.action("Look." + name, .25, look, [0, .0625, .125, .1875, .25])
