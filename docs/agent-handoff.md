# Agent handoff

Snapshot: 25 September 2026, starting from commit `5c51b29` on `main`. The working tree was clean before this documentation pass. Recheck `git status` and the current commit before relying on this snapshot.

## First steps

1. Read [Architecture](architecture.md) for ownership and data flow, then [Development](development.md) for commands and browser fixtures.
2. Inspect the code around the requested change. `src/main.ts` composes the client, `src/state.ts` holds match state, `src/config.ts` holds shared values, and `src/worker.ts` handles the Cloudflare API. The architecture guide maps the remaining systems.
3. Use [Follow-up validation](to_be_changed.md) for open deployment and device checks. [Code audit](code-audit.md) and [Audit resolution](audit-resolution.md) explain older findings and repairs; do not treat the original audit list as current bugs.

## Current lifecycle to preserve

- `init()` creates the menu and installs the multiplayer world loader. The gameplay renderer is created only when a match begins.
- Offline start creates the match runtime, starts staged world generation behind the loading overlay, then prepares WebGL textures, buffers, and lighting variants. The initial pointer-lock/fullscreen request stays in the original click gesture. The frame loop skips simulation during preparation and resets its clock before play.
- The host registers a secure room before loading its seeded world. A joining client receives the host's `world_snapshot`, prepares that seed, applies the snapshot, and replays packets queued during preparation. Session and scene checks prevent an old async load from mutating a replacement match.
- Leaving or failing startup cancels loading, disconnects multiplayer when applicable, disposes match-owned Three.js resources, and resets player and match state. Review both the success and failure/exit path whenever adding a resource, timer, or async task.
- The synchronous `createEnvironment()` path remains for deterministic tests and development fixtures. Keep its stage order aligned with `createEnvironmentAsync()`.

## Change-sensitive boundaries

- Procedural world placement uses a private seeded generator. UI or particle randomness must not consume that sequence. Visual chunk culling is separate from collision and target queries.
- `src/dayNightCycle.ts` installs a process-wide Three.js shader-chunk patch for sun-shadow edge fading; changes there need shader compilation and visual checks at noon, low sun, and night. `src/lavaGlow.ts` bakes one texture for pool spill, while `src/world.ts` assigns one movable point light to nearby visible lava.
- Projectile and sniper range share `BULLET_TRAVEL_DISTANCE`. Smart-goggle lock, shot creation/network packets, and in-flight homing all enforce reachability. See `src/projectileHoming.ts`, `src/weapons.ts`, and `src/projectiles.ts` before changing targeting.
- The host validates and relays packets, but movement and some hit detection still run in clients. New packet types belong in `src/networkTypes.ts` and `src/multiplayer.ts`; room capabilities and TURN admission belong in `src/worker.ts` and `src/turnRoom.ts`.
- The goth character uses a GLB from `blender_assets/` plus editable character files in `public/npc/goth/`. Its model load is independent of procedural world staging, so a render-preparation pass does not guarantee the model has finished downloading.

## Verification snapshot

`npm run check` passed here on 25 September 2026: both TypeScript projects and 237 Node tests. `npm run build` also passed; Vite reported a non-blocking large-chunk warning for the existing bundles, and no generated `dist/` file changed in this pass. This is a baseline for future changes, not evidence of a browser or deployed-network test. The latest rendering/loading commit added `tests/worldLoading.test.ts`, `tests/renderPreparation.test.ts`, `tests/lavaGlow.test.ts`, and `tests/lighting-preview.html`. Run `npm run build` after source changes because CI compares the tracked `dist/` bundle. Use `/tests/lighting-preview.html` in Vite for shadow/lava inspection and the other fixtures listed in [Development](development.md) for town, goggles, and chat changes.

Real TURN-dependent networking, physical mobile controls, and the remaining deployed flows are tracked in [Follow-up validation](to_be_changed.md). Record new verification with its date and environment rather than silently upgrading a local test to a deployment claim.
