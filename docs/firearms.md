# Firearms and grappling

Equip a firearm with **1–5**, the mouse wheel, or the touch **Weapon** button.
Press **E** or tap **Reload** to recharge the equipped battery. Every life
starts with all five magazines full. Weapon switches and Mecha boarding
preserve the rounds in each magazine. Spare charges are unlimited.

| Weapon | Shots per charge | Reload time |
| --- | ---: | ---: |
| Pistol | 15 | 1.5 s |
| Shotgun | 12 | 2.5 s |
| Assault rifle | 40 | 2.5 s |
| Sniper | 8 | 3.0 s |
| Minigun | 100 | 4.5 s |

The horizontal ammo bar displays the fraction of shots remaining. Each
shotgun blast consumes one round for all five pellets. The minigun consumes
rounds only when it discharges. Trying to fire an empty gun pulses the ammo bar red once per trigger press. An empty firearm waits for a manual reload.
Full batteries ignore Reload. Partial batteries take the same time as empty
ones. The right hand supports the firearm while the left takes the rear lid,
pulls the captive drawer, holds it open while the cell charges, then seats
the lid and returns to its grip. The colored length of the exposed core starts at the remaining charge.
An empty cell is frosted gray. Partial magazines show the nearest quarter, half
or three quarters in the weapon’s color. The fill steps up to full while the
drawer is open.
In first person the rendered arms bring the open drawer into view as the player aims.
The magazine fills when the drawer cycle finishes. Switching weapons or
drawing the grapple interrupts the reload and preserves the remaining rounds.

The pistol and shotgun stay in the right hand. The pilot spawns with the
pistol ready and the grapple in the left hand. Equipping either light weapon
draws the grapple automatically. Switching between them keeps the current
grip and tether. An assault rifle, sniper or minigun uses both hands until
the left hand leaves the support grip. A supported gun fires as soon as its
ordinary cooldown and any minigun spin-up allow, on the ground or in the air.

With an assault rifle, sniper or minigun, press **G** to draw the grapple
without launching it. Press **G** again to release any tether and return
to the heavy gun. A second press during the handoff reverses it.

Press **R** or tap **Grapple** to launch. From the holster, the hand takes
0.36 s to raise the launcher, or 0.52 s within 0.30 s of a heavy shot.
Pressing Grapple during an automatic light-weapon draw queues the launch.
A second press cancels a queued launch or releases an active tether.
After a miss or release, the launcher stays in hand and can fire again
immediately. A heavy primary stays lowered throughout.

A fresh heavy trigger press releases any tether, stows the launcher and
waits for the support grip before firing the queued shot. The full return
takes 0.52 s. Switching to a heavy weapon also starts that return, alongside
the ordinary weapon switch. The outgoing light weapon stays in the right hand
until the grapple seats in the holster, then the heavy weapon rises into its
support grip. Holding the trigger through a grapple draw
leaves the launcher in hand until a fresh press.

Reload requires a free left hand. While the tether is active or the hand
is in transit, pressing Reload has no effect. With the launcher idle in
hand, one press stows it and starts the battery cycle. A light weapon draws
the launcher again when the cycle finishes.

Firearm shots originate at the fitted barrel opening, including all five
shotgun pellets. In first person the flash and tracer start at the visible
barrel. The minigun uses whichever of its six openings is highest in the
housing when it fires. The game checks cover between the eye and the physical
muzzle. On-foot goggles hide the local hands, weapons, and attached flashes
as soon as zoom starts. Shooting and reloading continue while scoped.

The [katana](katana.md) uses its charge, cut and recovery clock. The
[Mecha cockpit](forgotten-mecha.md#mounting-and-piloting) has its own weapon selection
and cooldown display. The on-foot hand and magazine state is defined in
`src/weaponHandling.ts`, with capacities and timings in `src/config.ts`.
