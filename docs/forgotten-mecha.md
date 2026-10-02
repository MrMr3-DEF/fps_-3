# Forgotten Mecha

Singleplayer creates one Ironmaw siege robot during match preparation. The model
is `blender_assets/ironmaw/ironmaw_siege_robot.glb`; its rig and authored animation
events are documented in that directory's README. Multiplayer does not create
the robot or transmit any robot state.

## Behavior

- A fresh singleplayer match shows **Something’s approaching...** once after
  loading, centered in white for three active gameplay seconds with a gentle
  opacity pulse. Photosensitivity/reduced-motion modes keep it steady. Pause
  hides it and freezes its countdown; death, reset, cancellation and disposal
  clear it. Respawning does not replay it; multiplayer never shows it.
- Standing height is 28 m and health is 50 HP. Fitting the actual skin gives a
  scale of approximately 4.063; the authored 1.5 m/s gait therefore moves at
  approximately 6.095 m/s at full playback speed.
- A seed-derived random border position is chosen only when it has a clear path
  to an intact outer castle wall. A separate random stream preserves all
  procedural world placements. Navigation reserves the entire robot footprint
  around pillars, solid architecture and lava, forbids diagonal corner cutting,
  and checks smoothed segments and the final wall approach against actual bounds.
- Detection and attack acquisition share one classifier, measured from the
  robot’s ground position using the existing player-position anchor. At heights
  0–28 m inclusive, the detection cylinder keeps its full 130 m horizontal radius:
  stomp at ≤25 m, rockets at >25–<60 m, and laser at 60–130 m. Above 28 m, rockets
  cover the ground-centered sphere where r² + h² ≤130², ending directly overhead
  at 130 m. Negative heights and positions outside both volumes are undetected.
  A living player with line of sight causes the robot to stand still and aim its
  upper body independently of its hips; readiness, alignment and cooldowns still
  gate attacks. Static world proxies block visibility even beyond render distance.
  Losing sight or the detection region resumes the route after committed recovery.
- Waist yaw is capped at 0.366 rad/s (about 21 degrees/s), calibrated against
  actual normal walking at a 50 m circle. Closer circles and faster grappling can
  outrun it. The cap also applies when returning the torso to its walking pose.
- A visible player in the lower cylinder’s ≤25 m region triggers Stomp.
  Its exported frame-39 foot contact checks range and grounding again, dealing
  lethal damage to a player supported by the arena floor or touching either
  animated foot, shin/knee or thigh. Leg contact counts even when elevated or
  airborne; fully jumping clear remains safe. Rooftops and pillars avoid the
  ground shockwave. Contact uses the yaw-oriented bean body, its normal camera
  offset and 0.1 m tolerance. Slow frames sample the exact impact pose. The hit
  is captured at contact and delivered only on the active frame after a completed
  render; leaving the radius afterward cannot evade it. Pause retains the hit,
  while a changed player life, actor defeat or disposal discards it. Another stomp cannot start
  until five simulation seconds after the whole previous clip has finished.
- Stomp impact creates radial dust, stone chips and a shockwave. Heavy camera
  shake reaches 50 m from the body's horizontal center and fades with distance.
  Ordinary steps have small dust bursts without camera shake.
- At zero HP, Death cancels navigation and any pending attack. Its knee and fist
  impacts each create debris and lighter shake within 50 m. Eye emission fades
  out, and the final open, kneeling pose remains solid. Normal gameplay continues;
  there is no robot respawn or victory overlay. The cockpit becomes mountable
  after the whole Death clip completes.
- Reaching the wall starts HeavyPunch and immediately makes the robot immune to
  damage. The fist creates debris at contact. Only completion of the whole clip
  ends the match, opening Game Over with one Back to Main Menu button.

## Eye laser and shield

Laser acquisition requires continuous LOS, horizontal distance from
60 m through 130 m inclusive, and player-position anchor height from 0 through
28 m above the robot’s ground position. Alignment within one degree for 0.15 simulation seconds starts
a three-second charge. The yellow sphere grows to the actual fitted eye height
(about 2.622 m diameter), with an inner glow and orbiting particles. Its anchor
is the exported lens joint, rather than the skinned mesh's root origin.

Charging follows the capped torso yaw and automatically pitches to the player's
current height. Horizontal lag alone does not cancel it. At firing, the origin,
torso aim and both angles freeze. The beam uses 75% of the sphere radius, reaches
up to 700 m, and stops where its width contacts world geometry or the floor.
Its actual finite cylindrical volume is tested against the player's oriented
body box, including airborne players. One firing deals 10 damage at most once,
with contact captured on its first intersecting frame; this is lethal at the current
10 HP maximum. Beam/core materials also draw their inside faces, so the struck
camera can see the beam rather than only its charging orb. The actor queues the
captured hit until the beam mesh's actual draw callback and scene acknowledgment,
then main delivers it before advancing the next active frame. A lethal death
screen therefore retains the visible beam as its frozen backdrop.
Acquisition bounds no longer shorten a fired beam's physical reach.

The beam lasts one second, then it and the sphere shrink over 0.2 seconds. Damage
continues during ordinary shrinking with the same shrinking radius. Reload is
eight seconds from the end of that fade. Range and height select the initial charge only. Once committed, the laser
finishes even after entering the close zone or leaving acquisition range/height.
Only loss of LOS or player life cancels charging. Released beams remain physical
volumes regardless of LOS. A ready stomp waits until ranged recovery completes. Cancelled
charges cost no shot or reload; cancelled fired beams count and reload after fading.

The chest joint centers a true spherical 17 m shield, extending below ground.
It is absent from movement, grappling and scan obstacle queries. Outside-origin
bullets, homing bullets and sniper shots compare shield, body and terrain
contacts; the nearest applicable contact wins. Shield impacts cause expanding
blue surface waves and a faint local highlight, but no HP loss, kill score or
energy consumption. The powered sphere is otherwise invisible. Shots with an
original muzzle inside the sphere can damage the body normally, including after
steering; pooled shots reset that origin on every firing.

Actual laser and enemy rocket releases are counted together in a rolling,
inclusive 60-second simulation window. After the fourth attack finishes its
beam fade or RocketFire recovery, new attacks are
blocked: wait one second, blink red twice over 0.6 seconds, then drop protection
at the start of a 0.3-second eye fade to gray. The full translucent shield reveals
and dissolves into falling pixels over 0.6 seconds. Movement, animation attacks
and torso tracking freeze for five seconds from shield drop. A 0.5-second rebuild
then sweeps bottom to top while the eye returns to red; protection returns only
at completion. Firing history resets and ordinary behavior resumes. Death or the
committed wall punch cancels combat; recovery never revives a dead actor.

The five legacy GLB clips have a 1/24-second leading offset. Runtime impact times
use exported frame / 24 and animation duration, rather than the Blender timeline's
(frame - 1) / 24. Walk, turning, HeadOpen/HeadClose and RocketFire clips start at zero. Phase-aligned transitions
use a runtime two-link leg solver to keep supporting feet planted while blending.

## Enemy rockets

The lower cylinder’s exclusive 25–60 m band and the entire spherical dome above
28 m start the same three-second RocketFire layer used by piloting. Its anatomical
right-arm cassette releases at 1.5 seconds, starts the
same two-second reload and finishes recovery at three seconds: releases are at
least 3.5 seconds apart. Range changes and close-zone entry do not interrupt an
accepted windup. Acquisition remains LOS-dependent; no other ranged attack or
stomp starts until the committed attack finishes.

An enemy-only rigid shoulder aim correction points the actual animated socket at
a moving-player intercept, including downward aim from the elevated launcher
and upward aim into the dome. The correction solves the barrel ray about the
actual shoulder pivot, accounting for the muzzle’s movement during rotation so
close overhead targets do not cause oscillation.
The rocket preserves its initial three-meter barrel-axis segment and 120 m/s
speed, then guides with a 3 rad/s cap and response 4 instead of the pilot's 6/8.
Enemy guided shots omit the pilot's loft. Launch-time profiles preserve pilot
behavior and do not change with later helmet state or ownership.

If LOS is absent at release, the windup still finishes but launches the existing
open-helmet wandering route with its original steering profile and authored
launcher pose. The torso holds its last visible aim; hidden movement cannot
steer the arm or muzzle. LOS restoration
cannot acquire a target afterward. Enemy shots are bound to the captured player
life and apply nine damage once within the existing five-meter, cover-blocked
blast. They do not damage NPCs or the launching actor; stale player lives retire
these shots. Physical cover intercepts rockets normally. Clear-ground regression
checks cover continuous normal sideways walking in both directions at the band
edges and center at 30 and 144 Hz.

## Mounting and piloting

Grapple directly inside the defeated cockpit. Exact animated-armor rays validate
the opening; exterior armor remains an ordinary surface grapple. The 375 m/s
straight enemy pull ignores this mech's coarse body proxies, sweeps world
obstacles and clamps arrival to the chest-owned seat. A uniformly fitted bean hides
its weapons and turns forward over 0.45 seconds while the camera eases to a
separate interior head anchor at normal FOV. The complete 7.042-second Mount follows.
The closed viewport is at the actual lens center; a second anchor sits 0.75 m behind
it. Both belong to the chest, independent of the folding hinge and physical seat.
First-person folding renders the interior helmet/lens faces, restoring material
sides and visibility after drawing; third person retains the complete model.
At Mount frame 27 (1.125 s), the helmet finishes closing and the view turns black.
An orange (`#ff9a32`) spawn-style **Loading...** bar follows the remaining clip time
and reaches 100% when the mech finishes standing. The camera moves to the eye
under the opaque screen. Orange goggles fade in over black for 0.4 seconds, then
a 0.3-second horizontal tearing/held-picture reveal restores live vision. Controls
and startup protection remain until the reveal completes. The mounted yellow eye
(`#ffd34d`) still powers on at frames 44–56; Blender previews retain their authored blue cue.

First-person goggles remain at normal FOV after startup;
C/right-click zoom to configured scoped FOV. Third person uses a collision-safe
45 m back, 10 m up, 8 m shoulder boom, ignoring own body proxies. Targeting remains
active without its overlay; C/right-click temporarily enters zoomed first person.
Closed-helmet goggles use a dedicated orange (`#ff9a32`) tint, glow, corners and center dot, preserving scan/lock colors. Mounted hardware operates independently of the bean's match-scoped failure.

O toggles the one-second HeadOpen/HeadClose animation; mounted touch offers Helmet
in the grapple slot. Opening fades to black for 0.12 seconds and eases the camera
back to the interior anchor under black for 0.08 seconds. The physical opening
starts there, with a 0.12-second fade from black overlapping its start. Closing
first plays the visible fold, then uses the same blackout/move/fade durations to
return to the eye. These toggles do not repeat startup loading or tearing. Reversals
inherit current hinge, camera and opacity values; windup toggles wait until release.
Only helmet tracks are layered, so movement, look, shield and recoil continue.
Opening immediately disables acquisition and permanent goggles. Open/folding uses
normal presentation and ordinary cyan scans while C/right-click is held, without
red lock markers or homing. Fully closing and finishing the eye-view transition
restores orange goggles and targeting. Third person keeps its external camera with
no blackout; its shoulder boom remains eye-centered. Existing rockets retain their
release-time flight mode.

`mechaHeadView.ts` owns the simulation-clock presentation state; `mechaHeadEffects.ts`
owns one prewarmed render target and fullscreen shader. Video capture updates in
three steps during the reveal, without stalling simulation. The target's longest
edge is capped at 1920 pixels. Photosensitivity Mode and reduced motion replace
tearing with a gentle fade. Pause freezes the bar, camera blend, fold and video;
destruction clears the presentation, and leaving disposes the GPU resources.

Mouse/trackpad/touch motion is averaged over a 50 ms sample window, capped at
0.366 rad/s in world space even while the legs turn. W/S first align the legs
within two degrees using the 30-degree/s turn clips, then walk forward/reverse
at 6.095 m/s with planted feet. Reverse plays Walk backward. Moving turns have a
12 m minimum radius; the torso cap usually yields a 16.7 m sustained circle.
Piloted collision uses separate height-aware animated body bounds with a 0.1 m contact margin, rather than the enemy route grid and its 14.78 m clearance circle. Swept movement slides along architecture, permits escaping existing overlaps, and uses the real border without a grid setback. Accepted distance drives walk playback; blocked travel retains acceleration/alignment intent. Enemy navigation still uses its original conservative route clearance.

Release movement for tighter turns. Turning stops within 100 ms of horizontal input ending; pitch keeps normal controls. Pause, boarding, windup and destruction clear recent input. Solid architecture/pillar and border clearance remain. Piloted travel permits lava, while enemy routes still avoid it. Ground-contacting feet cost one HP every 0.5 seconds of contact, once regardless of the number of feet, bypassing shields.
A/D, jump, hover, ordinary grapple, weapon switching, inspection and conversation
are disabled. The configured Grapple action (R by default) requests voluntary
shutdown instead; touch adds Exit in the inactive Inspect slot and retains Helmet
in the grapple slot. Touch uses Shield in place of Hover.

An accepted fire request plays the full three-second RocketFire animation. Translation and look freeze until the 1.5-second shot cue; look input during this period is discarded. The cassette's exported socket on `CTRL_RocketSlide_R` supplies the animated muzzle position/direction. This is the anatomical right arm despite its legacy `PART_Forearm_L_02` parent. Upper-body recoil then layers over locomotion and independent world yaw. Reload starts at release and lasts two seconds; another windup needs both reload and recovery completed, giving at least 3.5 seconds between releases. Held fire repeats.

Rockets fit 90% of the 0.52 m native barrel bore: 1.9015 m diameter after scaling, with 3.2 m hull/nose length. They travel the first three meters along the actual barrel axis with collision active. Thereafter guided flight steers current velocity toward a smoothly updated moving-target intercept at 120 m/s, with bounded angular changes and reduced loft near the shared 700 m travel limit. Acquisition at release uses the visible unobstructed NPC nearest the rendered crosshair, independent of HUD animation. The captured life/revision remains tracked off-screen; invalidation drops guidance without retargeting. Closed-helmet shots without a lock coast straight. Open/folding shots instead follow a launch-owned wandering route toward a landing point 75–100 m away; unobstructed ground contact cannot precede 50 m horizontal travel. Cover can intercept earlier.

Bounded 1/240-second curved sweeps use the fitted radius and hull endpoints; the nearest body/world contact wins. Cover intercepts rather than being routed around. Blast damage is 10 once per NPC within five meters, without falloff, additional direct damage or self-damage; cover blocks splash.

Mounting restores 50 HP without regeneration and a full shield-energy bar. The
pilot is protected and damage goes to the mech. Shift uses the hover bar: five
seconds of energy and three seconds to refill. Protection starts after the
0.5-second bottom-up shield build. Release/exhaustion removes protection instantly
and reverses the animation top-down, including partial builds. Recharge starts
on deactivation; exhaustion requires release before another activation. The
17 m surface, external-shot absorption, inside-origin bypass and ripples remain.
Rockets do not drain energy or trigger enemy shutdown, movement/firing continue,
and the eye stays yellow.

Enemy zero HP stops attacks/shielding/travel and first aligns the torso to the
unchanged leg heading along the shortest arc at 90 degrees/s. Within one degree
it finishes at zero offset and plays the full normal Death clip. Eye power fades
continuously from its defeat state through both phases. Only the completed Death
opens mounting; knee/fist cues remain relative to that clip.

Mounted zero HP captures the cockpit bean pose, ends pilot ownership and releases
the living bean immediately. FinalDeath starts at exported time 1.25 s with no
anticipation/crossfade, releases all collision and finishes its remaining 3.79 s
independently. The wreck cannot mount again. The pilot falls normally with zero
initial velocity; HP, life identity, weapon, hover fuel and death count survive.
Normal controls, weapons, goggles and HUD return without a death screen. Normal
hazards can subsequently hurt the released player.

Third person remains selected through breakup and afterward. A collision-safe
0.3-second simulation-clock handoff contracts the eye-centered mech boom to the
normal falling bean's shoulder camera. First person returns to the bean eye.
Release clears scope/fire/shield input and orange presentation; pause freezes the
handoff and destruction, and ordinary player death or leaving clears the handoff.

### Visible pilot and voluntary shutdown

The visual bean uses a separate chest-owned anchor and uniform scale 2, with its
head centered at the neutral lens height and its visor behind the lens. The
original grapple seat and both optical camera anchors are unchanged. Actual
skinned-armor triangle checks cover Mount, HeadOpen/Close, RocketFire and reversed
Mount. First-person draws hide the bean temporarily; third person shows the
complete occupant. Release restores the normal 1.5 scale and body bounds.

Only fully piloted ownership accepts Exit, once. `shutting-down` ends firing,
motion, manual shield and targeting, closes any open/folding helmet smoothly and
aligns the torso with its legs. The startup video reveal then runs backward for
0.3 seconds, followed by a 0.4-second HUD fade under black, before the original
Mount plays backward. Photosensitivity/reduced-motion modes use the same gentle
fade as startup, in reverse. The actor is protected like startup. A black screen carries the orange **Shutting
down...** bar from zero through 100%; camera relocation stays behind black, then
the opening cabin becomes visible. Third person retains its selected view and
also receives shutdown presentation. Pause freezes closure, reverse playback,
presentation and release.

After reverse Mount completes, a normal-sized living bean exits in front of the
open cabin, searching its sides if cover blocks the front. Placement checks both the actor's coarse proxies and static world
geometry; static swept clearance prevents passing through nearby cover. A
completely blocked exit waits for clearance. Ownership ends before the one-shot
release callback; HP, life, weapon, fuel, death count and selected view survive.
The existing 0.3-second third-person camera handoff and normal gravity resume.
The robot remains mountable at zero HP, and remounting restores the original
50 HP/full shield. Mounted lethal destruction still uses immediate FinalDeath
breakup and cannot remount.

## Ownership and lifecycle

`forgottenMecha.ts` owns the actor, animation clock, independent waist targeting,
skin fitting, twenty-five moving skin/material proxies and model resources. `mechaNavigation.ts`
owns the static navigation grid; `mechaFootPlant.ts` owns the foot constraint.
The actor owns `mechaCombat.ts` (shared detection/attack-region classifier,
simulation clocks, laser volumes, shot history and shield transitions) and `mechaCombatEffects.ts` (reusable meshes, eight
shader impact slots and at most 192 instanced particles). The effect group uses
world coordinates as a scene sibling of the actor; it is warmed during renderer
preparation and disposed with the actor. All attack tuning lives in `config.ts`.
`world.ts` awaits asset loading before renderer preparation and appends the small
dynamic proxy set to spatial queries without rebuilding the static world hash.
Cancelled loads dispose late-arriving assets without attaching them to a new match.

`mechaMovement.ts` owns fitted sweeps/slide/overlap escape separately from enemy navigation; `mechaPilotRelease.ts` restores the on-foot body/input without resetting player life. `thirdPersonCamera.ts` owns the bounded release boom transition.

`mechaPilot.ts` owns timed pointer samples and actual view yaw and manual locomotion; its
`mechaRockets.ts` owns immediate targeting, sixteen reusable rockets and 192
instanced smoke/blast slots. The actor owns seat/visual-pilot/view/muzzle anchors and the
boarding/startup/piloted/shutdown/destruction modes, masked animation layers, firing/helmet phases and lava tick time. `lookInput.ts` routes both pointer-lock
and touch intent. Manual shielding reuses combat's surface/effects without
running enemy shutdown logic. Pause freezes all these simulation clocks and
leaving disposes them; externally owned bean visuals detach before GLB disposal.

Projectile and sniper obstacle hits dispatch through the `damage.ts` seam. Goggles
use the existing orange enemy scan with the exact name and live health when LOS
is clear. Through cover, only four subtle orange jittering/flickering corners
remain; they never acquire a homing lock. Photosensitivity/reduced motion makes
the hint steady. Detection uses the physical envelope independently of chunk
visibility, and the hint applies only to a living enemy actor. An
oversized body keeps its callout inside the scope viewport. Their
offline homing identity is invalidated on death and is never serialized into a
WebRTC packet. The scan ignores the robot's own proxies but other queries retain
them, including movement, weapons, grappling and camera collision.

Metallic armor receives one match-owned, prefiltered reflection texture, baked
during preparation and dimmed at night. Ground particles share the existing
instance pool. Combat particles use a fixed instance buffer scaled by the applied
particle setting and remaining graphics budget, without extra lights.
`cameraShake.ts` changes only the temporary
render quaternion; the logical camera pose is restored after each draw.

Pause and player death freeze the offline actor, effects and cooldown. Player
respawn keeps the same robot; leaving disposes it. Game Over sets `matchEnded`,
freezes the completed match and blocks input reacquisition. A new match resets
that latch and creates a fresh actor.

## Verification

`tests/forgottenMecha.test.ts` uses the actual GLB skin and baked clips, stripping
only browser image decoding for Node tests. Coverage includes fitting, border
routes, LOS, independent targeting, impact timing, evasion, cooldown, death hold,
punch immunity/completion, goggles/homing and temporary camera shake.
`tests/mechaCombat.test.ts` covers acquisition and exclusion boundaries, charge
cancellation, exact yaw and frozen fire angles, airborne contact, physical reach,
single-hit and shrinking damage, reload, rolling shot history, shutdown timings,
pause and permanent death cancellation. `tests/mechaWeapons.test.ts` exercises
actual sniper and homing paths, inside-origin damage and nearer terrain. Real
asset tests also cover eye fitting, walking circles, committed attacks before
stomp, frozen shutdown and death during recovery.

On 2026-10-01, the initial in-app browser review verified real match preparation,
stationary torso tracking, orange goggles health/name, lethal grounded stomp,
death hold with ongoing gameplay, punch invulnerability, Game Over and menu cleanup.
The laser/shield review additionally verified the charged sphere, blue impact
ripple with unchanged HP/score, an upward pitched beam missing a sideways dodge,
obstacle termination, the complete two-shot warning/drop/rebuild sequence, an
aligned lethal airborne hit, paused combat clocks during player death, retained
robot and shot history after respawn, inside-origin sniper damage and ordinary
death with continuing play. The recorded cycle dropped protection at 115.77 s,
started rebuilding at 125.77 s and restored it at 126.27 s of combat time.
These reviews used temporary touch controls in the fixture; physical-device
touch and desktop pointer lock were not exercised.
A separate route audit found reachable wall approaches for all 64 seeds from
0 through 63.

The mounting review on 2026-10-01 exercised the real grapple into the completed
Death pose, boarding and complete Mount startup, the 23.31 m eye view at normal
75-degree FOV, permanent goggles, third-person targeting without its overlay,
and scoped first-person entry/release back to third person. Walking moved away
from the border; stationary turns and reverse playback retained the model's
gait, and blocked travel stopped at nearby pillars/lava. Guided rockets launched
from the right forearm with the two-second interval and eliminated test targets.
Manual shielding built upward, exhausted after five seconds, recharged while
remaining off until release, and held its partial build/energy/clock unchanged
through pause. FinalDeath completed at 5.04 seconds, then showed ordinary death
UI; respawn restored bean weapons and controls while the destroyed robot stayed
unavailable. Leaving removed the actor and scene. This review also used the
fixture's in-memory touch mode; physical-device touch and desktop pointer lock
remain separate device checks.

`tests/mechaMount.test.ts` checks exact cockpit/armor hits, front entry, boarding
arrival without overshoot, startup and helmet timing, fitted head-aligned bean
clearance against actual animated cabin/helmet skin through Mount, folding, recoil
and reverse Mount, world-yaw caps, turning
and reversing, manual shield transitions and one-shot final destruction.
`tests/mechaRockets.test.ts` checks immediate camera targeting, guided curves,
moving targets, stale life revisions, the 700 m boundary, cover interception,
unguided fire and cover-blocked single-application splash. The finishing-touch regression suite adds shot cue/freeze/recovery, exported socket and bore fitting, helmet reversal/layering, varied event/frame-rate turning, grounded lava ticks through shields, normal grapple binding from ground level, straight launch sweeps, continuous moving-target guidance and wandering landing checks.

Use `/tests/mecha-preview.html` under Vite to review the real game with visible
controls for finding the robot, changing distance and body height, holding an
airborne height, scanning, firing, death, the wall attack and match cleanup.
Cockpit aim/grapple and a ground-level upper-cabin approach, a one-second pointer turn, helmet toggling, lava placement, forward/reverse walking, view switching,
targets ahead, continuous rockets and held shield controls exercise piloting.
Automatic sideways evasion creates real horizontal misses without changing AI
or damage. Event pause controls expose charge, firing, shield drop, mid-rebuild, rocket windup and helmet folding
frames while keeping simulation frozen; visible clocks and phase history help
verify pauses. It selects touch input in memory so
pointer lock is not required; it does not save settings. The iframe keeps the
review toolbar visible instead of requesting fullscreen. This fixture is not
included in the production entry.

Finishing-touch validation on 2026-10-01 passed `npm run check` (both TypeScript
projects and 319 tests) and `npm run build`, regenerating tracked `dist/`. The
in-app browser reviewed normal ground-level upper-cabin grapple entry, complete
startup, the yellow eye in front asset view, orange normal/scoped goggles, cyan
open-helmet scans with zero lock classes, third-person presentation, paused
right-cassette windup at 1.25 seconds, release/recovery with a live guided kill,
post-release walking/turning and helmet folding. Lava placement damaged the mech
through the manual shield and completed FinalDeath; ordinary deaths were reviewed
in both views and mounted deaths in both views had no frozen blue particle burst.
Respawn restored normal controls and leaving removed actor ownership/effects.
Input event/frame rates and wandering landing distances were covered by the
regression suite; physical trackpad, pointer-lock and touch-device feel remain
device checks.

Head-view validation on 2026-10-01 passed both TypeScript projects and all 323
tests via `npm run check`, then `npm run build` regenerated tracked `dist/`.
The real-game browser fixture reviewed the physical helmet blocking the rear
camera before frame 27, paused orange loading, the full bar and black goggles at
the standing pose, broad video tearing, and the gentle Photosensitivity Mode
fade. Opening/closing returned between the interior and eye-center views; open
scoped scans kept their normal cyan styling, and third person retained the full
model/external camera during folding. Destruction during a paused helmet blackout
cleared that presentation, completed FinalDeath and showed the normal death UI.
Respawn restored normal controls and removed both mecha presentation classes;
leaving removed the actor and scene. This used the fixture's temporary touch mode;
physical pointer-lock, trackpad and touch-device checks remain separate.

Movement and survival validation on 2026-10-02 passed both TypeScript projects
and all 334 tests with `npm run check`; `npm run build` regenerated tracked
`dist/`. The new lifecycle suite covers fitted sweeps, sliding, corners, overlap
escape, height/border clearance, blocked gait recovery, both defeat-turn
directions and the wraparound boundary, gray-eye continuity, all six animated
leg volumes at regular and irregular frame rates, living release and camera
contraction. These destruction checks supersede the earlier pilot-death behavior
recorded above.

The real-game browser fixture reviewed a sideways defeat with paused alignment,
fixed leg heading and complete Death before cockpit availability. A real grapple
entered the cockpit; the mounted mech then walked beside a pillar inside the old
navigation setback. Piloted zero HP paused immediately at the 1.25-second breakup
cue with ownership ended, player HP unchanged at 10 and third person retained.
After resuming, the player fell to the floor, the wreck remained unavailable,
and ordinary weapons/jumping worked. A subsequent ordinary death and respawn
retained third person, and leaving removed the actor and scene. Standing above
an animated foot without floor grounding was lethal at the 1.625-second stomp
impact. This review used temporary touch input in the fixture; physical-device
touch and pointer-lock feel remain separate checks.

Initial Mecha follow-up automated validation on 2026-10-02 passed `npm run check`:
both TypeScript projects and all 341 tests. Regressions cover 25/60/130 m
selection, committed attacks before stomp, lost-LOS wandering release, normal
sideways walking at 30/144 Hz, covered scans losing homing and accessibility
fallback, shared three-release shield shutdown, render acknowledgment and stale
hit cleanup, actual-skin pilot clearance, reversed Mount, protected shutdown,
one-shot living release and remounting. The production build was regenerated.
Those initial checks did not cover inside-beam visibility, the authored covered
rocket pose or wall-blocked exit with free side space. No interactive browser
acceptance was run for this follow-up; the user owns the checklist below.
Earlier browser reviews remain historical
and do not verify these changed behaviors.

Repair and balance validation on 2026-10-02: the affected suites passed 51 tests;
final `npm run check` passed both TypeScript projects and all 345 tests.
`npm run build` regenerated production assets successfully with the existing
large-chunk warning. Regressions cover inside-beam visibility and actual draw
acknowledgment, covered authored launch independent of hidden movement, safe
side release at a front wall, four mixed releases/five-second shield downtime,
and reversed video/HUD presentation before Mount. Interactive acceptance remains
unperformed by the agent and belongs to the user below. The original requests
have been restored verbatim in `to_be_changed.md`, rather than rewritten as results.

Cylinder/dome validation on 2026-10-02: affected combat/actor suites passed
40 tests, and the updated lifecycle suite passed 11. Final `npm run check` passed
both TypeScript projects and all 349 tests; `npm run build` regenerated `dist/`
with the existing large-chunk warning. Whitespace validation passed. Regression
coverage includes translated ground origins, the 25/60/130 m and 28 m seams,
spherical boundaries and apex, LOS, committed region changes, and actual animated
launcher aim/physical airborne hits. Older defeat fixtures now hold laser reload
in the lower cylinder instead of using heights that correctly acquire dome rockets.
No interactive acceptance was performed; `to_be_changed.md` remained untouched.

## Current manual acceptance

Approach-warning validation on 2026-10-02: one `npm run check` passed both
TypeScript projects and all 345 existing tests; one production build regenerated
`dist/` successfully with the existing large-chunk warning. Whitespace validation
passed. Visual acceptance remains with the user, and `to_be_changed.md` was unchanged.

The user performs these checks; automated results do not mark them complete.

- Start singleplayer: check the three-second white warning, pause/resume and
  steady accessibility presentation; it should not replay on respawn.
- Scan through/without cover, at low render distance and with accessibility modes.
- Check the 28 m ceiling and overhead dome: laser/stomp below, rockets above,
  with no acquisition outside the ground-centered 130 m sphere above the ceiling.
- Walk sideways across the rocket band; lose LOS during windup. Four mixed ranged
  releases should trigger the shield routine, with five seconds down before rebuild.
- Die to laser/stomp: see the beam/contact before damage and behind the death screen.
- Inspect the open-helmet pilot; exit with closed/open/folding helmet and near a wall.
  Check reversed goggles animation, pause/resume, living release and remounting.
