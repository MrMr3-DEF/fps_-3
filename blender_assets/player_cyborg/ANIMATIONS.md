# Cyborg animation library

Open [the editable Blender library](player_cyborg_animations.blend) and press
**Space** to play the cyborg and assault rifle's paired battery reload. The
scene uses 120 fps and opens on frames 0–236. Select the `player_cyborg`
armature to choose another action in the Action Editor. Adjust the timeline end
for longer clips, such as frame 456 for inspection.
The **Animation review cameras** collection contains holder, side and rear views.
See the [pose and equipment contact sheet](preview_animations.jpg) for a visual index.

The [character GLB](player_cyborg_animations.glb) includes the armored body,
left-hip holster, blue grapple and four exhausts. The [modular props](props/)
use the same grip coordinates as the Blender preview. The full character stands
1.86 m tall, has its origin between its soles, and faces +Z in glTF.

## Choosing a weapon in Blender

In the Outliner, expand **Fitted primary weapons · show one**. Enable the
viewport and render switches for the desired collection and disable them for
the previous weapon. If the switches are hidden, enable the monitor and camera
restriction columns in the Outliner filter. Select the **character armature**
for actions such as `Sniper.Inspect` and `Katana.Swing`.

For a battery reload, select the matching prop armature and unmute its
**Reload** track in the NLA Editor. On the character, choose the matching
`<Weapon>.Reload` action. Play frames **0–236**. Mute the prop track again when
finished. The embedded grapple includes its own drawer and charge channels in
`Grapple.Reload`. The character's **Rest values for unkeyed channels** NLA track
supplies neutral values when switching between sparse actions.

## Clip guide

| Actions | Playback |
| --- | --- |
| `Idle.Unarmed`, `Idle.Armed`, `Run.Forward/Backward/Left/Right`, `Turn.Left/Right` | Loop. All four runs share a 0.50 s cycle. Left and right contacts begin at 0% and 50%, each with 30% stance followed by a flight window. Directional blends share one phase. The game supplies translation, yaw and speed-dependent cadence. |
| `Look.Up/Down/Left/Right` | Play toward the desired look and hold or blend its final pose. |
| `Jump.Takeoff`, `Jump.PowerTakeoff`, `Jump.Rise/Apex/Fall`, `Jump.Land` | The 0.075 s push-off drives the right knee up. Both boots tuck at the apex, then the left boot reaches for the landing while the right stays folded. The game blends the air loops by vertical speed. Ledge drops skip takeoff. PowerTakeoff includes a short, bright four-outlet burst. |
| `Hover.Ignite`, `Hover.Hold/Forward/Backward/Left/Right`, `Hover.Brake`, `Hover.Shutdown` | Ignite once, loop hold or steering, play Brake for deceleration, then Shutdown on release or exhaustion. The boot flames follow each sole and the narrow back flames follow the chest ducts. |
| `Grapple.PullFixed/PullMoving`, `Grapple.ReleaseBody` | Loop the appropriate body pull with the left-arm action. On release transition to fall, landing or either jump takeoff. |
| `Pilot.Board/Seated/Exit/Eject` | Board once in 0.45 s. Loop Seated while the cockpit owns the rider. Exit covers voluntary release and Eject covers emergency release. Use the character without a primary prop for these full-body poses. |
| `Hit`, `Death`, `Spawn` | Hit is a brief torso reaction. Play Death once and hold its final pose. Spawn rises into ready. |
| `<Weapon>.Ready/Aim/Fire/Inspect/Reload/Withdraw/Equip` | The five firearm prefixes are Pistol, Shotgun, AssaultRifle, Sniper and Minigun. Loop Ready/Aim. Play the other actions once. Each switch phase is 0.15 s and inspection lasts 3.8 s. Fire recovers in 10, 31, 14, 40 and 6 frames respectively. |
| `Pistol/Shotgun.OneHandReady/OneHandAim/OneHandFire` | Sparse right-arm variants for independent layering. The standard light-weapon actions also wield the primary one-handed, including inspection and both switch phases. |
| `AssaultRifle/Sniper/Minigun.Lowered` | The right hand lowers the unsupported heavy weapon during grapple use, then recovers its supported pose. |
| `Minigun.SpinUp/SpinDown` | Pair with the prop's SpinUp or SpinDown. Loop the prop's Spin at speed while firing. |
| `Katana.Ready/Aim/Inspect/Withdraw/Equip` | Loop Ready/Aim. Play inspection and each switch phase once. |
| `Katana.Charge/ChargedHold/Cancel/Swing/ChargedSwing` | Build for 3 s, then loop ChargedHold until release or cancel. Normal and charged cuts cross forward at 0.20 s and 0.14 s. Both recover at 0.60 s. |
| `Grapple.Draw.<Weapon>`, `Grapple.Held/Fire/Latch/Pull/Miss/Retract/Reload`, `Grapple.Return.<Weapon>` | Draw from the left hip for the equipped primary, fire, then play Miss or Latch. Loop Pull while attached. On a miss or release, finish the reaction and loop Held. Play Return when stowing. It ends on the heavy support grip or beside the light weapon’s holster. A drawn grapple can play its standalone reload. |

## Playing the exports

Parent a primary prop's imported scene directly to `grip.R` with an **identity
local transform**. Its root accounts for the change between Blender and glTF
axes. Firearms expose a `Muzzle` joint and the katana exposes `Tip`. On the minigun, `Bore1` through `Bore6` follow the rotor. The game places `Muzzle` at the highest bore in the housing.
Three.js sanitizes joint names during import. For example, find the primary
attachment with `scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('grip.R'))`.
The supplied standalone grapple is also available for prop-only presentation.

Play a body action with an upper-body weapon action. For a grapple overlay, give
the grapple clip priority on its left arm, hand and fingers. For example, combine
`Hover.Forward`, the right-arm tracks of `AssaultRifle.Ready`, and
`Grapple.Draw.AssaultRifle`. Draw and Return also own the spine and chest
while the pilot braces to reach the holster. Give those tracks priority over
torso lean during the transfer. Use full weight on the handoff visibility tracks.
`GrapplePark` follows the holster, `GrappleCarry` follows the glove, and the two
exchange visibility while the glove wraps the seated grip. The sleeve follows the left thigh with its muzzle down and the grip heel rearward. During the exchange, the game fits the left hand to the live holster transform after locomotion is sampled. The active grapple
exposes `GrappleMuzzle` on its hand-held mechanism.

The same uniform scale applies to the standing player, seated pilot and held equipment.
The seated visor is 1.347 authoring metres above the source origin. The cockpit
anchors position the rider and the optical view independently.

During firearm reload, play the character and prop Reload clips from the same
normalized time. The right hand presents each receiver, and the left hand leaves
its support grip and closes on the rear lid’s `DrawerGrip`. It pulls from frame
51, holds the exposed cell during charging over frames 95–151, pushes the lid
flush at frame 192, and returns to support by frame 236. The sniper presents
its long buttplate across the torso. The minigun stays suspended from its carry
handle. The [reload and exhaust sheet](preview_reloads.jpg) shows all five
moving lids and the four hover flames from the side and rear. Drawer and
charge use skeletal channels supported by standard glTF playback. The character
Fire clip already moves the attached weapon through recoil. Use the prop's
standalone Recoil clip when displaying it without the cyborg. The game synchronizes the receiver and battery charge with the weapon’s ammunition.

## Rebuilding

Run from the repository root with Blender 5.2. The builder writes the animation
library and GLBs alongside this guide. Manual changes to those generated files
should be incorporated in the authoring scripts before rebuilding.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python blender_assets/player_cyborg/build_animations.py
```

Run `verify_animations.py` with the same Blender flags to re-import the GLBs and
check contact, timing and attachment alignment. Append `-- --preview` to refresh
the contact sheet from those imports.
