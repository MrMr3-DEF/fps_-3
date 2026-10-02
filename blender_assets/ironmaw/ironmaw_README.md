# Ironmaw — mechanical rig and animations

Updated 1 October 2026. The silver/rust pixel materials, hollow helmet,
opening armor and recessed interior are preserved. No game integration was added.
The permitted design reset remains unused.

## Deliverables

- `ironmaw_siege_robot.blend`: editable model, mechanical rig, eleven baked actions,
  packed textures and a separate review studio. Saved closed, standing, red eye, with `RocketFire` selected.
- `ironmaw_siege_robot.glb`: model only; 20 meshes, 1,724 triangles, 3 materials,
  one skeleton, 159 bones (26 controls and 133 rigid physical pieces), eight clips.
- `ironmaw_animation_previews/{clip}.mp4`: 768 × 768 previews with eye cues.
  The five original clips are 24 fps. `Walk.mp4` shows four cycles at 30 fps;
  `TurnLeft.mp4` and `TurnRight.mp4` each show nine cycles and a full 360° turn
  over 12 seconds at 30 fps, with a fixed camera and marked floor.
- `ironmaw_animation_previews/walk_validation.json`: gait timing, loop continuity,
  planted-foot checks, independent targeting and unchanged-action results.
- `ironmaw_animation_previews/rig_validation.json` and
  `glb_animation_validation.json`: rig and roundtrip results.
- `ironmaw_animation_previews/two_stage_collapse_validation.json`: current Death/Mount
  flat contacts, rigid link lengths, fall samples and unchanged-action checks.
- `ironmaw_previews/` contains historical model/opening reviews from before rigging.

## Forearm rocket launcher (Blender)

`RocketFire` is a **3.0 s action, f1–73 at 24 fps**. Ironmaw straightens its
upper body slightly, lowers its anatomical left arm, and raises its right forearm to point
forward with a bent elbow. The dorsal forearm cassette rises, holds for one
simulated shot, recoils, retracts, and returns exactly to closed standing.
Feet and root stay fixed; the head and cabin stay closed. The eye retains its
selected red/blue state. There are no rockets, smoke or game behavior in this revision.

| Frames | Event |
| --- | --- |
| 1–19 | Prepare the bent-elbow firing pose; torso straightens by 4°. |
| 19–31 | Cassette rises 0.75 m along its local Y. |
| 31–37 | Aim hold. **Shot cue f37 / 1.500 s**. |
| 37–47 | Sharp recoil peaks f39, then the arm recovers. |
| 49–61 | Cassette retracts into its recess. |
| 61–73 | Recover to the exact normal standing pose. |

The launcher is on **Ironmaw’s anatomical right arm**, which is **viewer’s left
in a head-on view**. The original rig labels are preserved: this is
`M_Forearm_L`, with physical parent `PART_Forearm_L_02`. The former launcher on
`M_Forearm_R` has been removed and its original forearm surface restored.
The launcher object/control suffix `_R` denotes the anatomical side.

`M_RocketCassette_R` has a **0.70 × 0.70 m square front**, is 0.75 m long,
and rises 0.75 m to expose its full front with 0.05 m clearance underneath.
The centered twelve-sided silver barrel has a 0.60 m outer diameter, a 0.52 m
bore and a shallow 0.02 m projecting rim. The bore stops **0.30 m** inside
the cassette at a **closed, matte textured black back wall**; it does not pass
through the cassette. The front, sides, rear, recess and guides use textured black metal: the existing packed
pixel atlas is mapped with varying UV coordinates, converted to grayscale,
and tinted neutral black. The exterior top cap retains silver/rust armor.
No new texture files are needed. The model gains **230 triangles**, two rigid
mesh objects and one bone, below the 300-triangle budget.

The deep recess fits within the original forearm shell. Cassette-to-slot gaps
are 15 mm; housing-to-cuff/pad clearance is 10 mm. Longer sliding guide stems
retain at least 0.05 m sleeve engagement throughout the action and at least
0.03 m floor clearance. The retracted cap sits flush with the forearm surface.

`CTRL_RocketSlide_R` uses local Y travel **0–0.75 m** and is parented to
`PART_Forearm_L_02`, so it follows the shell during `FinalDeath` as well as
normal arm movement. Every new vertex has one rigid weight of 1.0. For later
projectiles, the bone stores `muzzle_rest_position` and `muzzle_rest_direction`
in rig rest coordinates; apply its skin-deformation matrix and rig world
transform to obtain the moving muzzle. Its metadata identifies the anatomical
right arm, physical parent and travel. `RocketFire` stores `shot_frame=37` and
`shot_seconds=1.5`. These are authoring references for a later projectile system.

Run the embedded `IRONMAW_CONTROLS.py`, then `select_clip('RocketFire')`, or select
it in the Action Editor. Selecting another clip clears the launcher slide, including
when leaving a shot mid-deployment. The animation is baked; live leg IK stays off.
The GLB remains the existing eight-clip version. The Blender export helper can
export the revised model and all eleven actions when a future export is requested.

`rocket_fire_validation.json` checks 289 quarter-frame samples, foot/root stability,
rigid arm lengths, actual square/barrel dimensions, guide engagement,
exact start/end pose agreement, muzzle alignment, and cassette
clearance against the surrounding model. All ten earlier actions have identical
keyframe hashes and sampled evaluated poses. The cassette follows the shell during
breakup. `RocketFire_front.mp4` and `RocketFire_side.mp4` are 24 fps previews;
they include the held final endpoint sample (73 frames, about 3.04 s).
`RocketFire_front_031.png` and `RocketFire_side_031.png` show deployment;
`RocketFire_031.png` is the three-quarter view; `rocket_launcher_compatibility.jpg` reviews
walking, punching, defeat, mounting, destruction and the standing head fold.
`RocketFire_launcher_detail.png` shows the square face, silver rim and closed
black back wall straight along the muzzle axis.

## Standing head fold (Blender)

`HeadOpen` folds only the helmet backward while Ironmaw stands still.
`HeadClose` is its exact reverse. Both run from **f1 to f25 at 24 fps (1.0 s)**.
The helmet rotation is taken from `Death` f105–129, reaching **−105° local X**
on `CTRL_Helmet_Rear`. The eye travels with the helmet and retains the selected
red or blue state. Chest doors, shoulder flaps, torso, arms and legs remain in
the closed standing reference pose. There is no collapse or root movement.

Run the embedded `IRONMAW_CONTROLS.py`, then `select_clip('HeadOpen')` or
`select_clip('HeadClose')`. Alternatively select the rig and choose either action
in the Action Editor. Play with Space. Both endpoint poses match for a seamless
open/close handoff; hold the last frame to keep the head open or closed.

These two new actions are saved in the Blender source. The existing GLB remains
the eight-clip version; the Blender export helper can export all eleven if requested.
`head_fold_validation.json` records 97 samples per action, including quarter-frame
samples: zero movement in non-head bone matrices, an exact reverse match, and
unchanged keyframe hashes for all eight original actions. `HeadOpen_001.png`,
`HeadOpen_013.png` and `HeadOpen_025.png` provide standing pose reviews.

## Clips and cues

Blender stays at 24 fps so existing actions retain their keys and timing.
Frame 1 is authored time 0; time = (frame − 1) / 24. The five legacy GLB clips
retain their existing 1/24-second leading offset. `Walk`, `TurnLeft` and `TurnRight` are exported from
t=0 to t=1.333333 seconds, without an added lead-in or end hold. Legacy preview
videos include the final held sample; the Walk video repeats four cycles with
no duplicate boundary frames. Turning previews also omit duplicate boundary frames.

| Clip | Duration | Main moments |
| --- | ---: | --- |
| `TurnLeft` | 1.333 s loop | Left foot contact f1, right f17. Runtime heading **−30°/s**; **−40° per cycle**. |
| `TurnRight` | 1.333 s loop | Left foot contact f1, right f17. Runtime heading **+30°/s**; **+40° per cycle**. |
| `Walk` | 1.333 s loop | Left contact **f1 / 0 s**, right contact **f17 / 0.667 s**, left again f33. 90 total contacts/minute. Equivalent to 40 frame intervals per cycle at 30 fps. |
| `Stomp` | 3.0 s | Left foot lifts; right foot stays planted. Impact **f39 / 1.583 s**, compression f42, then recoil and settle. Standing f73. |
| `HeavyPunch` | 3.5 s | Right fist winds up through f29. Impact **f35 / 1.417 s**, follow-through f40. Left arm lowers and swings slightly back with a relaxed elbow, then recovers. Standing f85. |
| `Death` | 6.0 s | Knees hit **f40 / 1.625 s**, compress f42 and recover by f46. Forward fall accelerates over f48–64; flat fists hit **f64 / 2.625 s**. Shoulders/elbows compress through f67, recoil and settle by f78. Cabin opens f80–129; final pose holds through f145. |
| `Mount` | 7.0 s | Exact Death endpoint, held f1–9. Armor closes f9–45. Push onto the fists f47–65; left foot plants by **f81 / 3.333 s**. Fists stay planted through f90, then release progressively as weight transfers onto the foot. The right foot comes underneath f111–138. Arms and final foot placement recover through f167; stable standing f169. |
| `FinalDeath` | 5.0 s | Failure anticipation through f29. Breakup **f30 / 1.208 s**; all 133 physical pieces separate with independently baked trajectories and rotations. Ends scattered and settled. |

The game first aligns an initially defeated enemy torso with its legs at 90 degrees/s, then plays the full Death clip. For piloted destruction only, it skips FinalDeath anticipation and starts at the GLB breakup time **1.25 s** (the legacy export includes its leading frame); the living pilot is released from the pre-breakup cockpit pose. The authored clips are unchanged.

The resting pose has both knees grounded and both broad fist soles flush with
z=0. The cabin leans forward 28°, with the hands close to the body and the entrance
clear. The forward fall uses increasing speed through impact rather than easing
to a stop above the floor. Knee and fist impacts are separated by one second.
After the fist impact, the hands and knee pads remain fixed while the upper body
compresses and settles. Fists stay planted through Mount f90, then release as
weight transfers onto the first planted foot. Minor local armor/joint overlaps
are accepted for a natural posture; rigid limb lengths and ground contacts are
preserved. Stomp, HeavyPunch and FinalDeath keyframes are unchanged.

Stomp and HeavyPunch have no horizontal root movement. Their feet remain planted
where intended; local pelvis movement supplies weight transfer. Stomp, HeavyPunch
and Mount end in the same closed standing reference pose. Death f145 and Mount f1
match across the complete skeleton to floating-point precision.

## Walk movement matching

`Walk` is in place: it contains no horizontal root motion. Its intended full
stride (one left contact to the next left contact) is **2.0 m**; alternating step
length is **1.0 m**. Move the robot forward at **1.5 m/s** at normal playback speed.
The asset faces Blender −Y, which exports as Three.js +Z under the model root.
Use the robot's own facing direction after applying game rotation.

Each foot supports the robot for 60% of its cycle (0.8 seconds). During support,
it travels backward relative to the robot at 1.5 m/s, cancelling the matching
forward game movement. This keeps the supporting foot planted in world space.
The remaining 40% is a smooth return with up to 0.32 m of clearance. The pelvis
has 0.07 m of vertical travel and 0.21 m of lateral weight transfer; the contact
compression is restrained, with modest opposite arm swing and relaxed elbows.

For a uniform model scale `s` and animation playback multiplier `r`, use forward
speed `1.5 * s * r` m/s. The contact cadence becomes `90 * r` per minute. Avoid
changing movement speed independently of clip playback if planted contacts matter.
`Walk.mp4` demonstrates four cycles with this forward translation and a following
camera over a marked floor. That translation and floor are preview-only.

`Walk` has no animation tracks for `CTRL_Root` or `CTRL_WaistYaw` in the GLB.
The game can control overall facing/translation and independent local-Z waist
rotation without the walking clip overwriting them. Armor stays closed; Walk
has no eye-color or emission cues and works with the selected red or blue state.

## Turning and heading matching

`TurnLeft` and `TurnRight` stay centered and contain no global heading motion.
Apply **30 degrees/second** (π/6 radians/second) to the robot's game-facing
transform: negative for left, positive for right, around Three.js +Y when using
this asset's native +Z forward. In Blender this is negative/positive around +Z.
Each 1.333-second loop advances overall heading by 40°, or 20° per alternating
step. A full revolution takes 12 seconds. At playback multiplier `r`, multiply
the heading rate by `r`; uniform model scaling does not change angular speed.

The feet each support for 60% of the cycle. Their local position and orientation
counter-rotate during support, so the entire sole stays fixed after the matching
overall heading is applied. Swing uses a 0.24 m lift and a short arc around the
turn center. Pelvis movement is limited to ±0.085 m sideways and 0.054 m vertically,
with slight knee compression after contact. The arms use small 2.5° counter-swings.
Armor is closed and eye state is independent.

Neither turning clip keys `CTRL_Root` or `CTRL_WaistYaw`. Overall rotation belongs
to the game-facing transform; unrestricted upper-body targeting still belongs to
`CTRL_WaistYaw`. When holding an absolute world aim while the robot turns, convert
that aim into the current root's local space before assigning waist yaw.

### Blender turning review

Run `IRONMAW_CONTROLS.py`, then `select_clip('TurnLeft')` and
`set_turn_preview(True)` (or select `TurnRight`). The separate
`PREVIEW_TurnHeading` empty supplies matching overall rotation over nine cycles.
`set_turn_preview(False)` restores the model transform. Clip selection and the
export helper disable preview rotation automatically. The preview control,
studio, and its rotation are excluded from GLB export.

### Standing and walking transitions

Use a phase-aligned, contact-aware handoff: blend the body over about **0.4 s**,
retain each supporting foot's world position/orientation until its next lift,
and direct its next swing to the turning clip's landing position. Ramp heading
speed over the same 0.4 s; when leaving Walk, ramp forward speed down with it.
Both feet complete the handoff within one full cycle (about **1.33 s**). Keep the
same left/right phase as Walk; avoid restarting a turn on the opposite support foot.

This handoff was checked from standing and Walk into both directions. It preserves
support contact and reaches the normal turn pose exactly within numeric tolerance.
The handoff is a Blender review procedure and runtime integration guidance, not
an extra exported clip or implemented game behavior. A plain local-transform
crossfade was also tested: it can cause 1.7–5.1 cm of transient floor penetration
on this full-size asset, so use foot locking/IK when implementing those transitions.
See `turn_handoff_validation.json` and `turn_transition_validation.json` for both
results; neither changes the six previously delivered actions.

## Eye state events for Three.js

`IRONMAW_Eye_State` belongs only to `M_EyeLens`. Clone this material per robot
instance before changing its color/emission. The grayscale eye texture may be
shared. The following RGB values are **linear**, not sRGB hex values.

| State | Linear RGB | Emission strength |
| --- | --- | ---: |
| Enemy | (1, 0.018, 0.004) | 1.35 |
| Mounted | (0.008, 0.24, 1) | 1.35 |
| Unpowered/open | (0.24, 0.27, 0.30) | 0 |

- **Walk / TurnLeft / TurnRight / Stomp / HeavyPunch:** retain the instance's current red or blue state.
- **Death:** fade current operational color to gray and strength to zero over
  f12–28 (0.458–1.125 s). Remain off while opening and kneeling.
- **Mount:** start gray/off. Fade to blue/1.35 over f44–56 (1.792–2.292 s).
- **FinalDeath:** switch to gray/off at f30 (1.208 s).

These are runtime material events, not ordinary GLB animation tracks. The exported
asset defaults to red. Blender previews include the events through material
drivers; a reimported GLB alone retains its default eye until events are applied.
Nearest-neighbor texture sampling is retained. No bloom is required.

## Editing and controls

Run the embedded Blender text `IRONMAW_CONTROLS.py`, then call
`select_clip('Mount')` (or another clip). It selects the action, frame range and
matching eye preview. `select_clip('HeavyPunch', mounted=True)` previews blue.
`export_closed_glb(filepath)` exports all eleven Blender clips and preserves eye tint factors.

- `CTRL_Root`: overall facing and placement.
- `CTRL_Pelvis`: lower-body weight shift.
- **`CTRL_WaistYaw`: unlimited local Z rotation**, independent of root/pelvis.
  Chest, shoulders, arms, head and opening armor follow it. Apply targeting after
  animation evaluation at runtime, since attack clips also key this bone for wind-up. Walk and both turning clips leave it unkeyed.
- `CTRL_Waist`, `CTRL_Chest`, `CTRL_Head`: upper-body articulation.
- `CTRL_Shoulder_L/R`, `CTRL_Elbow_L/R`: rigid arms.
- `CTRL_Hip_L/R`, `CTRL_Knee_L/R`, `CTRL_Ankle_L/R`: rigid legs.
- `CTRL_FootIK_L/R`, `CTRL_KneePole_L/R`: foot targets and knee direction.
  Rig property `live_leg_ik` enables the optional two-link editing solver.
  Keep it **off for baked playback/export**; all delivered poses are sampled.
- `CTRL_ChestDoor_L/R`: local Z −90° / +90°.
- `CTRL_ShoulderFlap_L/R`: local Y −105° / +105°.
- `CTRL_Helmet_Rear`: local X −105°.

Opening phases: doors 0–0.46, flaps 0.12–0.48, helmet 0.52–1 of normalized opening.
Closing reverses this order. Every physical mesh island has a single weight of
1.0 to a `PART_*` bone, keeping surfaces rigid. FinalDeath compensates inherited
motion per frame so detached pieces travel independently. The hidden PART bone
collection can be shown for editing the breakup.

## Verification

The historical eight-clip export sampled 692 frames after GLB reimport against Blender's evaluated
mesh surfaces. Maximum difference was 0.051 mm during breakup; all other clips
were below 0.013 mm. The exported Death/Mount join differs by less than 0.000003
in matrix elements. Rigid weights, eight action names and durations were verified.

Attack support-foot drift is below 0.001 mm. Death/Mount ground contact checks
pass within floating-point tolerance. Each fist's broad bottom face has all four
corners on the floor, and hand matrix drift during support is below 0.000002.
The knee pads remain fixed from Death f40 through its final hold. Rigid link-length
errors are below 0.002 mm. Death was previewed at normal 24 fps playback speed;
front, side and back renders document the final supported posture.

Minor local armor/joint overlaps are intentionally permitted in this revision.
Earlier zero-overlap and posture-adjustment reports are historical, superseded
for Death/Mount by `two_stage_collapse_validation.json`. The unchanged waist rig
retains unlimited independent rotation; its original full-turn clearance review
and lower-body isolation checks remain applicable. Walk also checks intermediate frame samples: supporting-foot drift and floor
error stay below 1 mm at the documented speed. Its loop endpoint matches exactly,
and the periodic input curves match velocity across the loop. These are animation
checks, not a continuous physics simulation.


Turning QA is recorded in `ironmaw_animation_previews/turn_validation.json`.
Both source and reimported GLB loops have identical endpoints. Across four cycles,
the complete support soles drift less than 0.14 mm with matching heading rotation;
intermediate floor error is below 0.12 mm. Independent 360° waist rotation leaves
the pelvis and feet unchanged. All six earlier action keyframes and modifiers
were compared and remain unchanged. Full-revolution videos provide front, side,
and back inspection of both turn directions.

## Game export and mounted finishing touches (2026-10-01)

Run `export_game_asset.py` with installed Blender against this `.blend` in background mode. It exports the game GLB without saving or changing the authoring file. All eleven clips are included. Five legacy clips retain the existing one-frame lead; Walk/TurnLeft/TurnRight and the three new actions start at zero. Root/waist-yaw channels are omitted from those six clips so runtime world yaw stays authoritative. Materials, nearest-neighbor sampling and the red default eye are retained.

The export copies cassette socket extras from pose-bone authoring properties to the exported `CTRL_RocketSlide_R` joint: `muzzle_rest_position`, `muzzle_rest_direction`, `travel_m`, `anatomical_arm` and `physical_parent`. Socket vectors use Blender armature rest space before the Z-up conversion. Runtime transforms them into slide-local coordinates once, then follows the animated socket. The anatomical right launcher has the legacy `PART_Forearm_L_02` parent; it must not be chosen by the forearm suffix alone. `M_RocketCassette_R` exports a 0.52 m bore diameter used to fit the 90% rocket width. Its four material primitives plus the housing bring the runtime skin proxy count to 25.

RocketFire is three seconds with the frame-37 release at 1.5 seconds; runtime masks it to the upper body, retaining leg locomotion and independent waist yaw. HeadOpen/HeadClose are exact one-second reverses, masked to helmet-related bones. Runtime controls their sampled phase to reverse without snapping. The physical seat and head-height camera remain separate from the folding lens. Game piloting overrides the authored blue eye with warm yellow `#ffd34d` at the existing power-on cue; Blender preview drivers remain unchanged.

The runtime optical camera now sits at the closed `PART_EyeLens_01` center, with a
chest-owned interior view 0.75 game meters behind it. It does not follow the folding
lens. The actual Mount helmet hinge reaches its closed pose at exported **f27 /
1.125 s**; f45 is the remaining armor closure cue, not the helmet cue. An orange
runtime boot bar starts at f27, completes at the native Mount duration, then shows
the goggles/video startup. HeadOpen/HeadClose use short render-only blackouts for
camera relocation; the Blender clips and their timing are unchanged.
