# Blender assets

- `katana/`: editable classic black katana with a bright silver grip, GLB and
  matching synchronous game mesh export. See [the asset guide](katana/README.md).

- `goth_girlfriend/`: goth girlfriend source meshes, rigged Blender project,
  textures, and the GLB loaded by `src/gothGirlfriend.ts`. The rig tests use the
  same GLB. Keep the Blender projects beside their textures when reorganizing.
- `ironmaw/`: Ironmaw model, textures, rig, animations and authoring previews.
  `src/forgottenMecha.ts` loads its GLB for the siege robot and shared ending. See [the Ironmaw guide](ironmaw/ironmaw_README.md).

Editable character text and chat knowledge remain in `public/npc/goth/`.

## Enemy robots

Each robot has a rigidly skinned Blender project and a self-contained GLB in its
own directory. The robots use rigid cuboids, pixelated patches of exposed rust,
and broken cables built from short square segments. A single square strut spans
each exposed limb segment. The open side of each chest has one snapped rib.
The heavy has a solid spine
seated inside its hip block. The model root matches its directory name. The origin is on the
ground between the feet. Forward is Blender −Y and exported model-space +Z.

| Model | Height | In-place locomotion | Stationary attack |
| --- | --- | --- | --- |
| [enemy_base](enemy_base/) | 2.00 m | `Walk`, 28 frames per cycle | `Fire`, 6 frames. Discharge at clip start, peak recoil at Blender frame 2. |
| [enemy_fast](enemy_fast/) | 1.85 m | `Run`, 16 frames per cycle | `LightHit`, right-hand contact at frame 5 (0.167 s). |
| [enemy_big](enemy_big/) | 3.50 m | `Walk`, 32 frames per cycle | `HeavyHit`, right-hand contact at frame 18 (0.708 s). |

Actions use 24 fps. Frame 1 corresponds to clip time zero. Loop `Idle` and
locomotion. Play attacks once. Each `Death` throws the rigid body segments
outward and holds their landed positions through frame 45. Clamp the clip on
its final frame for a persistent debris pose. Stop it before restarting idle.

For the base robot, stop locomotion before starting `Fire`. Apply target yaw
to `torso_yaw` about Blender's vertical axis, relative to its rest pose.
`Fire` animates the child chassis and carries both hands and the rifle through
recoil. The Blender-only `AimPreview` action turns 60° in five frame intervals.
The named `muzzle` joint is at the barrel tip. Use the direction from the barrel
toward the tip (resting model-space +Z in the GLB).

Select actions in Blender's Action Editor. To regenerate all three source files
and exports from the shared authoring script, run from the repository root:

```sh
blender -b --python-exit-code 1 -P blender_assets/enemies/build_enemies.py
```
