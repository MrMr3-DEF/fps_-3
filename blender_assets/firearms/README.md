# Firearm animations

Each Blender file opens with `Weapon rig` selected and `Reload` active. Play
the timeline to see the reload, or choose `Recoil` in the Action Editor. Both
actions start at frame 0 and use 120 fps. The Holder view camera looks over the
grip from behind the gun and mirrors the angle for the off-hand grapple. The
Three-quarter camera shows the rest pose.

## Recoil

One playback moves the weapon slightly back and raises its nose, then eases
it to rest. Each firing clip finishes before the next permitted shot at the
weapon’s fastest cadence. The off-hand grapple has its own single pulse.
[Watch the firing preview](recoil_preview.mp4).

| Model | Default key | Recoil end frame | Duration |
| --- | --- | ---: | ---: |
| [Pistol](pistol.blend) | 1 | 10 | 83 ms |
| [Shotgun](shotgun.blend) | 2 | 31 | 258 ms |
| [Assault rifle](assault_rifle.blend) | 3 | 14 | 117 ms |
| [Sniper](sniper.blend) | 4 | 40 | 333 ms |
| [Minigun](minigun.blend) | 5 | 6 | 50 ms |
| [Off-hand grapple](grapple.blend) | R | 11 | 92 ms |

## Battery reload

The muzzle tips down 66° around the grip. The entire rear face of the receiver
forms the battery lid. On the sniper it is the stock’s buttplate. At frame 51
the lid slides straight back toward the holder, drawing the cuboid core into
view. A guide keeps the open drawer attached to the gun.

The exposed core charges from frosted gray to the weapon color between frames
95 and 151. The drawer slides forward and seats flush at frame 192. The receiver
relights as the gun returns to its firing pose at frame 236 (1.97 seconds).
The key numerals and painted accents keep their color throughout.
[Watch the holder’s view, drawer close-up, and six-weapon lineup](reload_preview.mp4).

The `Weapon` and `Battery` bones each expose a `charge` property for their
own glass and emission. Material Preview and Rendered view show the cloudy
glass. Solid view with Material color shows its animated tint.
