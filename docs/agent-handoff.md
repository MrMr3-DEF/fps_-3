# Agent handoff

Snapshot: 25 September 2026, starting from commit `5c51b29` on `main`. The working tree was clean before this documentation pass. Recheck `git status` and the current commit before relying on this snapshot.

## First steps

1. Read [Architecture](architecture.md) for ownership and data flow, then [Development](development.md) for commands and browser fixtures.
2. Inspect the code around the requested change. `src/main.ts` composes the client, `src/state.ts` holds match state, `src/config.ts` holds shared values, and `src/worker.ts` handles the Cloudflare API. The architecture guide maps the remaining systems.
3. Use [Planned changes](to_be_changed.md) for the user's original requests and the feature notes for current behavior/manual checks. [Code audit](code-audit.md) and [Audit resolution](audit-resolution.md) explain older findings and repairs; do not treat the original audit list as current bugs.

## Current lifecycle to preserve

- `init()` creates the menu and installs the multiplayer world loader. The gameplay renderer is created only when a match begins.
- Offline start creates the match runtime, starts staged world generation behind the loading overlay, then prepares WebGL textures, buffers, and lighting variants. The initial pointer-lock/fullscreen request stays in the original click gesture. The frame loop skips simulation during preparation and resets its clock before play.
- The host registers a secure room before loading its seeded world. A joining client receives the host's `world_snapshot`, prepares that seed, applies the snapshot, and replays packets queued during preparation. Session and scene checks prevent an old async load from mutating a replacement match.
- Leaving or failing startup cancels loading, disconnects multiplayer when applicable, disposes match-owned Three.js resources, and resets player and match state. Review both the success and failure/exit path whenever adding a resource, timer, or async task.
- The synchronous `createEnvironment()` path remains for deterministic tests and development fixtures. Keep its stage order aligned with `createEnvironmentAsync()`.

## Change-sensitive boundaries

- Singleplayer now awaits the Ironmaw GLB and one robot-owned reflection texture
  before renderer preparation. `forgottenMecha.ts` owns the robot and its moving
  body proxies; `world.ts` appends those proxies to query results. Match ending
  uses `state.matchEnded`, which prevents both simulation and input reacquisition
  until leaving resets the match. Keep robot loading/cancellation/disposal in sync.
  See [Forgotten Mecha](forgotten-mecha.md) and `/tests/mecha-preview.html`.
  RocketFire upper-body and HeadOpen/HeadClose helmet layers run after locomotion;
  the actor owns cue/recovery, helmet reversal, recent input and lava tick clocks.
  Use the cassette metadata on `CTRL_RocketSlide_R` (legacy left-named forearm),
  and keep rendered-camera release acquisition separate from goggles presentation.
  Mounted eye/HUD themes are yellow/orange; open/folding disables lock acquisition.
  Head presentation uses chest-owned eye-center/interior anchors and actor-owned
  `mechaHeadView.ts` clocks. Mount frame 27 starts orange loading; clip completion
  starts a 0.4-second black goggles boot and 0.3-second video reveal before control.
  `mechaHeadEffects.ts` holds rendered pictures, never simulation; keep its target
  prewarming/disposal and temporary interior material-side restoration in sync.
  The actor also owns laser/shield state in `mechaCombat.ts` and fixed GPU effects
  in `mechaCombatEffects.ts`. Shield contacts remain outside obstacle hashes so
  they do not affect movement/grappling. Weapon damage carries original muzzle
  and impact positions; preserve nearest-contact ordering and inside-origin
  bypass. Active simulation clocks freeze on offline pause/death and survive
  player respawn. Death and wall-punch commitment permanently stop combat.
  A completed defeated cockpit now admits an exact grapple to mount. Actor-owned
  pilot/rocket modules replace enemy AI while mounted, with a separate head view,
  and manual Shift shield. Mounted zero HP releases the living bean at the cockpit
  and starts FinalDeath at its 1.25 s breakup cue. Destruction then updates without
  pilot ownership; preserve HP/life/fuel and third person, including its 0.3 s boom
  handoff. Enemy defeat instead aligns its torso at 90 degrees/s before the full
  normal Death. Stomp impact also kills leg-supported beans. Piloting uses fitted
  sweeps in `mechaMovement.ts`, rather than enemy navigation clearance. Avoid routing the
  seated bean through ordinary gravity, regen, weapon or conversation updates.
  Targeting must remain active when the third-person HUD is hidden. Look intent
  is separate from capped actual yaw and shared across pointer lock and touch.

- The 2 October Mecha follow-up uses LOS scans plus corners-only covered hints,
  a shared ground-relative region classifier: a 0–28 m high, 130 m radius cylinder
  selects stomp/rockets/laser at 25/60/130 m; above it, the ground-centered 130 m
  sphere selects rockets. Actual shoulder/muzzle geometry aims into the dome.
  The shared four-release shield cycle has five seconds down. A committed ranged attack finishes before stomp.
  Main flushes render-acknowledged laser/stomp hits before advancing simulation;
  never replace that boundary with a timeout. Enemy rocket profiles are launch-owned
  and player-life-bound, using the pilot's existing pool without NPC collateral.
  Visible pilots have their own fitted chest anchor. Grapple/Touch Exit closes the
  helmet and reverses Mount under Shutting down... presentation, then releases once
  outside solid geometry and leaves a mountable wreck. Keep pending-hit cleanup,
  reverse-playback clocks, release ownership and first-person bean hiding in sync.
  Shutdown reverses the video reveal and HUD fade before reverse Mount; covered
  rockets use the authored launcher pose, and exit also searches beside the cabin.

- Procedural world placement uses a private seeded generator. UI or particle randomness must not consume that sequence. Visual chunk culling is separate from collision and target queries.
- `src/dayNightCycle.ts` installs a process-wide Three.js shader-chunk patch for sun-shadow edge fading; changes there need shader compilation and visual checks at noon, low sun, and night. `src/lavaGlow.ts` bakes one texture for pool spill, while `src/world.ts` assigns one movable point light to nearby visible lava.
- Projectile and sniper range share `BULLET_TRAVEL_DISTANCE`. Smart-goggle lock, shot creation/network packets, and in-flight homing all enforce reachability. See `src/projectileHoming.ts`, `src/weapons.ts`, and `src/projectiles.ts` before changing targeting.
- The host validates and relays packets, but movement and some hit detection still run in clients. New packet types belong in `src/networkTypes.ts` and `src/multiplayer.ts`; room capabilities and TURN admission belong in `src/worker.ts` and `src/turnRoom.ts`.
- The goth character uses a GLB from `blender_assets/goth_girlfriend/` plus editable character files in `public/npc/goth/`. Its model load is independent of procedural world staging, so a render-preparation pass does not guarantee the model has finished downloading.

## Verification snapshot

`npm run check` passed here on 25 September 2026: both TypeScript projects and 237 Node tests. `npm run build` also passed; Vite reported a non-blocking large-chunk warning for the existing bundles, and no generated `dist/` file changed in this pass. This is a baseline for future changes, not evidence of a browser or deployed-network test. The latest rendering/loading commit added `tests/worldLoading.test.ts`, `tests/renderPreparation.test.ts`, `tests/lavaGlow.test.ts`, and `tests/lighting-preview.html`. Run `npm run build` after source changes because CI compares the tracked `dist/` bundle. Use `/tests/lighting-preview.html` in Vite for shadow/lava inspection and the other fixtures listed in [Development](development.md) for town, goggles, and chat changes.

Real TURN-dependent networking, physical mobile controls, and the remaining deployed flows are tracked in [Multiplayer live test](multiplayer-live-test.md) and [Mobile controls](mobile-controls.md). Record new verification with its date and environment rather than silently upgrading a local test to a deployment claim.

2 October 2026 follow-up: both TypeScript projects and 341 tests passed via
`npm run check`; production assets were regenerated with `npm run build`.
This is automated verification only; the current Mecha interactive checklist
remains for the user in `forgotten-mecha.md`; `to_be_changed.md` preserves their original wording.

The subsequent 2 October repair/balance pass passed both TypeScript projects and
345 tests, regenerated `dist/`, and passed whitespace validation. It adds actual
beam-draw acknowledgment/inside faces, covered authored launch, side exits and
reversed goggles shutdown. Current difficulty is four ranged releases and five
seconds down before the unchanged 0.5-second rebuild. Interactive checks remain
with the user; the earlier 341-test record predates these repairs.

The 2 October cylinder/dome pass passed both TypeScript projects and all 349
tests, regenerated `dist/`, and passed whitespace validation. Detection and
acquisition use one ground-relative classifier; actual-GLB regressions verify
upward launcher aim and airborne hits. Interactive acceptance remains with the
user; the requirements file was unchanged.
