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
3. Create the Three.js scene, camera, renderer, lights, fog, and pointer-lock controls.
4. Bind settings and menu actions.
5. Bind pointer-lock state to the play, pause, HUD, and death UI.
6. Register keyboard, pointer, wheel, resize, and unload listeners.
7. Construct weapons, the local avatar, the procedural world, hook mesh, and projectile pool.
8. Start the animation loop.

Pointer lock is the practical boundary between menu state and active game input. Locking begins or resumes play and exposes the HUD. Unlocking clears held inputs, resets the hook, and shows the appropriate pause or main panel. Multiplayer cleanup also closes WebRTC connections, destroys PeerJS state, disposes peer meshes, and best-effort releases the server-side room or session.

Starting a fresh arena disposes world-owned graphics and rebuilds them. Offline matches choose a new random seed. A multiplayer host chooses a seed, and joining clients rebuild from the host's snapshot before the Join button becomes ready.

## Module ownership

| File | Responsibility |
| --- | --- |
| `main.ts` | Composition root, renderer and UI lifecycle, input, frame loop, local health/death, lava, regeneration, world-border warning |
| `config.ts` | Shared gameplay constants, world counts, network limits, weapon statistics |
| `state.ts` | Mutable client runtime state and reset helpers |
| `world.ts` | Deterministic arena construction, procedural textures, render chunks, spatial indexes, targets, world disposal |
| `town.ts` | Seeded central-town plots, walls, gateways, building shells, interiors, and wilderness exclusion |
| `physics.ts` | Local movement, gravity, hover fuel, ground/ceiling detection, and obstacle collision |
| `grapple.ts` | Hook ray acquisition, firing/pulling/release state, hook mesh updates |
| `weapons.ts` | Weapon/avatar mesh builders, firing, hitscan/projectile creation, recoil, switching, inspecting, ADS and third-person presentation |
| `projectiles.ts` | Projectile pooling, swept collision, local target/player hits, projectile retirement |
| `particles.ts` | Instanced debris, beams, exhaust, shockwaves, material pools, cleanup |
| `hud.ts` | Health/reload/hover bars, FPS, speed lines, accelerometer |
| `settings.ts` | Settings schema, validation, persistence, renderer settings, particle scaling |
| `multiplayer.ts` | PeerJS lifecycle, host/client topology, packet authorization and relay, world synchronization, peer avatars and interpolation |
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

`animate()` caps elapsed time at 50 ms to stop a backgrounded tab or render hitch from sending physics and projectiles through geometry. Its order is significant:

1. Advance weapon switching, recoil, inspection, ADS, and cooldown state; fire held automatic weapons when eligible.
2. Update local physics in substeps with at most half a unit of travel, then render-chunk visibility.
3. Update hover, motion HUD effects, lava damage, and health regeneration.
4. Advance the grappling hook and interpolate remote peers.
5. Simulate projectiles and resolve swept hits.
6. Animate visible targets and particles.
7. Send a multiplayer state update when required.
8. Update border warnings, FPS, FOV/scope UI, and pointer sensitivity.
9. Temporarily offset the camera for third person, render, then restore its logical position.

Moving damage or collision work across the networking or rendering steps can change authority, visual timing, and hit positions.

## World generation and visibility

The map is a procedurally generated square arena. A Mulberry32 pseudorandom generator produces reproducible placements from a 32-bit seed. Pillars, lava, bushes, distant impostors, enemies, and generated canvas textures are recreated from that seed.

Every seed includes a central town enclosed by 70-unit-high, 10-unit-thick walls with outer-edge battlements, a continuous paved rampart and four open corner lookouts and four rectangular doorways, each 16 units wide and 20 units high, with solid wall lintels above. Six ordinary houses, one guaranteed goth house and one guaranteed church use a separate seed-derived random stream for their arrangement, dimensions, heights and colors. Their plots preserve a central plaza, cardinal streets and paths to every door. A fixed rectangular stone well with water and a wooden roof occupies the exact center in every seed; there is no terrain pit. Initial spawns use house centers at eye height 2, facing the doorway. Offline players and the host use house slot zero. After secure admission, the host reserves a distinct house slot for each client and includes it in that client’s world snapshot; departures free only that slot, leaving other assignments stable. Every death respawn uses the current seed’s church center aisle, facing the exit. The well retains clear routes around it. Houses have open doorways, a simple crate and bench inside, and solid flat rooftops usable for movement and grappling. Shell walls stop at the roof underside, and roof slabs have a small overhang; adjacent shell sections meet without intersecting. This avoids coplanar exterior faces that flicker as the camera moves. The church occupies one seeded plot, with a clear central aisle, pews, an altar, a stepped gable roof, and a front bell tower. The tower reaches exactly 56 units including its cross (80% of the main wall height); all structural parts use the same box bounds for visuals, collision and grappling. Wilderness pillars, bushes and lava (including every lava-chain extension) stay outside the town and its approach apron. Targets are placed clear of obstacle bounds, including during respawn.

A six-unit-wide straight stair cantilevers from the inside face of the west stone wall, centered at x=-82 and starting at z=60. Its 234 thin stone treads rise approximately 0.299 units each (just below the 0.3-unit player step allowance), with 0.17-unit treads: a roughly 60-degree ascent over 39.78 horizontal units. The underside remains open instead of forming a solid triangular support. A thin level landing near (-82, 70, 17.22) turns directly onto the west rampart, while a continuous dark-wood rail with solid posts guards the exposed edge of both the flight and landing. The entire ascent stays south of the west gate, clear of all doorways. Walking input is tested across 20–240 FPS and variable frame durations; smaller treads can cause intermittent collision stops. The lookouts each have four posts and a roof above the deck. The one-unit-high outer stone parapet continues around both exposed corner edges, with open approaches from both adjoining wall walks. Outer posts rest on the parapet, and the stone sections meet without overlapping faces.

Town box visuals are batched into fourteen material instance sets: twelve for chunked structures and well water and two permanently rendered ground sets. The goth house is identified only in code and excluded from initial player spawns. It has charcoal masonry, solid stepped gables and buttresses, with decorative spires, lancet windows, a rose window, bat grotesques, iron cresting, candles, a chandelier, banners, a hearth and coffin-style furniture. These decorative shapes share six merged material meshes in one culled group; structural collision remains in the shared town box generator. Streets, the plaza, footpaths and room floors are partitioned into adjoining tiles at y=0, with no layered paving faces. The grass mesh has a matching cutout, and a separate invisible full-floor plane preserves grappling across both surfaces. Paving stays visible like the grass floor so distant chunk culling cannot expose a hole. Invisible colliders use the same box bounds as the solid geometry and remain in the spatial index when culled. Movement handles elevated lintels and roof slabs using each collider's bottom and top, with upward ceiling collision and floor support evaluated at the accepted horizontal position. Explicit `rebuildEnvironmentWithSeed` calls preserve their seed in both offline and multiplayer modes; ordinary new offline matches still choose a fresh seed.

Gameplay queries do not iterate the whole world. `world.ts` maintains separate spatial hashes for obstacles, lava pools, and targets. Point-radius queries support movement and nearby hits; grid-traversing segment queries support bullets, sniper rays, and grappling. Collision helpers use swept segment/sphere and segment/AABB tests to avoid tunnelling between frames.

Visible static props are largely batched into `InstancedMesh` groups by material. The world is divided into 200-by-200-unit render chunks. Crossing a chunk boundary updates active chunks and rebuilds only the relevant instance matrices. Dynamic target billboards update every other frame. Shared geometries and materials are tracked so disposal removes match-owned resources without destroying reusable assets.

The render-distance slider is a chunk radius from 1 to 16, with 4 as the default. It affects visible town structures, pillars, lava, bushes, distant vegetation, enemies, and decorative lava. It does not remove gameplay colliders or spatial-index entries, so lowering it never changes physics or shot validation.

## Gameplay flow

The local player supports walking, jumping, air hover with rechargeable fuel, grapple movement, five weapons, aim-down-sights, inspection, and a presentation-only third-person view. Core values live in `config.ts`; avoid duplicating weapon or movement numbers elsewhere.

Projectile weapons reuse a preallocated pool. Collision checks sweep each projectile's previous-to-next segment against nearby obstacle AABBs, targets, and peer hit volumes. The sniper uses a hitscan ray. Target damage is applied locally in offline play and only by the host in multiplayer. A killed target respawns with authoritative position, class, health, scale, color, and score.

Player damage records the last damage time for regeneration and kill attribution. Remote avatars use a short emissive red pulse on hit; their base materials are restored after the pulse, including when hits overlap. Death hides the avatar until a later live state update makes it visible again.

### Controls

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Move or steer while hovering |
| `Space` | Jump; while grappling, release into a boosted jump |
| `Shift` in air | Hover while fuel remains |
| Left mouse | Fire |
| Right mouse or hold `C` | Aim down sights |
| `R` | Toggle grappling hook |
| `E` or mouse wheel | Cycle weapons |
| `1`–`5` | Select pistol, shotgun, AR, sniper, or minigun |
| `X` | Inspect the active weapon |
| `P` | Toggle third-person presentation |
| `Escape` | Release pointer lock and pause |

## Multiplayer topology and synchronization

A room uses a host-owned PeerJS ID derived from its eight-character room code. Clients receive an arbitrary PeerJS ID and connect only to the host. The public PeerJS service provides signalling; WebRTC data channels carry gameplay, and the Worker supplies short-lived Cloudflare ICE servers.

The topology is a star:

```text
client A <----> host <----> client B
                    <----> client C
```

Clients do not connect directly to each other. The host parses and authorizes client packets, applies authoritative target changes, and relays approved presentation/gameplay messages to the other clients. The maximum room size is five sessions including the host. Names are fixed for the session and unique within the lobby regardless of capitalization. Departure releases the name; unadmitted reservations expire after five minutes. The host broadcasts `peer_left` so every client removes the departed avatar.

When a client's data channel opens, the host validates its single-use, peer-bound admission ticket through the Worker using the host capability. The Worker atomically reserves usernames case-insensitively and returns a proof known independently to the client; the client rejects snapshots before that proof. After admission, the host sends a `world_snapshot` containing the seed, a validated client house slot (1–4), score, and every target state. The client rebuilds the environment and places the player in the assigned house before entering play. Duplicate snapshots are ignored so they cannot relocate an existing player. Afterwards the host sends `target_state` packets for changed targets and `kill_target` packets for respawns and score changes. Synchronized clients apply both while waiting in the lobby as well as while playing.

Local state is eligible for transmission every 33 ms. Position, view angles, hook position, and flags are quantized; unchanged state is suppressed but forced at least every 250 ms. Remote positions and yaw are exponentially interpolated.

### Packet authority

| Packet | Origin | Host behavior |
| --- | --- | --- |
| `update` | Any player | Bounds position, limits implausible travel, records current weapon/death state, relays |
| `fire` | Any live player | Checks weapon, cooldown in milliseconds, minigun ramp and barrel proximity; records a unique shot ID and deterministic pellet directions |
| `hit_target` | Shooter client | Requires a matching recent shot, exact weapon damage, target intersection, clear path, and burst allowance; host applies damage |
| `player_hit` | Shooter client | Applies the same fire/path checks, rejects self-hits, records attacker for death attribution, relays |
| `player_died` | Victim client | Consumes one death per life ID, validates recent player damage, and attributes kills by peer ID with a separate lava cause |
| `peer_left` | Host only | Removes departed avatars and hook visuals on every client |
| `jump` | Any player | Relays as a visual event after an initial state update exists |
| `world_snapshot` | Host only | Initializes a joining client's deterministic world |
| `target_state` | Host only | Replicates target health and other incremental state |
| `kill_target` | Host only | Replicates target respawn and score |

Every received value first passes `parseNetworkPacket()`. It rejects unknown packet types, malformed structures, invalid usernames/weapons, non-finite or excessive coordinates, invalid directions, and oversized target snapshots. Do not handle a newly introduced packet before adding strict parsing for it.

Hit reports reference a shot ID and pellet index. Each pellet can cause one accepted hit, with exact shared spread, damage, travel-distance and obstruction checks. Host-originated damage uses the same attribution bookkeeping as relayed damage. A dead peer cannot submit new shots; death acceptance retires outstanding shot claims.

The host is authoritative enough to reject many fabricated hits and target mutations, but this is not a dedicated authoritative simulation server: clients still simulate their own movement, health, and shot detection. Changes to competitive trust assumptions should account for that limit.

## Adding or changing a system

- Put tunable shared values in `config.ts`, not inline in several consumers.
- Put pure collision or input logic in a DOM-free helper so Node tests can import it.
- Update reset and disposal paths whenever state, timers, Three.js resources, connections, or listeners gain a lifecycle.
- Reuse scratch vectors, object pools, shared geometry/materials, instancing, and spatial queries inside hot paths.
- For a packet change, update its type, parser, sender, host authorization/relay policy, receiver, and tests as one unit.
- For a Worker room-rule change, keep `turnRoom.ts` platform-independent and test the state machine directly.
- For a settings change, update the interface, defaults, persisted-value validation, UI controls, pending/apply synchronization, and renderer/runtime consumer.

Build and verification requirements are documented in [Development](development.md). Cloudflare credential and room behavior is documented in [Cloudflare operations](operations.md).
