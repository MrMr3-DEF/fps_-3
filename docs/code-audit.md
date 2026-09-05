# Codebase audit — 5 September 2026

This is the historical, pre-fix audit. See [audit resolution](audit-resolution.md) for implemented corrections and validation. Source line numbers below refer to that earlier revision.

Sorted by severity, then practical impact. P1 = high-priority security/correctness issue; P2 = normal-priority bug or hardening issue; P3 = lower-impact improvement. No P0 issue was established.

## Scope and verification

Reviewed the current working-tree documentation, client gameplay and lifecycle, multiplayer transport and authorization, Worker/room state, settings, build configuration, and tests. Existing documentation changes were preserved. No application source or generated assets were changed.

- `npm run check`: both TypeScript projects and all 21 tests passed.
- `npx vite build --outDir /tmp/testfps-audit-build`: passed.
- `diff -rq dist /tmp/testfps-audit-build`: no differences.
- Isolated Node reproductions used temporary transpiled copies of source, exposing private functions only in those copies. They confirmed the cadence, wall-hit, host-death, collision, visibility, and departure-notification results below.
- This was a source audit with isolated runtime checks, not a two-browser/WebGL or deployed Cloudflare penetration test. Findings marked “source trace” follow the actual code paths but were not exercised end to end.

## Bugs and errors

### 1. P1 — Worker room authorization is never verified at peer admission

**Evidence:** `src/multiplayer.ts:483`, `src/multiplayer.ts:704`, `src/multiplayer.ts:559` — source trace.

The host accepts any incoming PeerJS connection that fits its duplicate/capacity checks, then immediately sends the world snapshot. The client sends no room-session proof in its connection or an authentication handshake. Worker verification gates issuance of ICE credentials, but it does not gate the gameplay channel. A custom peer that knows the room code and can establish WebRTC connectivity can bypass Turnstile and the join API, including its rate limit.

**Fix:** Issue a short-lived, room- and peer-bound admission ticket and validate it before counting a connection as admitted, sending the world, or processing gameplay. Authenticate the host identity as well if the room-code-derived signalling identity is intended to establish trust. Do not send the host's close capability as a handshake credential.

### 2. P1 — Host fire-rate validation mixes seconds and milliseconds

**Evidence:** `src/multiplayer.ts:944`; `src/config.ts:57` — reproduced.

`performance.now()` differences are milliseconds, while `stats.fireRate` is seconds. The sniper threshold evaluates to **0.9 ms**, instead of 900 ms even with the existing 45% tolerance; its normal local cooldown is two seconds. A fire packet 10 ms after the previous sniper shot was accepted. The separate eight-hit burst cap does not enforce individual weapon cooldowns.

**Fix:** Use explicit common units, then define a bounded latency tolerance and account for minigun ramping. Test each weapon immediately before and after its permitted interval.

### 3. P1 — Spread allowance permits hits through walls

**Evidence:** `src/multiplayer.ts:851` — reproduced.

The host adds `stats.spread * maximumRange` to the target radius, independent of actual target distance. A shotgun gets a **56-unit** allowance. For nearby targets this inflated sphere can contain the shooter, so intersection occurs at the shot origin and the wall check examines a zero-length path. An isolated shot from `(0,2,0)` to a target at `(0,2,-20)` was accepted with a pillar centered at `(0,5,-5)` between them.

**Fix:** Validate the actual pellet rays, with spread derived from a shared shot seed. Check occlusion up to the real target intersection and bound distance by projectile travel time. Avoid using a maximum-range-inflated sphere as the occlusion endpoint.

### 4. P2 — Host kills do not produce valid client death attribution

**Evidence:** `src/projectiles.ts:49`, `src/weapons.ts:580`, `src/multiplayer.ts:966`, `src/multiplayer.ts:970` — reproduced authorization rejection; source-traced sender paths.

Only authorized **client-originated** hits populate `lastDamageByVictim`. Host shots broadcast damage directly. When the victim reports death caused by the host, authorization finds no matching damage record; additionally, the host is absent from `peerRuntime`. The death packet is rejected, so the host does not receive kill credit through the normal death handler. A victim with no prior client damage produced exactly this rejection in the isolated check.

**Fix:** Route local host hits through the same attribution bookkeeping and resolve the host's identity explicitly. Test host→client, client→host, and client→client kills.

### 5. P2 — Departed clients remain as ghost avatars on other clients

**Evidence:** `src/multiplayer.ts:738`, `src/multiplayer.ts:1279`; packet union in `src/networkTypes.ts:113` — reproduced missing notification.

The topology is a star: each client connects only to the host. When client A leaves, the host removes A locally but sends no departure event to client B. B cannot observe A's closed channel, and there is no avatar timeout. The stale avatar and potentially its hook remain indefinitely. The isolated close-handler check sent zero notifications to the remaining connection.

**Fix:** Add an authenticated host-originated departure packet or versioned roster update and dispose departed peers on every client. Cover a host plus two clients in a regression test.

### 6. P2 — Waiting clients can permanently miss target respawns and score changes

**Evidence:** `src/multiplayer.ts:1054`, `src/multiplayer.ts:1202`, `src/multiplayer.ts:1432` — source trace.

After receiving a snapshot, a joining client may remain at “Ready to join” while the host continues playing. `target_state` packets are accepted there, but `kill_target` is discarded by the `!state.isPlaying` guard. The host marks that respawn fingerprint as already synchronized, so no later incremental packet repairs it unless the target changes again. The client can enter with stale target positions/health and score.

**Fix:** Apply authoritative world mutations while connected and synchronized, independently of pointer lock or play UI; alternatively send a fresh snapshot on actual entry. Keep cosmetic events separately gated.

### 7. P2 — Grapple movement can tunnel through pillars

**Evidence:** `src/physics.ts:76`, `src/physics.ts:242`; `src/grapple.ts:175` — reproduced.

Player collision checks only the proposed endpoints. Enemy grappling sets speed to 225 units/s, producing 11.25 units of travel in an allowed 50 ms frame. This exceeds a six-unit pillar plus the player's collision margins. In the isolated physics check, the player moved from x = -5 to x = 6.25 straight through a pillar centered at x = 0.

**Fix:** Sweep the player's collision volume through the movement segment, or use bounded physics substeps based on maximum travel. The frame-delta cap alone is insufficient.

### 8. P2 — Render distance changes target hit detection and grappling

**Evidence:** `src/projectiles.ts:146`, `src/weapons.ts:497`, `src/grapple.ts:77`, `src/world.ts:199` — projectile behavior reproduced; other consumers source-traced.

Chunk culling sets target `visible` to false, and the projectile, sniper, and grapple paths skip invisible targets. Lowering render distance therefore changes gameplay collision, contradicting the documented visibility-only setting. A swept projectile produced zero hits against an invisible target and one hit against the same visible target.

**Fix:** Separate render visibility from gameplay eligibility. Keep all live targets in hit/grapple checks even when their visual chunk is culled.

### 9. P2 — Kill credit uses non-unique display names

**Evidence:** `src/multiplayer.ts:1250`, `src/networkTypes.ts:84` — source trace.

The receiver awards a kill when `killerName === myName`. Names need not be unique, so multiple players with the same name receive credit for one kill. `Lava` is also a valid player name and collides with the environmental-death sentinel.

**Fix:** Include a validated `killerPeerId` and a separate environmental cause. Award credit using peer identity; reserve display names for UI.

### 10. P2 — Death reports can be replayed, and dead peers can fire

**Evidence:** `src/multiplayer.ts:942`, `src/multiplayer.ts:970` — source trace.

A death report does not consume the latest damage record or mark a unique death transition. During the ten-second attribution window, the same valid report can repeatedly trigger kill credit. Fire authorization also does not reject `runtime.wasDead`, so a peer advertising itself as dead can continue submitting fire/hit packets.

**Fix:** Track an authoritative life/death generation, consume death transitions once, and reject new shots from dead peers. Define explicitly whether already-fired projectiles survive death.

### 11. P2 — The 4 KiB JSON limit is checked after buffering the whole body

**Evidence:** `src/worker.ts:110`, `src/turnRoom.ts:49` — source trace.

Without a trustworthy `Content-Length`, `request.text()` reads the entire body before the byte-length check. Oversized requests are eventually rejected, but memory and decoding work are not bounded by the advertised 4 KiB limit. Capability routes such as close/heartbeat also reach this parser, so per-IP creation limits are not a complete mitigation.

**Fix:** Read the stream with a running byte count and cancel once it exceeds the limit. Reuse one bounded parser for the Worker and room state machine. Test a streamed oversized body without `Content-Length`.

### 12. P3 — Remote shotgun pellets do not reproduce the shooter's actual spread

**Evidence:** `src/weapons.ts:429`, `src/weapons.ts:596`, `src/multiplayer.ts:996`, `src/multiplayer.ts:1420` — source trace.

Local pellets use `Math.random()`, while remote pellets use a separate counter-based seed added only during broadcast. Remote viewers may agree with each other, but their trajectories differ from the projectiles that actually resolve damage. Single-projectile weapons also broadcast the unspread camera direction rather than their sampled direction.

**Fix:** Generate the shot seed before local simulation and use the same deterministic spread function locally, remotely, and in host validation.

## Potential issues needing focused validation

### 13. P2 — Old connection callbacks can affect a replacement session

**Evidence:** `src/multiplayer.ts:690`, `src/multiplayer.ts:734`, `src/multiplayer.ts:738`, `src/multiplayer.ts:769`.

The pending-open timeout, data callback, and error callback do not check their captured session generation. The close callback removes runtime/avatar state before checking generation. A delayed event from an old connection can therefore interfere with a replacement connection, particularly when reconnecting to the same host ID. Whether each sequence occurs depends on PeerJS event timing; it was not reproduced against a real browser.

**Next step:** Exercise cancel→join and disconnect→rejoin with delayed events. Check generation at the beginning of every callback and centrally cancel pending connection timers.

### 14. P2 — Long-lived hosts reuse expiring ICE configuration for new joins

**Evidence:** `src/multiplayer.ts:140`, `src/multiplayer.ts:464`, `src/worker.ts:59`.

The host fetches ICE credentials once, with a five-minute TTL. Room heartbeats can keep hosting alive much longer, but there is no credential/configuration refresh path for subsequently accepted connections. Existing direct connections are not a sufficient test of whether a later, relay-dependent join will succeed.

**Next step:** Test a new relay-dependent participant after the host has waited beyond five minutes, plus ICE recovery after a network change. If it fails, design a bounded reauthorization/refresh flow. This audit does not claim a reproduced TURN outage.

### 15. P2 — Room mutation concurrency is not covered

**Evidence:** `src/turnRoom.ts:82`, `src/turnRoom.ts:128`; `tests/turnRoom.test.ts:6`.

The room record is read before awaiting request-body parsing and then written back. Tests are sequential and the storage fake returns object references rather than isolated stored values. They do not establish correctness for overlapping registrations, joins, claims, or heartbeat/close operations in the actual Durable Object runtime.

**Next step:** Add concurrent requests with storage isolation and controllably delayed bodies, then exercise them in the Cloudflare runtime. Verify the complete read/check/write sequence is serialized; do not infer atomicity merely from the class being a Durable Object.

## Room for improvement

16. **P2 — Test gameplay authority and lifecycle, not just packet shape.** Extract authorization into a DOM-free unit. Add cases for findings 1–10 and a small multi-client integration suite covering lobby waiting, departure, host kills, death replay, and rejoin. Passing parser tests currently gives little protection against these failures.

17. **P3 — Bound setup network waits.** Turnstile verification in the Worker has a timeout, but the TURN credential upstream call and browser setup requests do not have application deadlines. Add cancellation/deadlines and actionable retry behavior so a stalled request cannot leave setup indefinitely pending (`src/worker.ts:410`, `src/turnSecurity.ts:178`).

18. **P3 — Reduce lifecycle duplication and unsafe connection typing.** Host/projectile/weapon/death senders bypass different pieces of bookkeeping; consolidate them behind the existing network port. Replace `conn: any` with a typed connection adapter and explicitly own timers, connection generations, and cleanup. These changes directly support fixes 4, 5, 10, and 13.

19. **P3 — Reconcile documentation with actual behavior and ignore rules.** `docs/to_be_changed.md` says there are no bugs. Architecture promises visibility-independent collision and deterministic shot replication that the code does not provide. Development documentation says coverage, screenshots, and analysis artifacts are ignored, but `.gitignore` does not contain those rules. Update the backlog as fixes are accepted and keep claims tied to tested behavior.

## Suggested repair order

Fix peer admission, fire-rate units, and pellet/path validation first. Then address death identity/state and disconnect/world synchronization together, followed by swept player collision and visibility-independent hit detection. Use the regression cases above to protect each fix before broad structural refactoring.
