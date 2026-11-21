# Ironmaw rig and animations

Ironmaw is the siege robot used by `src/forgottenMecha.ts` and the shared ending.
The model uses rigid silver/rust pixel surfaces, a hollow folding helmet and a
recessed cockpit. See [gameplay and runtime ownership](../../docs/forgotten-mecha.md).

## Files and export

- `ironmaw_siege_robot.blend`: editable meshes, mechanical rig, packed textures,
  eleven baked actions and review studio.
- `ironmaw_siege_robot.glb`: game model with 22 meshes, 160 joints and eleven clips.
- `ironmaw_animation_previews/`: clip videos and authoring validation output.
- `ironmaw_previews/`: model/opening reference renders.
- `export_game_asset.py`: exports the game GLB without saving the authoring file.

Run the export script with Blender in background mode from the project root.
The embedded `IRONMAW_CONTROLS.py` provides `select_clip(name)` and
`export_closed_glb(filepath)`. Keep live leg IK off for baked playback/export.
Preview lights, cameras, floors and heading controls are excluded from the GLB.

## Clips and timing

Blender uses 24 fps; frame 1 is authored time zero: `(frame - 1) / 24`.
Death, FinalDeath, HeavyPunch, Mount and Stomp retain a one-frame GLB lead, so
runtime cues use exported frame / 24. Walk, turning, head folds and RocketFire
start at zero. Preserve this distinction when mapping clip events.

| Clip | Authored duration | Main cue or contract |
| --- | --- | --- |
| Walk | 1.333 s loop | Alternating support; no horizontal root/waist-yaw tracks |
| TurnLeft / TurnRight | 1.333 s loop | In-place legs matched to -/+30 degrees/s heading |
| Stomp | 3 s | Foot contact at exported frame 39 |
| HeavyPunch | 3.5 s | Fist contact at exported frame 35 |
| Death | 6 s | Knee/fist contact at frames 40/64; opens to mountable kneeling pose |
| Mount | 7 s | Reverses the Death endpoint into standing; helmet closes at exported 1.125 s |
| FinalDeath | 5 s | Physical pieces separate; runtime starts piloted breakup at exported 1.25 s |
| HeadOpen / HeadClose | 1 s each | Helmet-only fold and exact reverse |
| RocketFire | 3 s | Cassette release at 1.5 s |

Death ends at Mount's initial pose. Stomp, HeavyPunch and Mount end in the closed
standing pose. Fists/knees provide support during collapse and stand-up; local
armor/joint overlaps are permitted. FinalDeath compensates inherited motion so
rigid pieces follow independent baked trajectories.

## Movement and rig ownership

The asset faces Blender -Y, exported as Three.js +Z. Walk contains no horizontal
root motion; normal playback matches 1.5 native meters/s, a two-meter stride and
90 alternating contacts/minute. At uniform scale `s` and playback multiplier `r`,
translate at `1.5 * s * r`. Turning matches 30 degrees/s times `r`, independent
of scale. Preview translation/heading are not exported.

`CTRL_Root` owns placement/heading. `CTRL_WaistYaw` permits independent local-Z
upper-body rotation; apply targeting after animation evaluation. Walk/turn clips
leave root and waist-yaw unkeyed. Runtime leg constraints preserve support through
phase-aligned transitions; ordinary local crossfades can penetrate the floor.

| Controls | Responsibility |
| --- | --- |
| `CTRL_Pelvis` | Lower-body weight shift |
| `CTRL_Waist`, `CTRL_Chest`, `CTRL_Head` | Upper-body articulation |
| `CTRL_Shoulder_L/R`, `CTRL_Elbow_L/R` | Rigid arms |
| `CTRL_Hip_L/R`, `CTRL_Knee_L/R`, `CTRL_Ankle_L/R` | Rigid legs |
| `CTRL_FootIK_L/R`, `CTRL_KneePole_L/R` | Optional editing IK targets/poles |
| `CTRL_ChestDoor_L/R`, `CTRL_ShoulderFlap_L/R`, `CTRL_Helmet_Rear` | Opening armor |

Each physical mesh island has weight 1.0 to a `PART_*` bone. Hidden PART controls
can be exposed for breakup editing. `set_turn_preview(True/False)` controls the
separate review heading; clip selection/export disable it automatically.

## Right-arm cassette and socket

The anatomical-right launcher is viewer-left head-on. Its `CTRL_RocketSlide_R`
control has the rig's `PART_Forearm_L_02` parent; suffix alone cannot identify
anatomical side. The cassette slides 0.75 m along local Y, has a 0.70 m square
front and a 0.52 m barrel bore with a closed recessed back wall.

The export copies `muzzle_rest_position`, `muzzle_rest_direction`, `travel_m`,
`anatomical_arm` and `physical_parent` to the exported joint. Rest vectors use
Blender armature space before conversion. Runtime converts them to slide-local
coordinates and follows the animated muzzle. Rockets fit 90% of bore diameter.
RocketFire layers onto the upper body while retaining runtime locomotion/yaw.

## Eye and cockpit

`IRONMAW_Eye_State` belongs to the lens. Clone the material per instance before
changing color/emission; the grayscale texture can be shared. Eye changes are
runtime material events rather than GLB animation tracks. The asset defaults red;
Blender preview drivers use blue for mounted state, while game piloting uses
warm yellow. Death fades to unpowered gray; Mount powers on during frames 44–56.

The grapple ends at the cockpit entrance. The visible cyborg rides on the seat cushion, rigid part `PART_UpperTorso_Cavity_20`, in front of backrest `PART_UpperTorso_Cavity_19`.
The closed view is at `PART_EyeLens_01`; the interior anchor is chest-owned,
0.75 game meters behind it, and does not follow the folding lens. HeadOpen/Close
rotate only the helmet to/from -105 degrees around local X. Runtime head/camera
phases preserve continuous reversals and relocate behind opaque cover.
