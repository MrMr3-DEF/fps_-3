# Forgotten Mecha

Each match prepares one 28 m, 50 HP Ironmaw siege robot from
`blender_assets/ironmaw/ironmaw_siege_robot.glb`. Singleplayer simulates locally;
the multiplayer host activates and simulates the shared actor when play starts.
See the [asset guide](../blender_assets/ironmaw/ironmaw_README.md) for rig/export cues.
Shared gameplay values live in `src/config.ts`.

## Behavior

- A seeded, footprint-clear border route leads toward an outer castle wall.
  Navigation avoids architecture, pillars and lava. Its independent random
  stream preserves the rest of the generated world.
- Detection uses a 130 m horizontal cylinder from ground height through 28 m,
  then a ground-centered 130 m sphere above that ceiling. Static cover blocks
  acquisition independently of render distance.
- The actor retains an eligible living target while detection and LOS hold.
  Waist yaw is capped independently of hip movement; close circles and fast
  grappling can outrun it. Committed attacks finish under their cancellation rules.
- Below the ceiling, attacks are stomp at up to 25 m, rockets beyond 25 m and
  below 60 m, and laser from 60–130 m. The upper dome uses rockets.
- Zero HP cancels attacks and aligns the torso to the legs before the full
  Death clip. The solid kneeling wreck is mountable after completion. Defeat
  awards one shared NPC score; ordinary play continues without robot respawn.
- Wall arrival commits room-wide loss before the first HeavyPunch tick and
  makes the actor invulnerable. The shared ending owns the terminal presentation.
  Infantry can also trigger the shared castle collapse by depleting
  [wall durability](town-defense.md), with the wall strike as the camera focus.

Singleplayer displays **Something’s approaching...** once per match after loading.
Pause freezes its countdown; respawn does not replay it. Accessibility modes use
steady presentation. Multiplayer omits this warning.

The locator tracks the actor through cover and beyond render distance, including
its mountable wreck. An occupied remote mecha replaces its pilot's marker; the
local pilot never tracks their own vehicle. Final destruction removes the marker.
The weapon panel shows the selected rocket or stomp during active piloting and
restores the pilot’s equipped firearm or katana on release.

## Eye laser and shield

Laser charge requires continuous LOS and brief alignment, then follows capped
torso yaw and player height. At release its lens origin and angles freeze. The
finite beam reaches up to 700 m, stops at world/floor contact and tests actual
oriented body boxes, including airborne bodies. It deals 10 damage once per life,
including during its shrinking fade. Leaving acquisition range does not shorten
a fired beam. LOS/life loss cancels a charge; region changes alone do not.

Laser/stomp contacts are captured by simulation and delivered after the victim's
local drawing. Laser requires the beam mesh's actual draw callback. Pending hits
clear across life, actor revision and disposal boundaries; rendering never gates
host simulation.

The chest-centered 17 m spherical shield absorbs outside-origin weapon hits.
Closest shield/body/terrain contact wins. Shots whose original muzzle is inside
can damage the body. Shield surfaces do not block movement, grappling or scans.
Impacts produce visual ripples without consuming energy or awarding damage.

Four actual ranged releases within the rolling 60-second simulation window
trigger a warning and shield shutdown after attack recovery. The actor freezes
for five seconds from shield drop, then rebuilds protection. Death and terminal
loss cancel recovery permanently.

## Enemy rockets

RocketFire releases from the animated anatomical-right cassette at its shot cue.
Range changes cannot cancel a committed windup. The shoulder correction solves
the actual moving muzzle ray toward a visible player intercept.

Rockets retain a straight three-meter barrel segment before bounded guidance at
120 m/s. Enemy guidance is weaker than pilot guidance and has no pilot loft.
Loss of LOS at release produces a wandering shot with captured aim; later hidden
movement cannot retarget it. Launch profiles and target life are immutable.
Physical cover intercepts travel and blocks the five-meter blast. Enemy rockets
deal nine damage once to eligible player lives, excluding the launching actor.

## Mounting and piloting

Grapple into the defeated cockpit's actual front opening. Armor remains an ordinary
surface grapple. The pull sweeps world cover and clamps arrival to the physical
boarding anchor. Boarding and the full Mount startup protect the occupant.

First-person startup relocates behind opaque cover, fills an orange loading bar,
then reveals mounted goggles. Third-person entry captures the saved view, swivels
to the front and returns to the normal follow boom without first-person hardware.
Both become controllable on the same frame. Transition camera sweeps prefer cover
clearance over complete-body framing. P/View and temporary Aim changes are ignored
through entry, shutdown and release; they are not queued.

| Control | Piloted action |
| --- | --- |
| W/S | Align legs, then walk forward/reverse with fitted swept collision |
| Look | Capped world-space torso aim; sampled input clears on pause/transition |
| 1 / 2 | Select Rockets / Stomp |
| R, wheel, touch Weapon | Alternate the two attacks without resetting cooldowns |
| Fire | Repeat the selected ready attack |
| O / touch Helmet | Open or close the helmet |
| Shift / touch Shield | Manual shield using the hover-energy bar |
| Grapple action / touch Exit | Request voluntary shutdown |
| Aim | Scoped first person; temporarily enters first person from third person |

The pilot retains their on-foot weapon and each firearm’s magazine while seated. On-foot jump,
hover, strafe, inspection and conversation are unavailable while piloting.
Piloted movement can cross lava; grounded foot contact costs one HP per tick
through shields. Enemy navigation still avoids lava. Piloted walking, torso
turning and stationary leg alignment run 50% faster than the enemy actor, with
locomotion clip speed and footstep contacts scaled to match; enemy movement,
turning and stomp values are unchanged.

Closed-helmet goggles support immediate target acquisition and guidance. Opening
disables acquisition; ordinary scoped scans remain available without homing.
Already launched rockets keep their captured flight mode. Helmet reversals retain
current phase instead of snapping. Ordinary health/reload/shield/FPS telemetry
stays visible during active helmet toggles; startup/shutdown have separate HUD
rules. Camera relocation occurs under the cover below ordinary telemetry.

Pilot rockets acquire the nearest unobstructed eligible target to the rendered
crosshair at release, independently of host render chunks. They follow the
captured life off-screen without retargeting. Closed-helmet unlocked shots coast;
open/folding shots wander toward a 75–100 m landing point. Swept collision uses
fitted radius/hull endpoints. A ten-meter cover-blocked blast deals 10 damage
once per eligible body, without extra direct or self-damage. Firing freezes travel
and look until release, then permits recoil locomotion; recovery gates repetition.

### Pilot attack slots and stomp

Fresh boarding selects Rockets. A stomp keeps `piloted` ownership while stopping
travel/leg turning for the complete clip. Looking, helmet controls and shielding
remain available. Enemy and pilot share exact exported contact sampling across
slow frames. Each eligible player/NPC takes 10 damage once: the pilot floor wave
reaches 37.5 m (enemy stomps stay at 25 m), while animated leg contact also
reaches elevated/airborne bodies. The pilot
and vehicle are immune. Cooldown begins after completion. Switching slots does
not cancel an attack; exit waits for committed animation to finish.

### Visible pilot and voluntary shutdown

The cyborg turns into the open cockpit and settles onto the modeled seat cushion
at full on-foot scale. The chair follows the torso, with the pilot reclined against
the backrest and knees bent into the footwell. The optical camera follows the
mecha’s eye. Opening the helmet while driving keeps the chest panels closed.

Manual shielding needs a completed build. Release/exhaustion removes protection
immediately; recharge begins on deactivation, and exhaustion requires release
before reactivation. It does not run enemy automatic-shutdown logic.

Voluntary exit closes the helmet, aligns the torso and reverses the startup
presentation and Mount. Clearance is checked before shutdown and again at release.
A blocked preflight leaves controls active and reports a retry message. A newly
blocked exit restores piloting without refilling energy. A valid exit restores
the standing pose, controls, equipped weapon, camera and gravity while preserving HP, life,
fuel and score. The zero-HP wreck remains mountable; remounting restores 50 HP
and full shield energy.

Mounted lethal destruction immediately releases the living pilot at FinalDeath's
breakup cue, clears collision and finishes independently. The wreck cannot mount
again. Third-person release uses a collision-safe handoff; scope/fire/shield input
and mounted presentation clear without resetting the player's life.

## Multiplayer

The host owns AI, collision, attacks, health and exclusive cockpit admission even
when its player is dead or paused. Clients interpolate replicated bones/effects
and never run actor damage simulation. Other players keep independent cameras,
controls and HUD. A losing boarding request cannot move a respawned life.

Pilot commands validate sequence, life, actor revision and ownership. Held inputs
expire after 250 ms; release sends neutral intent immediately. Pilot departure
cancels attacks and returns the actor to a mountable defeated state. FinalDeath
remains unavailable. Late snapshots include current ownership, attacks, rockets,
head phases and ending state, without replaying old damage.

Weapon claims use the host shot/pellet ledger, exact damage, physical contacts,
terrain and firing revision. Stale shots cannot damage a newly mounted actor.
Pilot kills use existing attribution; destroying a piloted mecha releases its
living occupant without a PvP death or NPC score. All clients need matching builds.

## Game Over cutscene preview

`MechaEndingPlayback` releases input, hides other overlays and freezes ordinary
combat while the live canvas fades to black. `MechaGameOverScene.prepare()` loads
assets without allocating destruction/scenery buffers; `begin()` activates under
opaque cover in cooperative batches. Cancellation/failure disposes partial work.
The gameplay castle and collision data remain untouched.

The host readiness barrier waits for its scene and admitted viewers, with a
bounded timeout for remote viewers. Departures release the barrier; late joiners
prepare locally and seek current host time. Only host ending snapshots authorize
playback. Scene identity, seeds and camera cannot be changed by stale/duplicate
packets. Completion shows Game Over after punch and aftermath.

The isolated scene reproduces seeded castle shells and scenery. Debris contacts
are baked with bounded swept queries; chronological contacts and stable IDs make
replay/late joins deterministic. Graphics quality changes cosmetic density only.
Camera shake is temporary render rotation; accessibility modes suppress shake
and reduce bright effects. Rendering restores caller state, including on errors.

Open `/tests/mecha-cutscene-preview.html` under Vite for replay, seeks, approach,
seed, lighting and viewport controls. Pillar bounce/breakup shortcuts select
recorded visible contacts. Preview preferences do not save settings.

## Ownership and lifecycle

| Module | Responsibility |
| --- | --- |
| `forgottenMecha.ts` | Actor modes, rig fitting/layers, anchors, moving proxies and actor resources |
| `mechaNavigation.ts`, `mechaMovement.ts`, `mechaFootPlant.ts` | Enemy routes, piloted swept movement and planted feet |
| `mechaCombat.ts`, `mechaCombatEffects.ts`, `mechaStomp.ts` | Attack eligibility/clocks, contacts, shields and pooled effects |
| `mechaPilot.ts`, `mechaRockets.ts`, `lookInput.ts` | Pilot steering, timed input, targeting and rocket pools |
| `mechaHeadView.ts`, `mechaHeadEffects.ts`, `mechaTransitionCamera.ts` | Simulation-clock head/camera phases and temporary rendering |
| `mechaPilotRelease.ts`, `thirdPersonCamera.ts` | Living release and collision-safe camera handoff |
| `mechaNetwork.ts`, `mechaNetworkTypes.ts` | Commands, parsing, host authority, replication and victim draw queue |
| `mechaEndingTimeline.ts`, `mechaEndingPlayback.ts` | Shared terminal clock/readiness and asynchronous playback lifecycle |
| `mechaGameOverScene.ts`, `mechaEndingCastle.ts`, `mechaEndingScenery.ts`, `mechaEndingDebris.ts`, `mechaEndingCamera.ts` | Isolated cinematic resources, scenery, trajectories and camera |

`world.ts` owns preparation/disposal and dynamic query registration. Late asset
loads cannot attach to replacement worlds. Damage and weapon-network ports remain
the dependency seams. Offline pause/death freezes actor clocks; respawn retains
the same actor. Leaving cancels pending work and disposes resources. Fresh matches
reset terminal latches and create a new actor.

## Current manual acceptance

Use `/tests/mecha-preview.html` for affected interactions. Its controls cover
finding/scanning, distance/height, armor hits, automatic evasion, attack phase
pauses, cockpit entry, piloting, blocked exits, lava and cleanup. Touch mode is
temporary; this fixture does not establish physical input capture or device feel.

Check only the affected behavior: acquisition through/without cover, attack
contacts, render-before-damage, shield cycling, helmet/view transitions, living
release, blocked recovery or leave/restart. Visual timing and particle appearance
belong in this preview rather than exact-value automated assertions.

### Multiplayer acceptance

Use two clients and a late joiner when changing shared actor/transport behavior:

- Compare pose, health and attacks while the host player is paused/dead.
- Race cockpit entry; only one pilot owns controls and other views remain independent.
- Check rockets/stomps, target-life expiry, kill credit, host health and render-timed local feedback.
- Exercise blocked exit, remount, pilot disconnect and lethal living release.
- Join during startup, attacks, destruction and the shared ending.
- Leave and start again with fresh state; include relay-required connections when relevant.

See [Multiplayer checks](multiplayer-live-test.md) for admission/network scope.

## Charged katana rear-nape weak spot

`mechaNape.ts` attaches a helmet-proportioned rear box to `CTRL_Head`; it follows
animation without joining movement or firearm hitboxes. During a charged katana's
active window, a clear rear contact within 10 m deals remaining HP through normal
damage rules. Shields, protected phases, actor revision, kill credit and pilot
release still apply. A body hit already consumed by that swing prevents upgrading
to a nape execution. Normal swings use ordinary body damage.
