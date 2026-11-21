# Blender assets

- The five guns and the off-hand grapple have editable Blender models with
  brushed gunmetal, stippled grips, and rigid recoil and battery reload actions.
  See the [animation guide and previews](firearms/README.md) and the
  [lineup at rest](firearms/lineup.png). The side numerals use the default equip keys 1–5. The
  [assault rifle](firearms/assault_rifle.blend) pairs a green-heeled pistol grip
  with a vertical foregrip. The grapple shares the pistol shape and uses blue.

- `katana/`: editable classic black katana with a bright silver grip, GLB and
  matching synchronous game mesh export. See [the asset guide](katana/README.md).

- The [cyborg player](player_cyborg/player_cyborg.blend) wears graphite armor
  and a fitted, open-jaw helmet. A deep rectangular visor housing frames smoked
  glass and a broad green stripe. Two wide charcoal straps run from the visor
  to a graphite counterweight at the back of the helmet. Four thick plates
  form a rectangular collar around the neck. The front plate sits below the chin
  and the side plates rise toward the nape. See the [visor and collar](player_cyborg/preview_head.png)
  and the [rear strap attachments](player_cyborg/preview_head_rear.png). The
  [headless armor](player_cyborg/armor_only.blend) has a separate
  [GLB export](player_cyborg/armor_only.glb).
  Each glove has five independent three-bone chains. In Blender Pose Mode,
  open `Fingers.L` or `Fingers.R` and rotate a digit's bones about local X to
  curl it. The first joint also allows finger spread or thumb opposition.
  Two flattened ducts blend into the upper back and terminate in downward-facing
  slits above the waist. Each boot has a circular sole thruster. All four outlets
  have dark interiors. Wide green bands sit between the chest, forearm and shin plates.
  The [GLB](player_cyborg/player_cyborg.glb) uses one skinned mesh with separate
  emissive materials for the chest seam (`Suit_Primary`) and limb seams
  (`Suit_Secondary`). The origin is between the soles, with Blender −Y forward
  and GLB +Z forward. See the [front](player_cyborg/preview_front.png) and
  [rear hover](player_cyborg/preview_hover_rear.png) views.
  The [cyborg animation library](player_cyborg/ANIMATIONS.md) contains the
  fitted weapon actions, left-hip grapple holster, movement and piloting clips,
  and animated exhaust from all four outlets.

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

The game scales these rigs to the heights listed in the [town defense guide](../docs/town-defense.md).

| Model | Authored height | In-place locomotion | Stationary attack |
| --- | --- | --- | --- |
| [enemy_base](enemy_base/) | 2.00 m | `Walk`, 28 frames per cycle | `Fire`, 6 frames. Discharge at clip start, peak recoil at Blender frame 2. |
| [enemy_fast](enemy_fast/) | 1.85 m | `Run`, 16 frames per cycle | `LightHit`, right-hand contact at frame 5 (0.167 s). |
| [enemy_big](enemy_big/) | 3.50 m | `Walk`, 32 frames per cycle | `HeavyHit`, right-hand contact at frame 18 (0.708 s). |

Actions use 24 fps. Frame 1 corresponds to clip time zero. Loop `Idle` and
locomotion. Play attacks once. Each `Death` throws the rigid body segments
outward and holds their landed positions through frame 45. Clamp the clip on
its final frame for a persistent debris pose. Stop it before restarting idle.

Each rig has two-step `TurnLeft` and `TurnRight` clips keyed from frame 0.
Rotate the model about its vertical axis through 60° using smoothstep over the
clip duration. The stance foot counter-rotates while the other foot steps.
Base takes 14 frames, Fast takes 10 and Big takes 20.

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
