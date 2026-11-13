# Katana

The sixth weapon uses a black curved blade and silver grip. Equip with V
(rebindable), or cycle past Minigun with E, the wheel or touch Weapon.
Shared values live in `src/config.ts`.

## Controls and contact

Hold primary attack to charge; release to swing. A tap/partial charge deals five
damage within four meters. Three seconds gives full charge: ten damage within
ten meters, held indefinitely. The swing lasts 0.6 seconds; damage is active for
its first 0.4 seconds, once per enemy per swing. Recovery rejects new presses.

The forward 180-degree semicylinder has full player-body height and rotates with
view yaw/pitch. Physical boxes need an unobstructed contact witness. Ground,
walls, Mecha shields and protected lifecycle phases retain their normal authority.
The damage area follows current position/aim; the traveling crescent is cosmetic.

Switching, input loss, pause/chat, death, boarding and leaving cancel charge and
pending contact without releasing an attack. Touch cancellation also cancels.
Goggles and grappling remain available; attacks take priority over inspection.

## Presentation and assets

`katanaModel.ts` samples grip-centered right-to-left poses. `katanaLightning.ts`
owns reusable instance-local charge buffers; `katanaFlicker.ts` samples the
full-charge brightness loop. Connected arcs rise along the blade during charge.
Full charge/release retain bright effects through the cut, then fade. Gentle
presentation keeps steady, dimmer arcs without moving branches, sparks or charge
shake. Logical aim never changes from charge effects.

The editable Blender model, GLB, studio views, generation script and synchronous
mesh JSON live in `blender_assets/katana/`; see the
[asset guide](../blender_assets/katana/README.md). Each game instance owns its
geometry/materials so charging or disposal cannot change another sword.

## Ownership and multiplayer

`katanaCombat.ts` owns the pure clock and box/semicylinder contacts. `katana.ts`
owns local input, host attack state and transient effects. Damage and
weapon-network ports remain the integration boundaries.

KATANA is a weapon identity, not a firearm identity: `fire` packets reject it.
`melee_command` carries start/release/cancel intent, sequence and life ID. The
host checks admission, life, equipment/switch state, shared shot deadline,
sequence and elapsed charge. Clients cannot choose power, radius or duration.
Accepted `melee_event` packets drive presentation.

Host contact uses current accepted attacker poses each active update, including
release. Consumed-hit sets prevent repeats; captured target lives exclude new
respawns. Rejected cover/shield contacts remain eligible. Existing damage paths
handle NPC/player/Mecha health and attribution. All room participants need the
same build. Late joiners receive subsequent events without reconstructing a
charge already in progress.

## Charged hit feedback and nape execution

Charged cuts emit world-fixed ribbon vertices. Confirmed hits give the attacker
a bounded impact frame with baked struck-enemy/slash silhouettes. Hits group
under the original deadline; later contacts cannot restart it. Baking precedes
health/respawn updates so replaced targets retain the struck pose. Gentle mode
uses subdued outlines over the normal scene. Gameplay continues and renderer
state restores in `finally`.

A charged swing checks the animated Mecha rear nape before ordinary body damage.
A clear rear contact within range deals remaining HP through the normal lifecycle.
Shields/protected phases still reject it, own mounts are excluded and a consumed
body hit cannot become an execution later in the swing.

`katanaEffects.ts` owns bounded ribbons/impact snapshots; `mechaNape.ts` owns the
head-attached volume. Death, cancel, disconnect and reset remove transient geometry.
Host-only `melee_hit` feedback carries accepted life/swing/contact identities.
Parsing rejects forged damage and invalid identities; the receiver checks active
charge and replay state without applying gameplay damage.

## Verification

Existing combat/authority suites cover hit eligibility, recovery, cancellation,
parser/host rules, replay, life changes and Mecha protections. Presentation tests
protect instance ownership, accessibility and renderer restoration.

With Vite running, open `/tests/katana-preview.html` for real input/targets and
leave/restart. Tap and full charge should apply five and ten damage respectively;
held/cancelled input must not create extra attacks. Pose/charge/third-person and
gentle controls inspect presentation without saving settings. Paused pose controls
do not advance combat or deal damage.

`/tests/katana-feedback-preview.html` holds trail/impact effects and the real
rear-nape volume for inspection. Use actual multiplayer clients for transport
changes and physical touch devices for multi-finger input behavior.
