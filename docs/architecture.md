# Runtime architecture

## System boundaries

FPS Arena has three runtime layers:

```text
Browser client
  Three.js gameplay + DOM UI
       |                         \
       | HTTPS /api              \ PeerJS signalling
       v                          v
Cloudflare Worker              0.peerjs.com
  |              |
  |              +-- Cloudflare Turnstile verification
  +-- Durable Objects
  +-- Cloudflare TURN credential API

After setup, peers exchange gameplay packets over WebRTC data channels.
The Worker authorizes rooms and credentials; it is not the game-packet server.
```

The Worker also serves the static Vite output through its `ASSETS` binding. The browser never receives TURN API credentials, Turnstile secrets, room close capabilities belonging to another peer, or Durable Object access.

## Client startup and lifecycle

`index.html` owns the markup and CSS for the menu, settings panels, HUD, scope, pause screen, and death overlay. It loads `src/main.ts` as the module entry point.

`init()` in `main.ts` performs startup in this order:

1. Register damage callbacks used by otherwise decoupled gameplay modules.
2. Load persisted settings from `localStorage`.
3. Bind settings, menu actions, and pointer-lock lifecycle callbacks.
4. Register keyboard, pointer, wheel, resize, and unload listeners.
5. Construct the menu-only character/weapon preview.
6. Start the menu animation loop.

The gameplay renderer does not exist while the main menu is idle. Offline Singleplayer creates the Three.js scene, camera, renderer, lights, fog, pointer-lock controls, weapons, local avatar, hook mesh, and projectile pool, then builds a newly seeded world in stages. `worldLoading.ts` shows a black `Booting...` screen with a blue bar that eases upward but stays below full until world generation and renderer preparation finish. The player is placed at spawn before the bar finishes; the full bar flashes twice, the boot content fades into black, then the black overlay fades out over an already rendered gameplay frame. Multiplayer retains the white orbiting sun-and-moon world screen. Both modes use the same checkpoints and cancellation generation. `renderPreparation.ts` uploads textures and instance buffers and compiles lighting variants before the first playable frame. The pointer-lock/fullscreen request remains in the original Start click, before asynchronous work. The frame loop skips simulation during loading, but draws the prepared scene without simulation behind the final black fade, and resets its elapsed-time baseline afterward. Multiplayer creates the same match runtime after room verification; the host prepares its synchronized seed and clients wait for a snapshot before preparing that world. The offline clock remains at zero until input first activates play; a multiplayer room's clock also progresses in the prepared lobby.

Each loading checkpoint checks a generation token and the current scene/session. Leaving, failed startup, or a replacement match invalidates pending work. The synchronous world builder remains for deterministic tests and preview fixtures; both builders use the same ordered stages. The goth character model loads separately and can still be pending when world preparation completes.

Networking reports unexpected session termination through
`onMultiplayerDisconnected`; `main.ts` owns the complete idempotent runtime
teardown and preserves the reason in the appropriate host/join panel. Explicit
composition-root teardown suppresses that notification to avoid recursion.
Input release clears held actions synchronously even if the browser's unlock
event arrives later. A denied initial offline activation leaves a prepared,
retryable arena with no simulation updates.

Pointer lock is the practical boundary between menu state and active game input. Locking begins or resumes play and exposes the HUD. Unlocking clears held inputs, resets the hook, and shows the appropriate pause or main panel. Offline pause stops the complete simulation and its day/night clock; multiplayer continues simulating while its local player has the pause menu open. The offline pause menu can open and apply the shared settings panel, which returns to Pause instead of the main menu. Leaving a game disposes all match-owned objects, the world, the day/night cycle, the WebGL renderer/context, and pointer-lock controls before returning to the menu. Multiplayer cleanup also closes WebRTC connections, destroys PeerJS state, disposes peer meshes, and best-effort releases the server-side room or session. Persisted settings remain, and the local LLM may remain loaded only while its immediate-download setting is enabled.

## Module ownership

| File | Responsibility |
| --- | --- |
| `main.ts` | Composition root, renderer and UI lifecycle, input, frame loop, local health/death, regeneration, world-border warning |
| `lavaDamage.ts` | Floor-level lava contact and damage cadence; multiplayer pause preserves hazards and dead lives never tick |
| `mainMenu.ts`, `appearance.ts` | Menu preview, weapon display, and persisted suit color |
| `inputSession.ts`, `mobileControls.ts` | Shared input activation, selected keyboard/touch mode switching on all devices, touch capture, movement, and action controls |
| `mobileControlLayout.ts`, `mobileControlsView.ts`, `mobileControlsEditor.ts` | Validated touch layout, shared control geometry/markup, and inactive blank sky layout editor |
| `settingsMenu.ts`, `controlSettings.ts` | Settings UI, keybind translation, and crosshair configuration |
| `dayNightCycle.ts` | Eight-minute sky cycle, moving sun/moon, ambient lighting, fog color, and camera-following sun shadows |
| `config.ts` | Shared gameplay constants, world counts, network limits, weapon statistics |
| `state.ts` | Mutable client runtime state and reset helpers |
| `world.ts` | Deterministic staged/synchronous arena construction, render chunks, spatial indexes, targets, town/lava lighting, world disposal |
| `seededScenery.ts` | Shared grass/pillar/lava/vegetation recipes and original RNG order, with explicit rendering/collision ownership ports |
| `worldLoading.ts` | Loading-overlay paint, stage checkpoints, and cancellation generation |
| `renderPreparation.ts` | Offscreen WebGL resource upload and day/night shader preparation before play |
| `lavaGlow.ts` | Per-world texture baking for continuous lava light spill and source-chunk visibility |
| `town.ts` | Seeded central-town plots, walls, gateways, building shells, interiors, and wilderness exclusion |
| `physics.ts` | Local movement, gravity, hover fuel, ground/ceiling detection, and obstacle collision |
| `playerSpawn.ts`, `powerJump.ts` | House/church placement and per-life castle-exit power-jump unlock |
| `grapple.ts` | Hook ray acquisition, firing/pulling/release state, hook mesh updates |
| `thirdPersonCamera.ts`, `conversationCamera.ts` | Collision-aware shoulder view and eased character-conversation pose |
| `weapons.ts` | Weapon/avatar mesh builders, firing, hitscan/projectile creation, recoil, switching, inspecting, ADS and third-person presentation |
| `projectiles.ts` | Projectile pooling, delayed goggles homing, swept collision, local target/player hits, projectile retirement |
| `projectileHoming.ts`, `projectileFlight.ts` | Target identity/range, finite steering, fixed guidance steps and bounded host motion history |
| `targetVisibility.ts` | Shared sampled-body visibility for goggles and host acquisition |
| `projectileTrails.ts` | Pooled world-space projectile path history and post-impact tracer fading |
| `particles.ts` | Instanced debris, beams, exhaust, shockwaves, material pools, cleanup |
| `hudPresentation.ts`, `hud.ts` | Pure phase/input visibility policy, one DOM applicator, health flash ownership, bars, FPS, speed lines and accelerometer |
| `smartGoggles.ts` | Scoped enemy recognition, line-of-sight filtering, target-lock DOM lifecycle, and live distance/health callouts |
| `gogglesFailure.ts` | Match-scoped continuous anomaly-scan timer, terminal failure, shutdown timing, and input-release latch |
| `smartGogglesMath.ts` | Rotation-independent target-envelope projection, adaptive 45-degree callout layout, and target-surface distance math |
| `smartGogglesPeerMath.ts` | Stable avatar-envelope, visibility, and distance helpers for remote players |
| `gothGirlfriend.ts` | Rigged character loading, placement, animation, and fixed gameplay hitbox |
| `forgottenMecha.ts`, `mechaNavigation.ts`, `mechaFootPlant.ts`, `mechaCombat.ts`, `mechaCombatEffects.ts` | Shared siege robot, seeded border routes, animation/AI, torso laser, spherical shield cycle, planted feet, moving body proxies and reusable effects |
| `cameraShake.ts` | Temporary impact rotation applied only to the render camera pose |
| `mechaPilot.ts`, `mechaRockets.ts`, `lookInput.ts` | Cockpit boarding support, sampled pilot view/leg steering, immediate vehicle targeting, continuous pooled rocket guidance and shared timed touch/pointer look routing |
| `mechaHeadView.ts`, `mechaHeadEffects.ts`, `mechaTransitionCamera.ts` | Actor-owned simulation-clock helmet/boot and exterior entry/exit camera phases; main owns DOM composition and temporary render-pose application |
| `gothChat.ts`, `gothChatEngine.ts`, `gothChat.worker.ts` | Conversation UI, local WebLLM lifecycle, and inference worker |
| `gothKnowledge.ts`, `gothChatConsent.ts` | Character-file retrieval/prompt context and first-use model consent |
| `settings.ts` | Settings schema, validation, persistence, renderer settings, particle scaling |
| `multiplayer.ts` | PeerJS lifecycle, host/client topology, packet authorization and relay, world synchronization, peer avatars and interpolation |
| `mechaEndingTimeline.ts`, `mechaEndingPlayback.ts`, `mechaGameOverScene.ts`, `mechaEndingCastle.ts` | Shared terminal clock/readiness, async presentation lifecycle, deterministic on-demand castle destruction and fixed cinematic camera |
| `mechaEndingScenery.ts`, `mechaEndingDebris.ts`, `mechaEndingCamera.ts` | Seeded ending landscape, bounded precomputed pillar contacts and obstruction-aware close camera |
| `mechaNetwork.ts`, `mechaNetworkTypes.ts` | Host-owned mecha commands/state/events, exclusive pilot ownership, bounded replication, victim render acknowledgment |
| `networkTypes.ts` | Packet types and runtime validation of untrusted WebRTC data |
| `turnSecurity.ts` | Browser calls to the Worker and explicit Turnstile widget lifecycle |
| `worker.ts` | Public API routing, Turnstile verification, rate limiting, room/session capabilities, TURN credential exchange, asset serving |
| `turnRoom.ts` | Serialized room state machine, username reservations, admission tickets, and renewable session quotas |
| `roomIdentity.ts` | Shared username, peer ID and capability validation |
| `boundedJson.ts` | Streaming JSON size and read-deadline enforcement |
| `shotAuthority.ts` | Shared deterministic spread, shot/pellet ledger, cooldown and life/death validation |
| `spatialHash.ts` | Generic 2D point/segment spatial index used by the world and collision systems |
| `gameplayMath.ts` | Pure frame-delta and swept segment collision helpers |
| `mouseButtons.ts` | Decodes pointer button bitmasks, including simultaneous fire and ADS on Windows |
| `damagePulse.ts` | Short, overlapping-safe emissive damage flashes with material restoration |
| `userDataTypes.ts` | Typed accessors for Three.js `userData` payloads |
| `damage.ts` | Registered damage callbacks that break gameplay import cycles |
| `weaponNetworkPort.ts` | Registered networking adapter that breaks the weapons/multiplayer import cycle |

## Shared state and dependency seams

Most client systems mutate the singleton exported by `state.ts`. This is deliberate for the frame-driven game, but it makes lifecycle boundaries important: a new match must not inherit projectiles, input flags, health, hook state, peer references, or score from the previous one.

Two small modules keep the dependency graph from becoming circular:

- `main.ts` installs `processTargetHit` and `takePlayerDamage` into `damage.ts`; projectiles and multiplayer call the registered functions.
- `multiplayer.ts` installs broadcasting functions into `weaponNetworkPort.ts`; weapons can announce shots and hits without importing the full multiplayer implementation.

Keep these seams when adding behavior. New global imports from `weapons.ts`, `projectiles.ts`, or `multiplayer.ts` can reintroduce initialization-order bugs even if TypeScript accepts them.

Three.js objects carry typed metadata through the accessors in `userDataTypes.ts`. Use those accessors instead of scattering unchecked casts throughout gameplay code.

## Frame loop

`animate()` skips menu-preview rendering and match simulation while the world is loading. Otherwise it caps elapsed time at 50 ms to stop a backgrounded tab or render hitch from sending physics and projectiles through geometry. Its order is significant:

1. Advance weapon switching, recoil, inspection, ADS, and cooldown state; fire held automatic weapons when eligible.
2. Update local physics in substeps with at most half a unit of travel, then render-chunk visibility and nearby lava lighting.
3. Update hover, motion HUD effects, lava damage, and health regeneration.
4. Advance the grappling hook and interpolate remote peers.
5. Simulate projectiles and resolve swept hits.
6. Animate visible targets and particles.
7. Send a multiplayer state update when required.
8. Update border warnings, FPS, FOV/scope UI, and pointer sensitivity.
9. Publish adaptively resampled mouse/trackpad aim using the current zoom gain, copy the final accepted player pose to the on-foot avatar, resolve the collision-safe over-the-shoulder camera, project smart-goggles locks from that exact render pose, render, then restore the logical player position. Actions before this publication use the previous visible aim and homing lock; there is no separate smoothed render-only input pose. Preserve the rendered center ray for third-person grappling input. See [Desktop pointer input](pointer-input.md).

Moving damage or collision work across the networking or rendering steps can change authority, visual timing, and hit positions.

Health width and damage-flash ownership are independent. Normal mounted/regen
ticks preserve a live 100 ms flash; overlap replaces its expiry, and life,
health-owner and runtime transitions cancel stale callbacks. Voluntary Mecha
release restores the neutral on-foot bar. Respawn retains the actually equipped
weapon, cancels pending switching/inspection and normalizes its pose while
preserving match score, clock and terminal goggles failure. Fresh matches start
with Pistol and reset match state.

On-foot multiplayer lava remains active while local input is paused, using the
same tick cadence and one death per life. Offline pause freezes simulation and
does not consume hazard time. Regeneration keeps its independent timing policy.

## World generation and visibility

The map is a procedurally generated square arena. A Mulberry32 pseudorandom generator produces reproducible placements from a 32-bit seed. Pillars, lava, bushes, distant impostors, enemies, and generated canvas textures are recreated from that seed.

Every seed includes a central town enclosed by 70-unit-high, 10-unit-thick walls with outer-edge battlements, a continuous paved rampart and four open corner lookouts and four rectangular doorways, each 16 units wide and 20 units high, with solid wall lintels above. Six ordinary houses, one guaranteed goth house and one guaranteed church use a separate seed-derived random stream for their arrangement, dimensions, heights and colors. Their plots preserve a central plaza, cardinal streets and paths to every door. A fixed rectangular stone well with water and a wooden roof occupies the exact center in every seed; there is no terrain pit. Initial spawns use house centers at eye height 2, facing the doorway. Offline players and the host use house slot zero. After secure admission, the host reserves a distinct house slot for each client and includes it in that client’s world snapshot; departures free only that slot, leaving other assignments stable. Every death respawn uses the current seed’s church center aisle, facing the exit. The well retains clear routes around it. Houses have open doorways, a simple crate and bench inside, and solid flat rooftops usable for movement and grappling. Shell walls stop at the roof underside, and roof slabs have a small overhang; adjacent shell sections meet without intersecting. This avoids coplanar exterior faces that flicker as the camera moves. The church occupies one seeded plot, with a clear central aisle, pews, an altar, a stepped gable roof, and a front bell tower. The tower reaches exactly 56 units including its cross (80% of the main wall height); all structural parts use the same box bounds for visuals, collision and grappling. Wilderness pillars, bushes and lava (including every lava-chain extension) stay outside the town and its approach apron. Targets are placed clear of obstacle bounds, including during respawn.

A six-unit-wide straight stair cantilevers from the inside face of the west stone wall, centered at x=-82 and starting at z=60. Its 234 thin stone treads rise approximately 0.299 units each (just below the 0.3-unit player step allowance), with 0.17-unit treads: a roughly 60-degree ascent over 39.78 horizontal units. The underside remains open instead of forming a solid triangular support. An eight-unit-deep level landing near (-82, 70, 16.22) exactly fills the opening and meets the west rampart. A continuous dark-wood rail with solid posts guards the exposed edge of the flight, follows the landing, and wraps back to the wall across its far end so a player continuing straight cannot fall. The entire ascent stays south of the west gate, clear of all doorways. Walking input is tested across 20–240 FPS and variable frame durations; smaller treads can cause intermittent collision stops. The lookouts each have four posts and a roof above the deck. The one-unit-high outer stone parapet continues around both exposed corner edges, with open approaches from both adjoining wall walks. Outer posts rest on the parapet, and the stone sections meet without overlapping faces.

Town box visuals are batched into fourteen material instance sets: twelve for chunked structures and well water and two permanently rendered ground sets. The goth house is identified only in code and excluded from initial player spawns. It has charcoal masonry, solid stepped gables and buttresses, with decorative spires, lancet windows, a rose window, bat grotesques, iron cresting, candles, a chandelier, banners, a hearth and coffin-style furniture. These decorative shapes share six merged material meshes in one culled group; structural collision remains in the shared town box generator. Streets, the plaza, footpaths and room floors are partitioned into adjoining tiles at y=0, with no layered paving faces. The grass mesh has a matching cutout, and a separate invisible full-floor plane preserves grappling across both surfaces. Paving stays visible like the grass floor so distant chunk culling cannot expose a hole. Invisible colliders use the same box bounds as the solid geometry and remain in the spatial index when culled. Movement handles elevated lintels and roof slabs using each collider's bottom and top, with upward ceiling collision and floor support evaluated at the accepted horizontal position. Explicit `rebuildEnvironmentWithSeed` calls preserve their seed in both offline and multiplayer modes; ordinary new offline matches still choose a fresh seed.

Gameplay queries do not iterate the whole world. `world.ts` maintains separate spatial hashes for obstacles, lava pools, and targets. Point-radius queries support movement and nearby hits; grid-traversing segment queries support bullets, sniper rays, and grappling. Collision helpers use swept segment/sphere and segment/AABB tests to avoid tunnelling between frames. The goth girlfriend has one fixed 1.1-by-3.564-by-0.8 box proxy registered in the obstacle hash; movement, projectiles, sniper rays and grapples use this proxy without tracing her animated GLB meshes. Her own conversation and goggles visibility rays explicitly ignore that proxy after accounting for other intervening geometry.

Shot queries include the ground half-space without indexing an arena-sized
collider. Projectile centers stop one `PROJECTILE_RADIUS` above it; sniper rays
use zero radius. The host uses the same radius for broad-phase padding and exact
obstruction bounds, and clips replicated sniper beams at terrain. Straight
bullet/hitscan hit volumes for living peers do not depend on mesh visibility.
Horizontal movement requires the same camera clearance as upward ceiling contact.
Magnetic grapples test cover along the selected target's actual path and compare
distances from one aim origin. Mecha armor hooks store a collider-local anchor,
follow its current transform and release when that solid collider is removed or
disposed. Cockpit entry remains a separate verified opening/pull path.

Visible static props are largely batched into `InstancedMesh` groups by material. The world is divided into 200-by-200-unit render chunks. Packed full-capacity instance buffers are uploaded during preparation; crossing a chunk boundary then updates active chunks and copies only relevant matrices. Dynamic target billboards update every other frame. Shared geometries and materials are tracked so disposal removes match-owned resources without destroying reusable assets.

The render-distance slider is a chunk radius from 1 to 16, with 4 as the default. It affects visible town structures, pillars, lava, bushes, distant vegetation, enemies, and decorative lava. It does not remove gameplay colliders or spatial-index entries, so lowering it never changes physics or shot validation. When Lava Pool Glow is enabled, one per-world baked spill texture supplies continuous ground glow near visible pools and one movable point light follows the nearest visible pool. The glow strengthens after dark; this avoids a light per generated tile. All eight street lanterns contribute real flickering light together at night. The sun shadow camera follows the player on a snapped light-space texel grid; shader code fades its edges to avoid a moving hard boundary. Shadow quality and the glow toggle are runtime settings.

## Gameplay flow

The local player supports walking, jumping, air hover with rechargeable fuel, grapple movement, five weapons, aim-down-sights, inspection, and a presentation-only third-person view. Core values live in `config.ts`; avoid duplicating weapon or movement numbers elsewhere.

Each match prepares one [Forgotten Mecha](forgotten-mecha.md) before
renderer preparation. It navigates from a reachable random border point toward an
outer castle wall, stops to track visible nearby players, and can stomp grounded
players or beans touching its animated legs at impact. Initial defeat aligns the
torso to the legs at 90 degrees/s, then Death holds its solid final pose. Wall arrival
commits an invulnerable loss before the punch advances. A separate terminal frame
branch freezes gameplay and plays the shared ending, then opens Game Over after
the full punch and three-second aftermath. The cinematic castle is created only
under black at activation; seeded world geometry/collision remain intact. Host
snapshots and a bounded viewer-readiness barrier own the ending timeline. Late
viewers seek that clock after preparation instead of restarting the punch. Dynamic body proxies are
appended to spatial queries without changing static collision or visibility
indexes. The actor and its reflection texture belong to the match and are
disposed even when startup is cancelled. Multiplayer starts its host simulation
with the match and replicates the actor to every client.
Detection and acquisition share `classifyMechaAttack` in `mechaCombat.ts`, using
the existing player-position anchor relative to the actor’s ground position.
The 0–28 m cylinder selects stomp at ≤25 m, rockets at >25–<60 m and laser at
60–130 m horizontally. Above 28 m, only the ground-centered 130 m sphere detects
players, selecting rockets throughout its narrowing dome. LOS and readiness
remain separate from region eligibility. The eye laser follows a capped actual
torso yaw, then freezes a pitched 700 m beam. A chest-centered
17 m spherical shield absorbs external weapon shots while leaving movement and
grappling unaffected. Shot origin and impact context select shield/body damage;
four actual laser/rocket releases in an active minute trigger warning, five
seconds of shield downtime and the existing half-second rebuild.
Robot-owned combat clocks and GPU effects survive respawn. Offline pause or
player death freezes them; multiplayer keeps the shared actor running. Piloted movement uses height-aware part sweeps and sliding independently of enemy navigation. Mounted zero HP immediately releases the living pilot and plays FinalDeath from its breakup cue, retaining third person with a short camera-boom handoff. See the behavior document for exact phase and cancellation rules.

Projectile weapons reuse a preallocated pool. Every weapon has the sniper's 700-meter travel distance; simulated projectiles track muzzle-inclusive distance and clamp their final swept segment to that exact limit. When enabled in Graphics settings, each bullet also owns a pooled additive tracer that records its recent world-space path and fades briefly after impact, making direction changes visible without affecting collision. Guided projectiles use fixed 1/120-second steps, interpolate their target observations between render frames, cap angular turn speed and move along the midpoint of the old and new headings. Cubic tracer samples preserve the visible arc. Every guidance step owns one swept collision query; straight projectiles retain their single frame sweep. Collision checks sweep each projectile's previous-to-next segment against nearby obstacle AABBs, targets, and peer hit volumes. When a scoped shot is fired after the visual homing lock has completed, the selected NPC or opponent and its current life/revision are captured for the shot. The bullet flies straight until it has covered one-third of the target distance measured at fire time, then applies strong but finite steering toward the target's current position. At full minigun speed, one initial-distance sample is shared by each batch of ten bullets and a target change forces an immediate new sample; every other firing state samples each shot. The sampled threshold travels with multiplayer fire packets so all peers render the same delayed turn. Steering does not bypass obstacles or range, does not guarantee a hit, and never applies to the hitscan sniper, the sun, the moon, or the girlfriend. Each player hit volume is one solid yaw-oriented cuboid whose width, height and depth exactly match the complete bean body's maximum bounds, including the visor and booster but excluding weapons and name tags. The cuboid's empty corner space is hittable. Simulated bullets expand it by their actual 0.07-unit radius; sniper rays use the unexpanded bounds. The sniper uses a hitscan ray with the same range. Target damage is applied locally in offline play and only by the host in multiplayer. A killed target respawns with authoritative position, class, health, scale, color, and score.

While aiming through the goggles, each visible, unobstructed NPC target or multiplayer opponent within 1200 m is framed by a fixed maximum envelope. The inclusive scan cutoff uses the existing player-to-target distance, applies to the Mecha and girlfriend too, and immediately removes scans beyond it; sun and moon are exempt. Every eligible target retains its four scan corners, while only the five scan-box centers nearest the screen-center crosshair receive the leader, identifier and stats/warning callout. NPCs, opponents, visible Mecha, girlfriend and celestial bodies share these slots; exact screen-distance ties use target keys. Covered Mecha retains its corners-only hint without taking a slot. Selection updates each frame and changes replay callout entry/exit independently of corner and homing clocks; incoming reveals may overlap the brief outgoing retractions. Menu customization and lobby scans opt out through `SmartGogglesHud`'s `gameplayLimits: false` constructor option. The square frame follows the target center and scales with distance, but ignores model rotation, child animation and weapon visibility so a spinning cube or animated avatar cannot make the overlay jitter. Unclipped envelope coordinates preserve the frame's size while a target crosses a viewport edge. Target acquisition begins about halfway through the scope FOV's settle time, then runs its original roughly half-second sequence: four brackets visibly converge on the envelope, the 45-degree/horizontal leader draws outward, then an identifier types above the leader while the fact readout types below it. The sniper retains scan annotations but cannot acquire a red targeting lock; switching to it clears any pending or completed homing lock. For projectile weapons, when the reticle lies inside an in-range enemy scan box, four additional red brackets converge immediately after the yellow scan brackets. They occupy the 12, 3, 6 and 9 o'clock points of the notional circle through the yellow box corners, so each red vertex remains the same distance from the target center; projectile homing is unavailable until that red animation completes. If overlapping scan boxes compete, the enemy whose box center is closest to the reticle owns the red lock, and changing that winner immediately clears the previous lock before reacquisition. Normal enemies use an orange overlay identified as `Enemy`, with distance above health beneath the line. Targets beyond the shared weapon range but within scan range retain the red warning state and type only `OUT OF RANGE` beneath their identifier; annotations collapse after the complete envelope leaves the view. The visible sun and moon use their rendered sky-disc spheres for the same tracking animation and retain the blue overlay, identifying themselves as `sun` and `moon`; beneath that they show only their rounded mean distance from Earth—149,600,000 km and 384,400 km respectively—and never participate in health, weapon-range, or homing-lock classification. The girlfriend is detected from her fixed physical proxy rather than the animated model: her overlay is white, its identifier cycles through unreadable/redacted text, distance remains readable, her health cycles through corrupted symbols, and her complete annotation continuously glitches with stepped horizontal scanline tearing, side-to-side jumps and chromatic separation. Holding that anomaly in an active scan continuously for 30 seconds, including when it has only corners and no selected callout, permanently bricks the goggles for the current match: the scope performs a one-shot CRT line-and-dot shutdown, releases the aim view, and every later scan attempt displays only animated TV noise. The persistent Photosensitivity Mode setting replaces that noise with a steady black screen. Losing the anomaly lock before the threshold resets the timer, death does not repair the hardware, and only fresh-match initialization clears the failure. An eliminated locked target turns red, receives a drawn X, glitches through two partial fade pulses, and disappears in about half a second. During that sequence the overlay remains projected from the target's last world-space envelope as the camera moves, and clears immediately if its center leaves the goggles FOV. Other enemies participate in visibility checks, so a fully covered rear target is not annotated. The world-space NPC health bars are hidden during this mode to avoid duplicate health readouts. Peer state updates require canonical health totals consistent with alive/dead state so remote-player facts stay usable without making those self-reported values authoritative for hit validation.

Player damage records the last damage time for regeneration and kill attribution. Every host-validated shot or pellet applies damage immediately; taking damage does not create invincibility frames. Remote avatars use a short emissive red pulse on hit; their base materials are restored after the pulse, including when hits overlap. Death hides the avatar until a later live state update makes it visible again.

### Controls

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Move or steer while hovering |
| `Space` | Jump; while grappling, release into a boosted jump |
| `Shift` in air | Hover while fuel remains |
| Left mouse | Fire |
| Right mouse | Aim down sights |
| Hold `C` | Aim down sights; temporarily use first person while third-person mode is active |
| `R` | Toggle grappling hook |
| `E` or mouse wheel | Cycle weapons |
| `1`–`5` | Select pistol, shotgun, AR, sniper, or minigun |
| `X` | Inspect the active weapon |
| `P` | Toggle third-person presentation |
| Hold `Tab` in multiplayer | Show the host-ordered player list with suit-colored pixel faces and kills/deaths |
| `Escape` | Toggle pause; offline simulation stops completely, while multiplayer continues. Resume waits for pointer lock. If the browser requires a fresh gesture after Esc, click Resume. |

The composition root derives HUD visibility from `hudPresentation.ts` on input,
conversation and terminal transitions, before loading/paused frame returns, and
again before drawing. `hud.ts` applies ordinary visibility without letting value
updates decide it. The prepared boot reveal initializes the G-meter and Power
Jump with the other HUD elements while simulation remains frozen. Respawn uses
the same policy without replaying boot. Boarding/startup/shutdown hide the motion
readout; active piloting restores it. Helmet camera blackouts during piloting
leave ordinary telemetry visible and preserve ADS intent; scans/reticles still
require a clear view. The helmet-toggle cover sits below ordinary HUD, while
boot/shutdown retain their original layering. Mecha hardware fades retain their authored
phases but cannot overlay pause, chat, death or disposal.

World replacement increments `worldGeneration`; gameplay goggles release old
health-bar references at their next update. The Goth actor owns its animated
root and fill light, which follow render chunks; the world owns its always-active
hitbox. Lantern frame/glass instances are selected by their actual chunks;
flames and lights use the same selection. Preparation may temporarily include
all eight lantern light variants, then restores the current chunk mask. Lobby
flame instances own their instance buffers; their geometry/material stay shared
until the menu itself is disposed. Fresh-world construction rejects a populated
world; replacements use the disposing rebuild entry points.

## Multiplayer topology and synchronization

A room uses a host-owned PeerJS ID derived from its eight-character room code. Clients receive an arbitrary PeerJS ID and connect only to the host. The public PeerJS service provides signalling; WebRTC data channels carry gameplay, and the Worker supplies short-lived Cloudflare ICE servers.

The topology is a star:

```text
client A <----> host <----> client B
                    <----> client C
```

Clients do not connect directly to each other. The host parses and authorizes client packets, applies authoritative target changes, and relays approved presentation/gameplay messages to the other clients. The maximum room size is five sessions including the host. Names are fixed for the session and unique within the lobby regardless of capitalization. Departure releases the name; unadmitted reservations expire after five minutes. The host broadcasts `peer_left` so every client removes the departed avatar.

Before play, the host also owns an ordered `lobby_roster`: host first, then admitted connections in admission order. Clients report only their validated 24-bit `lobby_color`; they cannot set identities or roster positions. The host republishes the roster after admissions, departures, and color reports. Clients queue it while preparing their world and accept it only from the expected host. The menu renders the host at center and successive guests alternating left/right and receding by row. Lobby previews reuse the animated peer scan for every other player, with a typed name and no stats panel or homing lock. Each room size has explicit callout preferences; placement avoids other names and the left menu once, then retains its corner and leader length until membership or viewport changes. Reused spawn-house slots do not alter admission order. Starting play hides the previews but retains host admission order for the held-Tab list; disconnecting clears both.

During play, the host publishes a bounded `player_list` snapshot in admission order. It includes each admitted name and suit color with kills/deaths counted only from accepted `player_died` events. The host sends it on match start, admission, departure, color change, and confirmed death, so late joiners receive current scores after their world snapshot. Clients accept it only from their expected host. `src/playerList.ts` renders a pixelated front view of the bean and the held-Tab overlay; input release, window blur, pause, death, and disconnection hide it.

When a client's data channel opens, the host validates its single-use, peer-bound admission ticket through the Worker using the host capability. The Worker atomically reserves usernames case-insensitively and returns a proof known independently to the client; the client rejects snapshots before that proof. After admission, the host sends a `world_snapshot` containing the seed, a validated client house slot (1–4), score, and every target state. The client prepares the seeded environment, applies the snapshot, and places the player in the assigned house before entering play. Other host packets arriving during preparation are queued and replayed after snapshot application; the queue is bounded and stale-session callbacks are ignored. Duplicate snapshots are ignored so they cannot relocate an existing player. Afterwards the host sends `target_state` packets for changed targets and `kill_target` packets for respawns and score changes. Synchronized clients apply both while waiting in the lobby as well as while playing.

Local state is eligible for transmission every 33 ms. Position, view angles, hook position, and flags are quantized; unchanged state is suppressed but forced at least every 250 ms. Remote positions and yaw are exponentially interpolated.

### Packet authority

| Packet | Origin | Host behavior |
| --- | --- | --- |
| `update` | Any player | Bounds position, charges cumulative travel against a capped receipt-time budget, validates life and weapon-switch phases, relays |
| `fire` | Any live player | Checks the previous shot's cooldown deadline, completed weapon switch, minigun ramp and barrel proximity; records a unique shot ID and deterministic pellet directions; canonicalizes pellet count |
| `hit_target` | Shooter client | Requires a matching recent shot, exact weapon damage, target intersection, clear path, and burst allowance; host applies damage |
| `player_hit` | Shooter client | Applies the same fire/path checks, rejects self-hits, records attacker for death attribution, relays |
| `player_died` | Victim client | Consumes one death per life ID, validates recent player damage, and attributes kills by peer ID with a separate lava cause |
| `peer_left` | Host only | Removes departed avatars and hook visuals on every client |
| `lobby_color` | Admitted client before play | Updates only that client's suit color and republishes the host-owned roster |
| `lobby_roster` | Host only | Synchronizes the ordered waiting-room lineup, including names and suit colors |
| `player_list` | Host only | Synchronizes the ordered active-match names, suit colors and confirmed kills/deaths |
| `mecha_input`, `mecha_board` | Admitted live player | Checks sequence, life, revision, cockpit arrival and exclusive ownership; applies host simulation inputs |
| `hit_mecha` | Shooter | Consumes an accepted shot/pellet against canonical armor/shield/world contacts and firing revision |
| `mecha_state`, `mecha_event` | Host only | Replicates actor pose, cockpit owner, attacks, player damage, release and terminal match state |
| `jump` | Any player | Relays as a visual event after an initial state update exists |
| `world_snapshot` | Host only | Initializes a joining client's deterministic world |
| `target_state` | Host only | Replicates target health and other incremental state |
| `kill_target` | Host only | Replicates target respawn and score |

Every received value first passes `parseNetworkPacket()`. It rejects unknown packet types, malformed structures, invalid usernames/weapons, non-finite or excessive coordinates, invalid directions, and oversized target snapshots. Do not handle a newly introduced packet before adding strict parsing for it.

Movement allowance replenishes at `NETWORK_MOVEMENT_SPEED`, derived from enemy
grapple pull, walking and jump values, and is capped by `NETWORK_MOVEMENT_BURST`.
It is independent of packet count and resets only on admission or an accepted
new life. Rejected movement/weapon updates do not mutate life, position or the
shot ledger. This is a plausibility envelope for client simulation, not host
physics simulation.

Updates require `switchState` and `nextWeapon`: withdrawal keeps the old weapon,
bring-in equips the pending weapon, and idle clears the pending identity. The
host verifies both 0.15-second phases, with one network tick of bounded timing
tolerance across the whole transition. Delayed bursts can finish the original
intent on a later idle update. Fire is rejected during either phase. Switching
does not shorten the previous accepted shot's deadline, and cadence jitter
cannot compound. Pellet counts always come from weapon configuration on the
host and viewers. Room participants must use the same client build; packets
from older builds missing the required switching fields fail parsing.
The composition root publishes each phase change immediately rather than
waiting for the movement throttle. A newly begun withdrawal starts its clock
at zero; elapsed time from before the switch intent cannot shorten it.

Hit reports reference a shot ID and pellet index. Each pellet can cause one
accepted hit with shared spread, exact damage, range and obstruction checks.
Homing fire requires the captured NPC revision/opponent life and its steering
threshold. Acquisition checks the host aim envelope and sampled body visibility,
including partially exposed silhouettes. The threshold must match recent
host-owned raw/filtered motion history; only a full-speed Minigun may reuse its
accepted sample for a ten-shot batch. The host replays the same 120 Hz guidance,
including the 0.1-unit muzzle offset, finite turns, floor/obstacle and intervening
body contacts. Incidental hits use that curve too; they cannot fall back to an
unsteered ray. Old target lives cannot authorize damage to replacements.
Acquisition retains exact body-box reachability. During flight, both simulations
use the same enclosing body radius to decide whether guidance can continue near
the range boundary; this does not enlarge collision shapes or the 700-unit
muzzle-inclusive travel limit. The player bound encloses the asymmetric visor
and booster relative to the body origin.

Each tracked target retains at most 128 receipt-time samples, coalesced into
guidance-time bins. At most 12 observation candidates cover up to 150 ms of lag;
replay permits 0.35 units of pose error and 100 ms of arrival grace. Range limits
each candidate to 94 steps (1,128 per claim), and a per-shooter token budget caps
acquisition/replay work at 40,000 step units per second plus one bounded burst.
Every guided-fire context/history search is charged 256 units before it starts,
including searches that produce no candidates; visibility checks also consume
the budget.
Claims whose required history has expired fail closed. These bounds deliberately
limit compensation; they do not prove a client completed the visual lock
animation. Reduced-motion lock timings remain presentation only.

Host-originated damage uses the same attribution bookkeeping as relayed damage.
A dead peer cannot submit new shots; death acceptance retires outstanding claims.

The host is authoritative enough to reject many fabricated hits and target mutations, but this is not a dedicated authoritative simulation server: clients still simulate their own movement, health, and shot detection. Changes to competitive trust assumptions should account for that limit.

## Adding or changing a system

- `dayNightCycle.ts` installs a process-wide Three.js shader-chunk patch for
  sun-shadow edge fading. Changes need shader compilation and browser checks at
  noon, low sun, and night using the lighting fixture in
  [Development](development.md#browser-visual-checks).
- Mecha scan presence through cover is presentation only; it never authorizes a
  lock or changes obstacle authority. Enemy detection and acquisition
  share the lower 28 m cylinder and upper ground-centered 130 m spherical dome.
  Committed windups survive region changes; only lost LOS/life cancels laser
  charging. The launcher solves its actual rotating muzzle ray, and combined
  four-release history owns shield shutdown, with five seconds down before rebuild.
  Rocket profiles and player lives are
  captured per launch in the existing bounded pool.
- Mecha laser/stomp contact belongs to simulation, but main acknowledges completed
  draws (including the beam mesh's actual draw callback for laser) and delivers
  pending hits before the next active simulation frame. Preserve
  this order and clear pending hits across life/reset/disposal boundaries.
- The fitted visible pilot, grapple seat and optical views have separate anchors.
  Voluntary shutdown reverses the goggles video/HUD and Mount under actor-owned presentation clocks and
  releases a living bean into a mountable wreck; lethal destruction remains FinalDeath.
- Entry/exit capture the saved perspective and lock P/View plus temporary scope
  overrides until completion. Third-person swivels overlap existing animation
  clocks; external camera motion never delays control ownership. Apply and restore
  its pose in the render-camera try/finally boundary. Voluntary release starts
  its handoff at the last rendered front pose; destruction keeps the eye boom.
- Put tunable shared values in `config.ts`, not inline in several consumers.
- Put pure collision or input logic in a DOM-free helper so Node tests can import it.
- Update reset and disposal paths whenever state, timers, Three.js resources, connections, or listeners gain a lifecycle.
- Reuse scratch vectors, object pools, shared geometry/materials, instancing, and spatial queries inside hot paths.
- For a packet change, update its type, parser, sender, host authorization/relay policy, receiver, and tests as one unit.
- For a Worker room-rule change, keep `turnRoom.ts` platform-independent and test the state machine directly.
- For a settings change, update the interface, defaults, persisted-value validation, UI controls, pending/apply synchronization, and renderer/runtime consumer.

Build and verification requirements are documented in [Development](development.md). Cloudflare credential and room behavior is documented in [Cloudflare operations](operations.md).

## Multiplayer mecha ownership

The host advances one actor after match start independently of local input and
player death. Clients interpolate host bone poses and effects without running
actor simulation. `ownsPilot` means the shared seat is occupied;
`ownsLocalPilot` gates local cameras, input, HUD, weapons, physics and damage
routing. Ordinary avatar interpolation cannot move a seated remote bean.

The coordinator gets accepted player poses from multiplayer's runtime, in lobby
admission order. Acquisition retains one eligible target; physical attacks test
all affected lives. Rocket targeting reconstructs the actual pilot perspective
and queries physical targets independently of the host's render chunks. The
existing local damage and weapon-network ports remain the integration seams.

Initial world snapshots include the complete current mecha presentation and
terminal state. State, commands and events have independent bounded sequence
checks; actor revisions retire pre-defeat/pre-boarding shots. Remote input is
neutral after 250 ms without refresh. Host simulation never waits for a render
acknowledgment; each victim queues its authoritative laser/stomp contact until
local drawing, with actual beam drawing required for laser damage. Disconnect,
reset and disposal invalidate coordinator state together with the world.
