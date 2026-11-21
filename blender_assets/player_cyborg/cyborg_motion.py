"""In-place body and thruster actions for the articulated pilot."""

from dataclasses import dataclass, fields, replace
from math import ceil, cos, degrees, pi, radians, sin, sqrt, tau

from mathutils import Euler, Quaternion, Vector


SIDES = (("L", 1), ("R", -1))
NO_FLAME = 0.00001
IDENTITY = Quaternion()


def rotation(x=0, y=0, z=0):
    return Euler(tuple(map(radians, (x, y, z))), "XYZ").to_quaternion()


def lerp(a, b, weight):
    return a + (b - a) * weight


@dataclass(frozen=True)
class Body:
    """A foot gives outward, forward and up metres, then toe pitch and optional turn yaw in degrees."""

    height: float = -0.035
    lateral: float = 0
    forward: float = 0
    pitch: float = 0
    bank: float = 0
    yaw: float = 0
    spine: float = 0
    left: tuple = (0, 0, 0, 0)
    right: tuple = (0, 0, 0, 0)


def blend_pose(a, b, weight):
    values = {}
    for field in fields(Body):
        first, second = getattr(a, field.name), getattr(b, field.name)
        if isinstance(first, tuple):
            values[field.name] = tuple(lerp(x, y, weight) for x, y in zip(first, second))
        else:
            values[field.name] = lerp(first, second, weight)
    return Body(**values)


def sample_keys(keys, t, mix):
    for (begin, first), (end, second) in zip(keys, keys[1:]):
        if t <= end:
            u = max(0, (t - begin) / (end - begin))
            return mix(first, second, u * u * (3 - 2 * u))
    return keys[-1][1]


def samples(duration, beats=(), rate=24):
    steps = max(1, ceil(duration * rate))
    return sorted(set([duration * index / steps for index in range(steps + 1)] + list(beats)))


class BodyRig:
    def __init__(self, ctx):
        self.ctx = ctx
        self.bones = ctx.rig.data.bones
        self.rest = {b.name: b.matrix_local.to_quaternion() for b in self.bones}
        self.head = {b.name: b.head_local.copy() for b in self.bones}
        self.length = {b.name: b.length for b in self.bones}

    def orient(self, name, desired, parent=IDENTITY):
        # Rotations below are specified in model axes. The baked channel must
        # undo the parent's motion and preserve this particular bone's rest roll.
        basis = self.rest[name].inverted() @ parent.inverted() @ desired @ self.rest[name]
        self.ctx.rot(name, tuple(map(degrees, basis.to_euler("XYZ"))))

    def translate(self, name, model_offset):
        self.ctx.move(name, tuple(self.rest[name].inverted() @ model_offset))

    def legs(self, pose):
        pelvis_rest = self.head["pelvis"]
        displacement = Vector((pose.lateral, -pose.forward, pose.height))
        pelvis_rotation = rotation(pose.pitch, pose.bank, pose.yaw)
        self.translate("pelvis", displacement)
        self.orient("pelvis", pelvis_rotation)
        self.orient("spine", rotation(pose.spine))
        for side, sign in SIDES:
            thigh, shin, foot = (name + "." + side for name in ("thigh", "shin", "foot"))
            foot_pose = pose.left if side == "L" else pose.right
            outward, forward, lift, toe_down = foot_pose[:4]
            foot_yaw = foot_pose[4] if len(foot_pose) == 5 else 0
            hip = pelvis_rest + displacement + pelvis_rotation @ (self.head[thigh] - pelvis_rest)
            # Tilting from the heel or toe also lifts the ankle. Rotating a
            # boot about a stationary ankle would push its sole through the floor.
            sole_pivot = 0.19 if toe_down > 0 else 0.085
            ankle_lift = sole_pivot * sin(radians(abs(toe_down)))
            target = self.head[foot] + Vector((sign * outward, -forward, lift + ankle_lift))
            span = target - hip
            axis = span.normalized()
            upper, lower = self.length[thigh], self.length[shin]
            distance = max(abs(upper - lower) + 1e-5, min(upper + lower - 1e-5, span.length))
            ankle = hip + axis * distance
            # Choose the forward knee solution, with a little outward rotation
            # so the segmented knee plates track over their respective boots.
            pole = Vector((0.075 * sign, -1, 0.08))
            bend = (pole - axis * pole.dot(axis)).normalized()
            along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
            knee = hip + axis * along + bend * sqrt(max(0, upper * upper - along * along))
            upper_rotation = (self.head[shin] - self.head[thigh]).rotation_difference(knee - hip)
            lower_rotation = (self.head[foot] - self.head[shin]).rotation_difference(ankle - knee)
            self.orient(thigh, upper_rotation, pelvis_rotation)
            self.orient(shin, lower_rotation, upper_rotation)
            self.orient(foot, rotation(toe_down, 0, foot_yaw), lower_rotation)

    def arms(self, upper, elbow, spread, head=0, asymmetry=0):
        # These full-body poses play only when the hands have no equipped weapon.
        # Each delta here is relative to its parent, expressed in the model's rest axes.
        self.orient("neck", rotation(head * 0.4))
        self.orient("head", rotation(head * 0.6))
        for side, sign in SIDES:
            self.orient("upper_arm." + side, rotation(-upper - sign * asymmetry, -sign * spread))
            self.orient("forearm." + side, rotation(-elbow, 0, -sign * min(14, elbow * 0.2)))
            self.orient("hand." + side, rotation(min(14, elbow * 0.15)))

    def jets(self, power=0, phase=0, sideways=0, forward=0, burst=None):
        for side, sign in SIDES:
            for outlet, nominal_length, bias in (("Back", 0.86, 0.35), ("Boot", 1.0, 0.79)):
                name = "FX." + outlet + "." + side
                flicker = 1 + 0.065 * sin(tau * (phase * 3 + bias + sign * 0.12))
                steering = 1 + sign * sideways * 0.1
                width = max(NO_FLAME, sqrt(max(0, power)) * (0.95 + 0.05 * flicker))
                length = max(NO_FLAME, power * nominal_length * flicker * steering)
                self.ctx.scale(name, (width, length, width))
                self.orient(name, rotation(forward * 8, sideways * 7))
                if burst is not None:
                    core = "Burst." + outlet + "." + side
                    core_width = max(NO_FLAME, sqrt(max(0, burst)))
                    self.ctx.scale(core, (core_width, max(NO_FLAME, nominal_length * burst), core_width))


READY = Body()
RISING = Body(-0.025, pitch=8, spine=-7, left=(0.045, -0.19, 0.085, 29), right=(0.075, 0.21, 0.35, 8))
APEX = Body(-0.035, pitch=5, spine=-5, left=(0.07, -0.20, 0.19, 24), right=(0.09, 0.18, 0.39, 3))
FALL = Body(-0.025, pitch=-5, spine=5, left=(0.055, 0.035, 0.035, -8), right=(0.105, -0.15, 0.29, 24))
HOVER = Body(-0.03, pitch=3, spine=-2, left=(0.03, 0.03, 0.105, 1), right=(0.025, -0.04, 0.115, 3))
PULL = Body(-0.02, pitch=16, spine=4, bank=5, left=(0.01, 0.13, 0.21, 14), right=(0.04, -0.21, 0.11, 23))
SEATED = Body(-0.37, pitch=-5, spine=6, left=(0.015, 0.37, 0.025, -1), right=(0.015, 0.37, 0.025, -1))
KNEES_FLEXED = Body(-0.18, pitch=8, spine=8, left=(0.005, 0.026, 0, 0), right=(0, -0.025, 0, 0))


# Stance covers 30% of each cycle, followed by recovery and a flight window
# before the opposite boot lands. All four clips touch down on the same phase.
RUN_STRIDE = {"Forward": (0, .66), "Backward": (0, -.54),
              "Left": (.43, 0), "Right": (-.43, 0)}
RUN_STANCE = .30
RUN_DURATION = .50


def run_pose(direction, phase):
    lateral, forward = RUN_STRIDE[direction]
    feet = []
    for (_, sign), offset in zip(SIDES, (0, .5)):
        p = (phase + offset) % 1
        if p < RUN_STANCE:
            contact = p / RUN_STANCE
            travel = .5 - contact
            lift = 0
            toe = -5 * max(0, 1 - contact / .25) ** 2 + 23 * max(0, (contact - .54) / .46) ** 2
        else:
            swing = (p - RUN_STANCE) / (1 - RUN_STANCE)
            # Match the planted foot's velocity at lift-off and touchdown.
            travel = -.5 + swing - sin(tau * swing) / (tau * RUN_STANCE)
            lift = (.245 if forward else .185) * sin(pi * swing) ** 2 * (1.2 - .4 * swing)
            toe = lerp(23, -5, swing) + 17 * sin(tau * swing) * sin(pi * swing)
        roll = 1 if forward > 0 else -.56 if forward < 0 else .30
        # The feet pass in separate fore/aft lanes on a lateral run.
        stagger = .170 * sign if lateral else 0
        feet.append((sign * lateral * travel, forward * travel + stagger, lift, toe * roll))
    compression = cos(tau * (2 * phase - .24))
    return Body(-.079 - .034 * compression, lateral=.020 * cos(tau * phase),
                forward=.018 if forward > 0 else 0,
                pitch=10 if forward > 0 else 3 if forward < 0 else 6,
                bank=(5 * lateral / .43) + 2.5 * cos(tau * phase),
                yaw=5 * cos(tau * phase), spine=-4, left=feet[0], right=feet[1])


def turn_pose(sign, phase):
    feet = []
    for (_, side), offset in zip(SIDES, (0, 0.5)):
        p = (phase + offset) % 1
        # The stance boot travels along an arc as the caller turns the avatar.
        if p < 0.56:
            angle = radians(16 * (1 - 2 * p / 0.56))
            lift = 0
        else:
            swing = (p - 0.56) / 0.44
            angle = radians(-16 * cos(pi * swing))
            lift = 0.10 * sin(pi * swing) ** 2
        radius = 0.20
        feet.append((radius * (cos(angle) - 1), -sign * side * radius * sin(angle),
                     lift, 0, sign * degrees(angle)))
    return Body(-0.047, lateral=0.033 * sin(tau * phase), yaw=sign * (4 + 3 * cos(tau * phase)),
                left=feet[0], right=feet[1])


def build_motion(ctx):
    rig = BodyRig(ctx)

    def cycle(name, duration, body, jets=None, arms=None, rate=24):
        def pose(t):
            phase = t / duration
            rig.legs(body(phase))
            rig.jets(*(jets(phase) if jets else ()))
            if arms:
                rig.arms(*arms(phase))
        ctx.action(name, duration, pose, samples(duration, rate=rate))

    def staged(name, keys, jets=None, arms=None):
        duration = keys[-1][0]
        def pose(t):
            rig.legs(sample_keys(keys, t, blend_pose))
            rig.jets(*(jets(t) if jets else ()))
            if arms:
                rig.arms(*sample_keys(arms, t, lambda a, b, u: tuple(lerp(x, y, u) for x, y in zip(a, b))))
        beats = [t for t, _ in keys]
        if arms:
            beats.extend(t for t, _ in arms)
        ctx.action(name, duration, pose, samples(duration, beats))

    def breath(p):
        amplitude = sin(tau * p)
        return replace(READY, height=READY.height + 0.004 * amplitude, spine=1.1 * amplitude)

    cycle("Idle.Unarmed", 2.5, breath, arms=lambda p: (4 + sin(tau * p), 8, 0, -1, 0), rate=10)
    cycle("Idle.Armed", 2.5, breath, rate=10)
    for direction in ("Forward", "Backward", "Left", "Right"):
        cycle("Run." + direction, RUN_DURATION, lambda p, d=direction: run_pose(d, p), rate=120)
    for direction, sign in (("Left", 1), ("Right", -1)):
        cycle("Turn." + direction, 0.8, lambda p, s=sign: turn_pose(s, p))

    # Physics has already launched the player by the first sample. Lead with the
    # driving knee while the trailing boot rolls off its toe.
    push_off = Body(-0.045, pitch=6, spine=-5, left=(0.015, -0.07, 0.015, 17), right=(0.035, 0.08, 0.10, 4))
    staged("Jump.Takeoff", [(0, push_off), (0.075, RISING)])
    burst = [(0, 0), (0.045, 0.15), (0.095, 1.45), (0.18, 1.12), (0.28, 0.24), (0.34, 0)]
    core = [(0, 0), (0.055, 0), (0.09, 1.55), (0.14, 1.15), (0.22, 0.1), (0.26, 0), (0.34, 0)]
    staged("Jump.PowerTakeoff", [(0, READY), (0.07, KNEES_FLEXED),
                                 (0.105, push_off), (0.19, RISING), (0.34, RISING)],
           jets=lambda t: (sample_keys(burst, t, lerp), t * 2, 0, 0, sample_keys(core, t, lerp)))

    def air_pose(pose, phase):
        drift = sin(tau * phase)
        left, right = pose.left, pose.right
        return replace(pose, bank=pose.bank + 2 * drift,
                       left=(left[0], left[1] - .025 * drift, left[2] + .018 * drift, left[3] + 4 * drift),
                       right=(right[0], right[1] + .025 * drift, right[2] - .023 * drift, right[3] - 3 * drift))

    for name, air in (("Rise", RISING), ("Apex", APEX), ("Fall", FALL)):
        cycle("Jump." + name, 1.1, lambda p, pose=air: air_pose(pose, p), rate=16)
    landing_contact = replace(FALL, left=(0.055, 0.035, 0, 0))
    staged("Jump.Land", [(0, landing_contact), (0.085, KNEES_FLEXED), (0.16, replace(KNEES_FLEXED, height=-0.20)),
                         (0.3, replace(READY, height=-0.05)), (0.38, READY)])

    ignite = [(0, 0), (0.055, 0.28), (0.12, 1.18), (0.24, 0.88)]
    staged("Hover.Ignite", [(0, FALL), (0.08, replace(FALL, height=-0.06, pitch=1)), (0.24, HOVER)],
           jets=lambda t: (sample_keys(ignite, t, lerp), t / 0.24))
    for name, strafe, forward in (("Hold", 0, 0), ("Forward", 0, 1), ("Backward", 0, -1),
                                  ("Left", 1, 0), ("Right", -1, 0)):
        def hover_body(p, side=strafe, drive=forward):
            sway = sin(tau * p)
            return replace(HOVER, pitch=3 + drive * 11 + sway,
                           bank=side * 10 + sway * 1.4, spine=-2 - drive * 3,
                           left=(0.03, 0.03 - 0.12 * drive, 0.105 + 0.04 * side + 0.01 * sway, 2 + drive * 5),
                           right=(0.025, -0.04 - 0.12 * drive, 0.115 - 0.04 * side - 0.01 * sway, 3 + drive * 5))
        cycle("Hover." + name, 0.8, hover_body,
              jets=lambda p, s=strafe, f=forward: (0.88 + 0.04 * sin(tau * p), p, s, f), rate=30)
    brake = [(0, 0.88), (0.12, 1.27), (0.23, 1.10), (0.36, 0.88)]
    staged("Hover.Brake", [(0, HOVER), (0.13, replace(HOVER, pitch=-12, spine=3,
                                                     left=(0.045, 0.14, 0.15, -3), right=(0.035, 0.07, 0.14, -4))),
                          (0.36, HOVER)], jets=lambda t: (sample_keys(brake, t, lerp), t / 0.36))
    shutdown = [(0, 0.88), (0.06, 0.55), (0.15, 0.08), (0.21, 0), (0.29, 0)]
    staged("Hover.Shutdown", [(0, HOVER), (0.1, APEX), (0.29, FALL)],
           jets=lambda t: (sample_keys(shutdown, t, lerp), t / 0.29))

    for name, tug in (("PullFixed", 2.0), ("PullMoving", 5.0)):
        cycle("Grapple." + name, 0.8,
              lambda p, amp=tug: replace(PULL, pitch=PULL.pitch + amp * sin(tau * p),
                                         bank=5 + amp * sin(tau * p), yaw=amp * sin(tau * p)), rate=18)
    staged("Grapple.ReleaseBody", [(0, PULL), (0.11, replace(APEX, pitch=-1, yaw=-4)), (0.28, FALL)])

    loose, controls = (4, 8, 0, 0, 0), (35, 38, 4, 0, 0)
    step_in = replace(KNEES_FLEXED, left=(0, 0.17, 0.16, 1), yaw=7, bank=5)
    staged("Pilot.Board", [(0, PULL), (0.14, step_in), (0.31, replace(SEATED, height=-0.30, pitch=8)),
                           (0.45, SEATED)], arms=[(0, (19, 15, 3, 0, 12)), (0.17, (42, 24, 9, 8, 6)),
                                                 (0.45, controls)])
    cycle("Pilot.Seated", 2.0, lambda p: replace(SEATED, spine=6 + sin(tau * p)),
          arms=lambda p: (35, 38 + sin(tau * p), 4, 0, 0), rate=10)
    staged("Pilot.Exit", [(0, SEATED), (0.20, replace(SEATED, pitch=11, spine=8)), (0.44, step_in),
                          (0.66, READY)], arms=[(0, controls), (0.28, (21, 45, 10, 5, 6)), (0.66, loose)])
    staged("Pilot.Eject", [(0, SEATED), (0.09, replace(SEATED, pitch=-13, spine=-6)), (0.19, APEX),
                           (0.38, FALL)], arms=[(0, controls), (0.13, (16, 42, 20, -4, 9)),
                                                (0.38, (3, 16, 14, 0, 2))])

    def hit(t):
        # Sparse torso recoil overlays an armed pose while the legs keep moving.
        kick = sample_keys([(0, 0), (0.055, 1), (0.13, -0.22), (0.26, 0)], t, lerp)
        rig.orient("spine", rotation(-7 * kick, 4 * kick, -5 * kick))
        rig.orient("head", rotation(2 * kick, -2 * kick, 3 * kick))
    ctx.action("Hit", 0.26, hit, samples(0.26, (0.055, 0.13)))

    collapse = Body(-0.45, forward=-0.035, pitch=-24, bank=9, yaw=-7, spine=-11,
                    left=(0.06, 0.10, 0.012, -9), right=(0.04, -0.03, 0.045, 5))
    fallen = Body(-0.74, forward=-0.06, pitch=-76, bank=8, yaw=-7, spine=-4,
                  left=(0.13, 0.51, 0, -6), right=(0.04, 0.62, 0, -12))
    staged("Death", [(0, READY), (0.09, replace(READY, pitch=-10, yaw=-4)), (0.29, collapse),
                     (0.56, fallen), (0.64, replace(fallen, height=-0.725, spine=-1)), (0.78, fallen), (1.0, fallen)],
           arms=[(0, loose), (0.10, (4, 28, 16, -3, 12)), (0.32, (17, 48, 23, 10, 18)),
                 (0.56, (11, 20, 33, 2, 6)), (0.78, (7, 17, 30, 4, 4)), (1, (7, 17, 30, 4, 4))])
    staged("Spawn", [(0, replace(KNEES_FLEXED, height=-0.21, pitch=12)), (0.13, KNEES_FLEXED),
                     (0.39, Body(-0.022, pitch=-2)), (0.54, READY)],
           arms=[(0, (14, 27, 8, 10, 5)), (0.31, (5, 12, 4, 1, 2)), (0.54, loose)])
