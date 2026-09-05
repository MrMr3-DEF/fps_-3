# September audit resolution

Implemented on 5 September 2026. The [original audit](code-audit.md) remains a historical record; its line numbers refer to the pre-fix code.

## Username behavior

Usernames are reserved atomically by the room backend, with case-insensitive comparison. `Pilot`, `PILOT`, and `pilot` occupy the same name in one lobby. The host's name is reserved too. Other lobbies can use that name independently.

A duplicate is rejected with “That username is already in this lobby. Choose another name.” The reservation fixes the player's identity for the session; gameplay packets cannot rename a player. Departure releases the reservation, and unused pending reservations expire after five minutes. Admitted names remain reserved through temporary relay-lease expiry until departure or room expiry. Kill attribution uses peer IDs and a separate environmental cause, so the allowed name `Lava` cannot receive environmental kill credit.

## Resolution by audit item

| Item | Implemented correction |
| --- | --- |
| 1 — Admission bypass | Single-use tickets bound to room session and peer ID; host verifies through a capability-protected Worker route before sending the world. Client requires the independently issued host proof. |
| 2 — Fire cadence | Cooldowns use milliseconds, bounded jitter tolerance, monotonic shot IDs, and minigun spinup/ramp checks. |
| 3 — Wall hits | Exact shared pellet rays, one accepted hit per pellet, projectile travel bounds, muzzle-to-player and shot-to-impact obstruction checks. |
| 4 — Host kill attribution | Host-originated hit broadcasts now record the same damage attribution as client hits; host identity resolves explicitly. |
| 5 — Ghost peers | Host broadcasts a departure packet; every client disposes the avatar and hook. |
| 6 — Waiting-client desynchronization | Synchronized clients apply authoritative target respawns and score changes before entering play. |
| 7 — Movement tunnelling | Physics substeps bound travel to half a unit and recompute collisions each step. |
| 8 — Visibility affecting gameplay | Projectile, sniper and grapple checks no longer skip targets because their render chunk is hidden. |
| 9 — Duplicate identity | Atomic, case-insensitive per-lobby username reservations, immutable session names, peer-ID kill attribution. |
| 10 — Death replay/dead firing | Life IDs require one accepted death before the next life; replayed deaths and new shots from dead peers are rejected. Death acceptance retires outstanding hit claims. |
| 11 — JSON buffering | Shared streaming parser enforces 4 KiB while reading, cancels oversized bodies, and bounds read time. |
| 12 — Spread mismatch | Shooter, host and viewers use the same seed, pellet index and spread function. |
| 13 — Stale callbacks | Generation checks precede callback mutations; pending connection timers have central ownership and are cancelled on disconnect. Unopened PeerJS channels are cleaned up explicitly because they do not emit `close`. |
| 14 — Expiring ICE configuration | Host roster heartbeats renew admitted sessions every two minutes. Peers refresh ICE configuration every four minutes under session and IP quotas, updating future and existing peer connections. |
| 15 — Room concurrency | Body parsing occurs before a serialized storage read/check/write queue; alarms use the same queue and recheck expiry. Storage-isolated parallel tests cover admission, names, capacity, credentials and room ownership. |
| 16 — Coverage | Added authority, room concurrency, streaming, gameplay and Worker-backed simulated-peer integration tests. |
| 17 — Setup waits | Browser requests, script loading, signalling startup, channel admission, world sync, request-body reads and TURN upstream calls have deadlines. |
| 18 — Lifecycle/send duplication | Typed connection handles replace untyped connection parameters; weapon/projectile/death send paths share attribution-aware broadcasting through the network port. New matches clear player, projectile and particle state. |
| 19 — Documentation | Architecture, operations, development workflow, backlog and ignore rules now describe the implemented behavior and validation limits. |

## Validation

- `npm run check`: both client and Worker TypeScript checks pass; **42 tests pass**.
- `npm run build`: passes and regenerates the tracked deployment output.
- `wrangler deploy --dry-run`: Worker bundles successfully with its existing Durable Object bindings. No deployment was performed.
- `git diff --check`: passes.
- Browser smoke check: the arena renders, menu interaction works, and the unique-name guidance is visible. The embedded Chromium browser rejected pointer lock, so a complete manual play session was not performed.

Integration tests execute real Worker routes and the room state machine with isolated in-memory storage, simulated PeerJS connections, and simulated Cloudflare upstream responses. The gameplay collision regression uses a broad-phase fixture query. A simulated clock verifies session renewal, name retention and credential claims beyond the initial five-minute lease.

Real Turnstile, TURN-dependent networking, ICE recovery after a network change, and deployed Durable Object behavior still require a staging/production smoke test. Unit and simulated integration tests do not establish those external-service results.

## Rollout

Deploy the Worker and rebuilt client together. The wire protocol and room record format changed; older room records fail closed and existing players should create or join fresh lobbies after rollout. The existing Durable Object classes and migration remain unchanged. Local tests now require Node 22.15 or newer for the test-only module resolution hook.
