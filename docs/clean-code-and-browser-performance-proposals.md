# Clean Code And Browser Performance Proposals

This document is a roadmap for improving the game codebase and reducing the amount of work each browser has to do while playing. It is based on the current TypeScript/Three.js implementation in `src/`.

## Implementation Status

The first implementation pass completed most of the practical cleanup and browser-workload items:

- Added a home-screen settings menu for sensitivity, FOV, scoped FOV, render scale, particle amount, shadows, and FPS visibility.
- Added spatial hashes for obstacles, lava, and targets, then routed physics, projectile, grappling, and sniper candidate checks through them.
- Moved projectile simulation into `src/projectiles.ts`.
- Moved common HUD writes into `src/hud.ts`.
- Reworked spark/flame/maneuver particles to use a shared `InstancedMesh` instead of one mesh per particle.
- Added remote-player interpolation and reduced repeated peer-list allocation.
- Quantized frequent multiplayer update packets and skipped unchanged packets between heartbeat sends.
- Shared several repeated weapon/avatar geometries.
- Added world and particle cleanup helpers.
- Split the Three.js dependency into its own production bundle chunk.

Deferred by request:

- The profiling/debug mode.
- Adaptive graphics settings. Manual player-controlled settings were added instead.

The project already has several good performance instincts:

- Shared scratch vectors in hot systems like `physics.ts`, `grapple.ts`, `weapons.ts`, and `multiplayer.ts`.
- Projectile pooling in `main.ts`.
- Material pooling for particles in `particles.ts`.
- Instanced visible pillars in `world.ts`.
- Dirty flags for some HUD writes in `main.ts`.

The biggest remaining wins are reducing per-frame search work, draw calls, scene graph churn, particle overhead, and the complexity of the central `main.ts` loop.

## Priority Summary

| Priority | Proposal | Main Benefit | Main Files |
| --- | --- | --- | --- |
| P0 | Add a profiling/debug mode | Makes optimization measurable | `main.ts`, new `debug/` module |
| P0 | Spatial partitioning for collisions and projectiles | Large CPU reduction | `physics.ts`, `main.ts`, `world.ts` |
| P0 | Replace mesh-per-particle effects with instancing or Points | Large draw-call and GC reduction | `particles.ts` |
| P1 | Split `main.ts` into focused systems | Easier maintenance and safer AI edits | `main.ts` |
| P1 | Add adaptive graphics settings | Lower GPU load on weaker devices | `main.ts`, `world.ts`, `particles.ts` |
| P1 | Reduce raycast and hitscan work | Lower CPU spikes while shooting/grappling | `weapons.ts`, `grapple.ts` |
| P1 | Improve multiplayer packet shape and interpolation | Lower bandwidth and smoother peers | `multiplayer.ts` |
| P2 | Share weapon/avatar geometries more aggressively | Lower memory and faster peer joins | `weapons.ts`, `multiplayer.ts` |
| P2 | Centralize HUD updates | Less layout/style work and cleaner code | `main.ts`, `multiplayer.ts` |
| P2 | Add lifecycle ownership rules | Fewer leaks and cleanup bugs | All scene modules |

## P0: Add A Profiling And Debug Mode

Before heavy rewrites, add a lightweight way to measure the game in-browser.

### Proposal

Create a small debug module that can be toggled with a query parameter, for example:

```text
http://localhost:5173/?debug=1
```

Track:

- FPS and frame time percentiles.
- Active particles.
- Active projectiles.
- Scene object count.
- Render calls, triangles, geometries, textures from `renderer.info`.
- Physics scan time.
- Projectile collision time.
- Network packets sent per second.

### Why

The game has several places that are probably expensive, but the browser will tell us what is actually expensive. This prevents spending days optimizing code that is not the bottleneck.

### Implementation Notes

- Add a `src/debug.ts` with a tiny `begin(label)`, `end(label)`, and `sampleCounter(name, value)` API.
- Render the overlay only when debug mode is enabled.
- Use `performance.now()` around known hot areas in `animate()`.
- Reset `state.renderer.info` each frame or sample it after rendering.

### Good First Metrics

- `physicsMs`
- `projectileMs`
- `targetsMs`
- `particlesMs`
- `renderMs`
- `networkPacketsOut`
- `renderer.info.render.calls`
- `renderer.info.memory.geometries`
- `renderer.info.memory.textures`

## P0: Spatial Partitioning For Collisions And Projectiles

Several hot paths currently scan whole arrays:

- `physics.ts` scans every obstacle when resolving movement.
- `main.ts` checks every projectile against every target and every peer.
- `grapple.ts` checks all targets for magnetic aim assist.
- `weapons.ts` checks all targets and peers for sniper hitscan.

These are fine at current scale, but they grow badly as the arena gets denser.

### Proposal

Create a simple 2D spatial hash for X/Z space.

Example API:

```ts
class SpatialHash<T> {
    constructor(cellSize: number) {}
    clear(): void {}
    insert(x: number, z: number, radius: number, value: T): void {}
    query(x: number, z: number, radius: number): T[] {}
}
```

Use it for:

- Pillar collision candidates near the player.
- Projectile candidates near the bullet.
- Target candidates near the grappling ray.
- Optional peer collision candidates in PvP.

### Expected Benefit

Instead of:

```text
every projectile * every target
every player frame * every obstacle
```

the game usually checks only nearby objects.

### Implementation Notes

- Static objects like pillars and lava can build their hash once after `createEnvironment()`.
- Dynamic objects like targets and peers can update every frame or every network tick.
- Use squared distances where possible to avoid `sqrt` from `distanceTo()`.
- Start with world X/Z only. Most gameplay objects are vertical columns or floating targets, so a 2D broad phase is enough.

### Candidate Files

- `src/world.ts`: build static obstacle/lava hashes.
- `src/physics.ts`: query nearby obstacles in `scanObstacles()`.
- `src/main.ts`: query nearby targets/peers when projectiles move.
- `src/grapple.ts`: query likely enemy targets before aim-assist math.
- `src/weapons.ts`: reduce sniper candidate loops.

## P0: Rework Particles Into Instanced Rendering

`particles.ts` currently creates a `THREE.Mesh` for each particle. Materials are pooled, which helps, but each particle is still a scene object. Scene add/remove and many draw calls are expensive in Three.js.

### Proposal

Replace most particle effects with one of these:

1. `THREE.InstancedMesh` per particle kind/material group.
2. `THREE.Points` with a custom material for sparks/flames.
3. A hybrid: instanced boxes for sparks, separate pooled meshes only for beams/shockwaves.

### Expected Benefit

- Far fewer draw calls.
- Less scene graph churn.
- Less garbage collection.
- Smoother explosions and hover effects on weaker machines.

### Implementation Steps

1. Keep the public functions:
   - `spawnParticles()`
   - `spawnRocketFlame()`
   - `spawnManeuveringBeam()`
   - `createShockwave()`
   - `createLaserBeam()`
2. Internally store particle data as plain objects or typed arrays.
3. Use a fixed capacity per effect type.
4. Update instance matrices/colors each frame.
5. Avoid `scene.add()` and `scene.remove()` for every individual particle.

### Extra Improvement

Add quality tiers:

```ts
LOW:    maxParticles = 150
MEDIUM: maxParticles = 350
HIGH:   maxParticles = 700
```

Use lower particle spawn counts when frame time rises.

## P1: Split `main.ts` Into Systems

`main.ts` currently owns setup, menus, input, render loop, health, lava, death, target damage, FOV, HUD, and a lot of multiplayer hooks. It works, but it is hard to reason about and easy for future edits to break.

### Proposal

Split by responsibility:

```text
src/app.ts              Boot/init only
src/input.ts            Keyboard/mouse state and pointer lock events
src/hud.ts              DOM cache and HUD updates
src/player.ts           health, death, respawn, regen
src/gameLoop.ts         animate() order and timing
src/projectiles.ts      projectile simulation and collisions
src/menu.ts             singleplayer/multiplayer/pause/death menus
```

### Expected Benefit

- Easier testing and reviewing.
- Smaller files for AI-assisted edits.
- Lower chance of accidental circular dependencies.
- Clearer ownership of DOM versus gameplay state.

### Suggested First Cut

Move only HUD code first:

- `updateHealthBar`
- `updateHoverBar`
- reload bar update
- FPS counter
- scoped HUD visibility
- world border overlay

This gives immediate cleanup without changing gameplay logic.

## P1: Adaptive Graphics Settings

The game currently uses:

- Antialiasing enabled.
- Pixel ratio capped at 2.
- Shadow maps enabled.
- A 1024 shadow map.
- Many visible props and particles.

That is fine on strong desktops but can hurt laptops and mobile GPUs.

### Proposal

Add a graphics profile system:

```ts
type GraphicsProfile = 'low' | 'medium' | 'high' | 'auto';
```

Settings per profile:

| Setting | Low | Medium | High |
| --- | --- | --- | --- |
| Pixel ratio cap | 1.0 | 1.5 | 2.0 |
| Antialias | off | on | on |
| Shadows | off or low | 1024 | 2048 |
| Particle count | low | medium | high |
| Bush count | low | medium | current |
| Fake billboard count | low | medium | current |
| Target health bar update | every other frame | every frame | every frame |

### Auto Mode

Auto mode can start medium, then adjust after 5 seconds:

- If average frame time is above 20 ms, lower particle counts and pixel ratio.
- If average frame time is above 28 ms, disable shadows.
- If average frame time is below 12 ms for a while, allow higher quality.

### Candidate Files

- `src/config.ts`: profile values.
- `src/main.ts`: renderer setup and dynamic adjustment.
- `src/world.ts`: world density.
- `src/particles.ts`: particle caps.

## P1: Optimize Raycasting And Hitscan

Sniper and grappling both use raycasting. Current logic is clear, but as objects grow it can spike.

### Proposal

Use a two-stage hit system:

1. Broad phase: query nearby objects along the ray using spatial hash or bounding spheres.
2. Narrow phase: raycast only likely candidates.

### Specific Ideas

- Put collision-only meshes on a Three.js layer.
- Use simpler invisible hitboxes for peer models instead of raycasting the full bean model.
- For targets, raycast against one body mesh or a sphere/cube collider, not the whole group.
- Cache `Object.keys(state.peers)` instead of creating arrays inside hot firing paths.
- Use squared distance for projectile proximity checks.

### Candidate Files

- `src/weapons.ts`
- `src/grapple.ts`
- `src/multiplayer.ts`

## P1: Improve Multiplayer Packets And Remote Smoothing

The current network packets are JSON objects with full numeric precision. That is convenient, but not bandwidth efficient.

### Proposal

Phase 1, still JSON:

- Send updates only if position/rotation/weapon/hover changed enough.
- Quantize numbers:
  - position to 2 decimals
  - yaw/pitch to 3 decimals
  - booleans as small flags
- Avoid sending `hoverKeys` unless hovering.
- Keep `state.peerIds` updated, but avoid repeated `Object.keys()` in hot paths.

Phase 2, optional:

- Encode frequent update packets as compact arrays:

```ts
['u', x, y, z, yaw, pitch, weaponId, flags]
```

or use `ArrayBuffer` for frequent state packets.

### Remote Interpolation

Remote player positions are applied directly in `handlePeerMessage()`. Add interpolation:

- Store `previousPosition`, `targetPosition`, and `lastUpdateTime`.
- In the render loop, lerp/slerp remote peer transforms.
- This allows lower network tick rates with smoother visuals.

### Expected Benefit

- Less bandwidth.
- Lower JS allocation per network message.
- Smoother remote movement.
- Better multiplayer performance on weaker connections.

## P2: Share Weapon And Avatar Resources More Aggressively

Weapon builders create many geometries/materials. For local-only use this is fine, but every remote peer creates a full set of weapon meshes.

### Proposal

Create shared geometry/material registries:

```text
src/assets/geometries.ts
src/assets/materials.ts
```

Share:

- Gun body geometries.
- Grip geometries.
- Barrels.
- Bean body geometries.
- Visor geometries.
- Common materials.

### Important Rule

Only share materials when color and opacity are not mutated per instance. For hit flashes, either:

- Use per-avatar flash overlay material.
- Store a color uniform per instance.
- Clone only the material that actually needs mutation.

### Expected Benefit

- Faster peer creation.
- Lower memory usage.
- Less GPU resource churn when players join/leave.

## P2: Centralize HUD And DOM Updates

The code already avoids some repeated DOM writes. The next step is to centralize all UI changes so gameplay modules do not directly manipulate many elements.

### Proposal

Create `src/hud.ts`:

```ts
export function setHudPlaying(isPlaying: boolean): void {}
export function setHealth(current: number, max: number, flash?: string): void {}
export function setCooldown(progress: number): void {}
export function setHoverFuel(value: number): void {}
export function setScoped(scoped: boolean): void {}
export function setScore(score: number): void {}
export function setPvpStats(kills: number, deaths: number): void {}
```

### Expected Benefit

- Fewer scattered `style.display` writes.
- Easier to add CSS classes and transitions.
- Better separation between gameplay state and the page.
- Lower chance of menu state bugs.

### Extra Browser Workload Improvement

Prefer class toggles:

```ts
element.classList.toggle('is-hidden', hidden);
```

over many direct `style` writes. It is easier to batch and debug.

## P2: Reduce Work In `updateTargets()`

`updateTargets()` rotates every target and makes every health bar face the camera every frame.

### Proposal

- Update health bar billboarding every other frame or only when camera rotation changes enough.
- Hide or reduce target animation for distant targets.
- Use a shared quaternion for health bars.
- Consider `Sprite` health bars instead of plane meshes.

### Expected Benefit

Small to medium CPU savings, depending on target count.

## P2: Improve Projectile Simulation

Current projectile simulation is readable and uses pooling, but collision work can still grow quickly.

### Proposal

- Use squared distance checks:

```ts
if (proj.position.distanceToSquared(target.position) < hitRange * hitRange) {}
```

- Add spatial hash query for nearby targets.
- Treat remote visual bullets separately from local damage bullets:
  - Local bullets check damage.
  - Remote visual bullets only render/travel, unless needed for hit effects.
- Add max active projectile budget per weapon/profile.

### Expected Benefit

Lower CPU cost in heavy firefights.

## P2: Scene Lifecycle Ownership

Right now scene objects are added from many modules, and cleanup is partly manual. That is normal for prototypes, but it gets harder as features grow.

### Proposal

Define ownership:

| Object | Owner | Cleanup |
| --- | --- | --- |
| World floor/pillars/lava/bushes | `world.ts` | `disposeWorld()` |
| Player local mesh/weapons | `weapons.ts` | `disposePlayerVisuals()` |
| Remote peers | `multiplayer.ts` | `removePeer()` |
| Projectiles | `projectiles.ts` | pool return |
| Particles | `particles.ts` | pool/instance reset |
| HUD elements | `hud.ts` | no scene cleanup |

### Expected Benefit

- Better memory behavior when returning to menu or switching rooms.
- Easier future map reloads.
- Less risk of leaked geometries/materials/textures.

## P3: Build And Bundle Improvements

The current production build warns that the main bundle is over 500 kB. Three.js games often do that, but there are still easy improvements.

### Proposal

- Split PeerJS into the multiplayer path only. It is already dynamically imported, which is good.
- Consider manual chunks for Three.js:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        three: ['three']
      }
    }
  }
}
```

- Add `build.chunkSizeWarningLimit` only after confirming the size is acceptable.
- Avoid shipping debug code unless `debug=1` or development mode is active.

### Expected Benefit

- Better cache behavior.
- Smaller first-load app chunk.
- Easier interpretation of bundle size warnings.

## P3: Type Safety And Code Quality

Some APIs use `any` for network messages, PeerJS connections, and `userData`.

### Proposal

Add typed packet unions:

```ts
type NetworkPacket =
  | UpdatePacket
  | FirePacket
  | HitTargetPacket
  | KillTargetPacket
  | PlayerHitPacket
  | PlayerDiedPacket
  | JumpPacket;
```

Add typed `userData` wrappers for:

- targets
- obstacles
- peer meshes
- projectiles

### Expected Benefit

- Fewer runtime mistakes.
- Easier AI modifications.
- Better autocomplete and refactoring safety.

## P3: Testing And Safety Nets

Browser games are hard to unit test fully, but several pieces can be tested.

### Proposal

Add lightweight tests for:

- room code generation
- username validation
- spatial hash queries
- weapon stat lookup
- target damage and respawn rules
- packet encode/decode if compact networking is added

### Suggested Setup

- Use `vitest`.
- Keep rendering-heavy code out of unit tests.
- Test pure helpers first.

## Suggested Implementation Order

1. Add debug/profiling overlay.
2. Introduce `hud.ts` and move DOM updates out of `main.ts`.
3. Move projectile logic into `projectiles.ts`.
4. Add spatial hash for static obstacles and use it in `physics.ts`.
5. Add spatial hash/projectile candidate filtering.
6. Rework particles into instanced or Points-based rendering.
7. Add graphics quality profiles.
8. Add remote interpolation and packet quantization.
9. Share weapon/avatar resources more aggressively.
10. Add lifecycle cleanup APIs and tests.

## Concrete Low-Risk Quick Wins

These can be done without changing game design:

- Replace projectile `distanceTo()` with `distanceToSquared()`.
- Cache `score`, `kills`, `deaths`, and menu elements consistently through one HUD module.
- Avoid `Object.keys(state.peers)` inside firing paths by relying on `state.peerIds`.
- Pre-pool remote visual bullets the same way local bullets are pooled.
- Add a hard cap for `spawnLightBeam()` and shockwaves so spawn/death events cannot crowd out gameplay particles.
- Add low/medium/high constants for bush counts and particle limits.
- Convert repeated menu `style.display` changes into CSS class toggles.
- Add `disposeWorld()` even if it is not called yet, so ownership is clear.
- Add a `NetworkPacket` type union.
- Add a `TargetUserData` interface instead of relying on anonymous `userData` fields.

## Design Principle For Future Work

Prefer this pattern:

```text
Input -> State -> Systems -> Render/HUD
```

Avoid this pattern:

```text
Any module directly changes anything anywhere
```

The game is already fun and surprisingly complete for a prototype. The next phase should make it easier to scale: fewer global side effects, fewer per-frame full-array scans, fewer scene graph objects, and clearer ownership of every object that enters the world.
