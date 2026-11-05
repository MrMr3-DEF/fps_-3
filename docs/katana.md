# Katana

The sixth weapon is a simple black curved blade with a silver grip, held with
the cutting edge forward at a 1.368 presentation scale. The resting grip sits
low in the right corner, with the blade tilted farther forward. Equip with
**V** (rebindable in Settings), or cycle past the minigun using E, the wheel, or
the touch Weapon button. Existing 1–5 firearm keys are unchanged.

Hold primary attack to charge and release to swing. A tap or partial charge deals
5 damage in a 4 m forward area; at 3 seconds, it deals 10 damage in a 10 m area.
Full charge can be held indefinitely. Both grip-centered animations last 0.6 s and cut horizontally right to left.
Normal: lift 0–0.1 s, cut 0.1–0.3 s, return 0.3–0.6 s.
Charged: lift 0–0.1 s, fast cut 0.1–0.18 s, hold the end pose
0.18–0.35 s, then return 0.35–0.6 s. Charged illumination stays bright
through the hold and fades during the return. Damage is active from release through 0.4 s, once per enemy per swing.
The last 0.2 s is recovery only. Recovery ignores new presses; press again when it finishes.

The volume is a 180-degree forward semicylinder centered on the body, with the
full player hitbox height (3.3 m). View yaw and pitch rotate the whole volume.
At level aim it spans feet to head. Physical body boxes must intersect it and
have an unobstructed contact witness; walls and the ground block damage. The
charged wave is cosmetic: eligible targets take damage when first contacted during the 0–0.4 s window.
The damage area follows current position and aim; the visual crescent retains
its release direction and launches once at 0.14 s. Mecha shield and protected lifecycle phases retain their existing rules.

The first 0.3 seconds have no visual effect; tight clusters of connected, jagged
white bolts with attached tapered forks then creep upward over 2.7 seconds. Longer leaders overlap across the charged area, with attached forks sharing
their brightness envelope so they read as connected electrical discharges.
Clusters and sparks cover both broad faces, both narrow edges, and the corners
around the full blade cross-section. Arcs, sparks, and halos stay within half a
blade width of the surface. There is
no continuous spiral or central strand.

At full charge the blade starts a fixed eight-second brightness loop, authored
once from seed 81423. It spends at least 80% of its time at 60–80% brightness,
with occasional 50–90% variations and no white clipping or near-black dropouts.
Every full charge restarts the same sequence; release continues its phase before
the existing recovery fade. Percentages are converted from display brightness
to linear emission. Gentle effects use steady 70% brightness and stationary
clusters without sparks. Cancellation clears the effects immediately.
A charged slash launches a solid-looking white crescent with tapered ends and
visible thickness. It moves forward over 0.3 s without expanding, reaches 10 m
at its leading tip, and stays entirely inside the damage footprint. It fades
only during the final fifth of its travel.
Photosensitivity Mode uses steady, dimmer arcs without moving branches, sparks,
or charge shake and lowers the attack wave opacity. Charge never changes logical aim.

Switching, input loss, pause/chat, death, boarding and leaving cancel charge and
pending contact; none acts like releasing attack. Touch pointer cancellation also
cancels rather than swings. Goggles and grappling remain available. Attack takes
priority over inspect animation.

## Ownership and multiplayer

`katanaCombat.ts` owns the pure clock and box/semicylinder contact helper;
`katanaModel.ts` owns shared geometry/presentation, and `katanaLightning.ts` owns
instance-local reusable charge buffers; `katana.ts` owns local input,
host attack state and bounded transient effects. Shared constants are in config.
The existing weapon-network and damage ports remain the integration boundaries.

`KATANA` is a weapon identity but not a firearm identity. The parser rejects it
in `fire` packets. `melee_command` contains only start/release/cancel intent,
sequence and life ID. Admission and host-only event routing are checked in the
multiplayer receiver. The host checks life, equipped/switch state, shared shot
cooldown, sequence and charge time, then emits `melee_event`. Clients cannot
choose damage, radius or charge duration. Host damage checks use the current attacker pose and target boxes each update
during the active window, including an immediate release check. A separate hit
set prevents repeats; captured eligible lives exclude replacements that respawn
during the swing. Rejected cover/shield contacts remain eligible. Existing target/player hit and Mecha
event paths carry confirmed damage and kill attribution.

All room participants need the same build. Mid-charge late-join presentation is
not reconstructed; that viewer sees subsequent charge/swing events normally.

## Verification

Run `npm run check` and `npm run build`. Focused suites are
`katanaCombat.test.ts` and `katanaAuthority.test.ts`, alongside existing weapon,
input, networking, shield and lifecycle regression tests.

With Vite running, open `/tests/katana-preview.html`. Start, then Equip / targets.
Clear view moves the review targets aside for unobstructed model inspection.
Tap reduces the two close targets from 50 to 45 HP and leaves the 5 m target at
50. Charged attack reduces all three by 10. Hold full charge reviews the blade
and shake; Third person and Toggle gentle effects are temporary preferences.
Toolbar focus changes exercise input cancellation. Leave and Start again check
cleanup. The fixture uses production gameplay without saving settings and is
excluded from production output. Real relay-network and physical-touch-device
validation remain separate from these local checks.

### Local verification — 5 November 2026

- `npm run check`: both TypeScript projects and all 527 tests passed.
- `npm run build`: passed; tracked production assets regenerated. Vite retains
  its bundle-size advisory.
- Browser: arsenal preview/specs, V equip, HUD, normal 5-damage multi-target hit,
  charged 10-damage hit including the distant target, full-charge blade,
  first/third-person attachment, gentle effects, leave and restart were checked.
- Real two-client WebRTC and physical touchscreen verification were not run.
  Mid-charge late-join visual reconstruction is not implemented.

## Model asset

The classic minifigure-inspired model uses a chunky curved black plastic blade,
a small black guard, and a plain polished silver grip. Its editable Blender source,
GLB, three studio views, and generation script live in `blender_assets/katana/`.
See that directory's README for regeneration. The script exports the same evaluated
surfaces to compact JSON, imported synchronously by `katanaModel.ts` for all weapon
views. Grip center and existing animation scale stay unchanged. Each instance owns
its geometry and materials so charging and disposal cannot affect another sword.

### Model replacement verification — 5 November 2026

- Generated 776 triangles; JSON positions/normals are finite with unit normals.
- Inspected front, side, and three-quarter Blender renders.
- `npm run check`: both TypeScript configurations and all 528 tests passed,
  including independent charge materials and instance disposal.
- `npm run build`: passed and regenerated tracked `dist/`; existing chunk-size
  advisory remains.
- Local browser: first/third-person presentation, inspect control, tap attack
  (40/40/40 to 35/35/40), charged attack (50/50/50 to 40/40/40),
  full-charge lightning, gentle effects, and leaving/cleanup checked.
- Real remote-client rendering and physical touch devices were not retested.

### Animated lightning verification — 5 November 2026

- Final `npm run check`: 531 tests passed; final production build passed.
- Focused tests cover the charge-front boundary, continued full-charge movement,
  reusable buffers, isolated instances, cancellation, and steady gentle effects.
- Browser verified base-first charge, full-blade moving white arcs/sparks, steady
  gentle presentation, focus cancellation, and leaving cleanup.
- Old static lightning data, line renderer, pulse ring, and blade flash removed.
- Remote-client and physical-device verification were not repeated.

The katana preview includes half/full charge and paused windup, impact,
follow-through, and recovery poses. Live animation releases the visual override.
These controls sample presentation only and do not advance combat or deal damage.

## Charged hit feedback and nape execution

Charged cuts also leave a curved white ribbon sampled from the blade sweep.
Emitted vertices stay fixed in world space; the ribbon fades for 0.3 seconds
(the sniper tracer lifetime) after the cut. The traveling crescent is unchanged.
All viewers generate trails from their sword instance and accepted swing timing.

Confirmed charged damage gives only the attacker a 120 ms impact frame: a dark
background with white struck-enemy and slash silhouettes. Hits in that interval
share its original deadline; later contacts from the same swing cannot restart
it. Enemy geometry is baked before NPC/player damage callbacks, preserving the
struck pose if a target immediately disappears or respawns. Photosensitivity Mode
uses subdued wire outlines and slash highlights over the normal scene instead.
Gameplay and logical aim continue normally. The overlay renders inside the
existing temporary camera boundary, with renderer state restored in `finally`.

A charged swing checks the Mecha's animated rear-nape box before ordinary body
contact. A clear rear contact within 10 m and the 0–0.4 s window deals its remaining
HP through the existing damage lifecycle. Shields and protected phases still
reject it. Own mounts are excluded; opposing piloted Mechas remain eligible.
One successful body hit consumes that Mecha's allowance for the whole swing,
so moving behind it afterward cannot upgrade the hit into an execution.

`katanaEffects.ts` owns bounded ribbons and baked impact snapshots. Cancel,
death, disconnect and match reset remove their transient geometry. The shared
reusable highlight material does not allocate per match. `mechaNape.ts` owns the
head-attached volume. Host-only `melee_hit` feedback carries attacker life/swing,
target life/revision, contact and execution status; the strict parser rejects
extra damage claims and invalid identifiers. The receiver validates the active
charged swing, rejects replayed contacts, and never applies gameplay damage.
Feedback is sent before NPC/player health/respawn replication so clients capture
the struck life; Mecha confirmation follows its accepted damage callback.

Focused presentation review: `/tests/katana-feedback-preview.html` holds the
production trail and impact effects still for inspection and shows the real
asset's nape volume in yellow. These review samples do not authorize damage or
change the production effect durations. Authority, replay/parser, world-space
trail lifetime, snapshot grouping/cleanup, render restoration, real-asset nape
fit and damage protections have focused automated coverage.

### Charged feedback verification — 5 November 2026

- `npm run check`: both TypeScript configurations and all 548 tests passed.
- Focused browser presentation review: world-space trail, normal impact frame,
  subdued gentle overlay, and actual asset rear-nape placement inspected.
- Real two-client WebRTC verification was not performed; automated authority and
  packet tests do not substitute for live multiplayer validation.
- `npm run build`: passed; tracked `dist/` regenerated. Existing bundle-size
  advisory remains. Source/docs whitespace check passed. No deployment.
