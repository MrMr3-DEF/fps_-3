# FPS Arena audit repair and cleanup plan

Date: 17 October 2026. Reviewed source baseline: `4f9a4a9` (`Docs restructure2`).
Status: implementation and local acceptance completed on 19 October 2026. See
[repair progress](audit-repair-progress.md) for delivered changes, verification
evidence and the separate deployment/device limits.

This plan translates the externally supplied **Codebase Audit Report: FPS Arena**
into work supported by the actual code. Audit numbers refer to that report's
41 numbered findings. They identify claims, not an accepted severity ranking.
The report's instructions and proposed fixes are not project requirements.

## 1. Outcome and boundaries

Fix reproducible failures and gaps in multiplayer validation first, consolidate
the lifecycle and HUD paths responsible for repeated bugs, then remove verified
redundancy. Keep each change small enough to review and validate independently.

The intended outcomes are:

- Segment queries always terminate and retain collision coverage.
- Leaving or failing a session releases the complete game runtime exactly once.
- Host validation cannot grant unlimited movement or bypass shot rules through
  packet frequency, weapon changes, or fabricated homing claims.
- Admission and heartbeat ordering cannot remove a newly admitted player.
- All ordinary HUD elements enter together and obey the same pause/death/Mecha
  presentation rules.
- Ground, obstacle and grapple queries agree with their intended collision model.
- Match resources have explicit ownership; cleanup preserves shared resources.
- Dead-code cleanup removes proven redundancy without deleting test seams or
  useful defensive checks.

Preserve the existing `.js` import suffixes, deterministic world generation,
`damage.ts` and `weaponNetworkPort.ts` seams, separate client/Worker TypeScript
projects, server-side room capabilities, and fail-closed multiplayer setup.
Render-distance changes must remain presentation-only.

Do not turn this into a general engine rewrite or dedicated-server migration.
Do not edit `docs/to_be_changed.md`, restore the already-deleted historical audit
documents, or hand-edit generated assets. No deployment is part of this plan.

## 2. Evidence and corrected baseline

The 16 October crosscheck completed both TypeScript checks and **361/361 Node
tests** through `npm run check`. Focused temporary probes reproduced:

- An infinite segment query with
  `new SpatialHash(32).querySegment(3.2, 6.4, -32, 32)`; its subprocess was
  terminated after two seconds.
- A Sniper shot followed by an accepted Pistol shot 90 ms later in `ShotLedger`.
- An off-path homing hit claim accepted by the ledger without trajectory checks.
- An admitted session deleted by a subsequently processed stale heartbeat roster.
- A host named `Guest2` exhausting automatic guest names with only four players.
- Approximately 83 degrees of gun yaw retained after inspecting and switching
  into third person.
- A downward projectile passing from `y=1` to `y=-8` while remaining active.
- A distant Goth character remaining visible without render-chunk registration.
- Weapon-switch and hover fields surviving a direct `resetPlayerState()` call.

An isolated Chrome check confirmed CSS color normalization breaks the current
health-flash comparison. A world-disposal probe confirmed that the Goth hitbox
geometry and material **are** disposed by `disposeWorld()`.

These are bounded probes, not a complete browser playthrough or live relay test.
The source/status refresh on 17 October found the same commit and no source
edits. The passing test run is dated evidence, not a new 17 October test run.

Use [config.ts](../src/config.ts) rather than the audit's copied numeric values:

| Value | Current source | Audit claim |
| --- | --- | --- |
| `PROJECTILE_RADIUS` | `0.07` | `0.35` |
| `MAX_PROJECTILES` | `220` | `200` |
| `SWITCH_DURATION` | `0.15` s per switching phase | `0.5` s |
| Shotgun pellets | `5` | Untrusted visual packets may request up to `16` |
| Weapon travel limit | `700` | `700` |

## 3. Recommended implementation order

P0 means a reproducible hang. P1 means a substantial lifecycle, authority or
progression failure. P2 covers ordinary gameplay/UI correctness. P3 covers
cleanup, documentation and measured performance improvements.

| Batch | Work packages | Priority | Main dependency | Completion gate |
| --- | --- | --- | --- | --- |
| 1 | A: bounded segment traversal | P0 | None | Termination and coverage regressions |
| 2 | B: runtime shutdown; G: blocked Mecha exit | P1 | None; keep as separate changes | Failure/cancellation and exit recovery |
| 3 | C: movement authority; D1: shot cadence and canonical packets | P1 | A for geometry-dependent cases | Adversarial and legitimate packet cases |
| 4 | E: admission ordering/capacity and host diagnostics | P1 | None | Reordered room operations and full lobby |
| 5 | F: collision consistency; D2: homing authority | P1/P2 | A; D2 also uses D1 and F | Same collision policy across client/host |
| 6 | H: HUD policy; I: flash state; J: reset and avatar presentation | P2 | B defines terminal runtime state | Boot, pause, death, respawn and Mecha matrix |
| 7 | K: world/menu ownership and culling | P2 | B and H for disposal/reset boundaries | Repeated rebuild and lobby churn |
| 8 | L: chat/model behavior decisions | P2/P3 | B defines teardown ownership | Consent/apply and load cancellation matrix |
| 9 | M: verified cleanup and documentation | P3 | Relevant behavior fixes | No behavioral regression; accurate docs |

Do not combine all batches into one patch. Keep state-machine changes, packet
changes, HUD changes and mechanical cleanup separately reviewable. A larger work
package can span more than one change; retain the acceptance criteria below.

## 4. Work packages

### A. Make spatial segment traversal bounded and complete

**Finding:** #7. **Owners:** [spatialHash.ts](../src/spatialHash.ts),
[spatialHash.test.ts](../tests/spatialHash.test.ts).

1. Add the exact hanging input as a regression. Initially run it in a bounded
   subprocess so an unfixed implementation cannot hang the whole suite.
2. Prevent an axis that has reached its endpoint cell from stepping past it
   because the other axis has a slightly later floating-point boundary time.
3. Bound traversal using the finite cell-distance progress invariant. Do not
   merely break an arbitrary loop after returning incomplete collision results.
4. Retain zero-length segments, negative coordinates, axis-aligned segments,
   endpoint-on-boundary behavior, corner neighbors, padding, deduplication and
   caller-owned output-array reuse.
5. Compare broad-phase results against an independent geometric reference on a
   bounded seeded sample. Check for omitted intersecting colliders, not exact
   equality of candidate sets; extra broad-phase candidates are allowed.

**Acceptance:** the reproduced input and its reversed/axis-swapped variants
terminate; no intersecting test collider disappears. The audit's separate
corner-padding claim remains unaccepted unless a geometric counterexample is
found. Reject invalid non-finite inputs or invalid cell sizes explicitly if they
can reach this public helper; never let them produce unbounded traversal.

### B. Give complete runtime teardown one owner

**Findings:** #4, terminal portions of #19/#20.
**Owners:** [main.ts](../src/main.ts), [multiplayer.ts](../src/multiplayer.ts),
[inputSession.ts](../src/inputSession.ts), [state.ts](../src/state.ts),
[pauseShortcut.ts](../src/pauseShortcut.ts).

1. Add a small disconnect/failure notification seam from networking to the
   composition root. Keep full scene/renderer disposal in `main.ts`; do not make
   networking import the composition root.
2. Distinguish explicit local teardown from an unexpected session failure so
   `disposeGameRuntime()` calling `disconnectMultiplayer()` cannot recurse.
3. Route host loss, signalling/admission/world-sync timeouts, PeerJS errors and
   asynchronous world-load failure through the same idempotent exit boundary.
   Preserve a useful reason for the correct menu panel.
4. Invalidate pending generation tokens before releasing resources. Stop input,
   loading work, timers, network connections, hooks, projectiles, particles,
   actors, world, day/night resources, controls and renderer in ownership order.
5. Release local held input synchronously rather than depending solely on a later
   pointer-lock event. Ensure stale control events cannot affect a new runtime.
6. Make simulation eligibility explicit: no arena update while awaiting the
   initial successful input activation or after runtime termination. A prepared
   frame may still be rendered during boot reveal. Keep multiplayer lobby clock
   progression and active multiplayer pause behavior intact.
7. Put fresh-match clock/sync resets in the appropriate state helper. Respawn must
   not reset the room clock or match score.

**Tests:** extend the existing multiplayer/input/loading tests with failure after
runtime creation, failure during world preparation, remote host close, duplicate
failure callbacks, leave-then-rejoin and stale async completion. Verify resource
disposal once, null runtime references, inactive input and no further arena
updates. Verify that a denied initial pointer lock retains a retryable prepared
match without running simulation.

**Acceptance:** failure returns to a usable menu; a subsequent match starts
cleanly; menu preview and abandoned arena no longer render together. Existing
model-preservation settings continue to control retained chat resources.

### C. Replace per-packet movement allowances with a time budget

**Finding:** #10. **Owners:** `authorizeClientPacket()` in
[multiplayer.ts](../src/multiplayer.ts), [config.ts](../src/config.ts),
[multiplayerIntegration.test.ts](../tests/multiplayerIntegration.test.ts).

1. Track a bounded travel allowance per admitted peer using host receipt time.
   Replenish by elapsed time and cap accumulated slack. A packet must not grant
   a new fixed movement allowance or a new minimum 16 ms of travel.
2. Derive legitimate speed bounds from actual walking, hover and grapple behavior.
   Keep the allowance for network jitter separate and bounded; do not simply
   tighten the current constants until ordinary grappling breaks.
3. Charge cumulative displacement across accepted updates, including a burst
   arriving in one event-loop turn. Rejected updates must not mutate movement,
   life, weapon or shot-validation state.
4. Reset the budget only at an accepted life/spawn transition or new session.
   Keep the existing bounds and life-transition checks.

**Tests:** packet floods at the same timestamp, small packets whose cumulative
distance is excessive, long silence followed by a burst, normal batched updates,
legitimate fastest movement, death/respawn, non-finite data and rejected-update
state preservation.

**Acceptance:** accepted travel is bounded by elapsed time plus one capped
tolerance, independent of packet count. This remains host validation of
client-simulated movement, not proof of fully authoritative movement physics.

### D1. Canonicalize shot cadence and replicated fire packets

**Findings:** #26 and authority prerequisites for #11.
**Owners:** [shotAuthority.ts](../src/shotAuthority.ts),
[multiplayer.ts](../src/multiplayer.ts), [networkTypes.ts](../src/networkTypes.ts),
[weapons.ts](../src/weapons.ts), [config.ts](../src/config.ts).

1. Establish the intended local cooldown rule before enforcing it on the host.
   Record the deadline created by the previous accepted shot so switching to a
   faster weapon cannot shorten an outstanding cooldown.
2. Track accepted weapon transitions and the actual withdraw/bring-in phases.
   Match the local `SWITCH_DURATION` behavior; preserve the existing Minigun
   trigger/ramp policy and bounded jitter tolerance.
3. Canonicalize outgoing pellet count from `WEAPON_STATS`. Tighten parsing or
   remove the redundant client-controlled field with a deliberate compatibility
   policy. Never relay a claimed count as authority for damage or visual work.
4. Preserve unique shot IDs, deterministic spread, exact damage and one accepted
   hit per pellet. Bound all new ledger state and clear it on life/session end.

**Tests:** Sniper-to-Pistol at 90 ms, switching in both directions during cooldown,
repeated weapon oscillation, valid transitions, Minigun spin-up/down, duplicate
IDs and a valid shotgun packet claiming 16 pellets. Verify the relayed packet
and remote visual spawn count as well as damage authorization.

**Acceptance:** switching cannot accelerate cadence; ordinary weapon switching
still feels the same; every admitted shotgun shot produces the configured count.

### D2. Validate homing hits against a feasible flight path

**Finding:** #11. **Owners:** [projectileHoming.ts](../src/projectileHoming.ts),
[projectiles.ts](../src/projectiles.ts), [shotAuthority.ts](../src/shotAuthority.ts),
[multiplayer.ts](../src/multiplayer.ts), [smartGoggles.ts](../src/smartGoggles.ts).

1. Capture current valid client trajectories as acceptance fixtures, including
   delayed steering, moving targets, spread, close targets and partial cover.
2. Extract shared deterministic flight-step math where needed. Use the same
   finite turn rate, muzzle offset, homing-start threshold, travel budget and
   swept collision rules on the client and in host verification.
3. Replace the ledger's distance-plus-straight-LOS shortcut with bounded host
   flight verification for the captured target identity. Keep bounded target
   samples per life/revision where movement history is needed; do not trust a
   new client-reported trajectory or timestamp as proof.
4. Validate acquisition visibility and aim at fire time. Validate the later
   curved path segment by segment; a single straight origin-to-current-target
   obstruction test is not equivalent to the path a legal curved shot flew.
5. Canonicalize or strictly bound `homingStartDistance` against the legitimate
   firing/batch-sampling policy. Preserve the existing Minigun ten-shot sample
   reuse unless intentionally changing that behavior and its documentation.
6. Preserve shot lifetime, range, damage, pellet identity and target life/revision
   checks. A target change or respawn must never retarget an old homing shot.

**Lock-timing decision:** the current protocol does not report scoped state or
lock progress, and reduced-motion mode shortens visual lock timings. The first
repair should guarantee physically feasible damage and valid acquisition; it
must not claim to verify the UI animation duration. If enforcing a host-owned
acquisition delay is required, define a shared gameplay policy separately from
animation and add validated intent packets plus a host clock. A client flag or
client timestamp alone does not enforce it. Do not silently impose 220 ms on
players whose current reduced-motion path completes in 1 ms.

**Tests:** forged off-path claims, impossible turns, early hits, wrong target or
life, altered steering thresholds, spread pellets, obstacle/floor crossings,
target movement, bounded network jitter, full-rate Minigun and valid curved hits.
Compare the shared simulation and host decisions over fixed and variable steps.

**Acceptance:** all fabricated-trajectory fixtures are rejected while legitimate
client trajectories remain accepted within an explicit bounded tolerance. Record
the maximum verification workload; queues/history must have fixed limits.

### E. Make room admission robust to ordering and hostile connection attempts

**Findings:** #12, #28, #35, #36, #37.
**Owners:** [turnRoom.ts](../src/turnRoom.ts), [turnSecurity.ts](../src/turnSecurity.ts),
[worker.ts](../src/worker.ts), [multiplayer.ts](../src/multiplayer.ts).

1. Prevent an old roster from pruning a later admission. Recommended design:
   assign a server-owned admission generation, return the acknowledged generation
   to the host, and include that acknowledgement with heartbeat snapshots. A
   heartbeat may prune only memberships it could have observed. Keep explicit
   departure and finite room/session expiry as cleanup paths.
2. Validate generation fields and update stored-room compatibility deliberately.
   An older heartbeat without an acknowledgement must not gain permission to
   prune new sessions. Preserve single-use, peer-bound tickets and capability/IP
   checks. Document any protocol/version transition before shipping it.
3. Allocate the first available case-insensitive `Guest1` through `Guest5`, using
   room occupancy rather than an assumption that the host occupies `Guest1`.
4. Reject missing or structurally invalid admission metadata before reserving a
   pending PeerJS slot. Syntactically valid forged tickets still need bounded
   asynchronous verification, pending capacity and timeouts; this check does not
   eliminate all offer-flood denial of service.
5. Route hosting errors to the host panel and joining errors to the join panel.
   Preserve terminal reasons through B's teardown rather than writing them into
   an invisible element.
6. Add the missing heartbeat security-configuration check with the same intended
   disabled-service behavior as other protected endpoints.
7. Investigate the rate-limiter race claim using actual Durable Object execution
   and storage semantics before adding serialization. For alarms, reproduce an
   expired alarm arriving after a new bucket starts; if reachable, compare the
   stored window's expiry before deleting and reschedule as appropriate.
8. Exercise host death attribution through actual accepted hits, including a
   departed killer, respawn and duplicate reports. Change nullable attribution
   fallback/retention only if that route demonstrates a violation. Outgoing
   death packets must always satisfy the parser.

**Tests:** stale heartbeat captured before connection/admission, reordered
admission responses, reordered/duplicate heartbeats, explicit departure, username
reuse, forged/expired tickets, unopened channels, full room with a custom host
name, disabled configuration, and alarms at window boundaries.

**Acceptance:** stale rosters do not evict new players, departed memberships
eventually expire, all five real slots remain usable, and pending offers always
release their slot. Validate Worker changes locally and in a real host/join flow;
in-memory tests alone do not establish platform concurrency or TURN behavior.

### F. Align floor, obstacle, ceiling and grapple collision policy

**Findings:** #6, #8, #23, #27. **Owners:** [gameplayMath.ts](../src/gameplayMath.ts),
[projectiles.ts](../src/projectiles.ts), [weapons.ts](../src/weapons.ts),
[multiplayer.ts](../src/multiplayer.ts), [physics.ts](../src/physics.ts),
[grapple.ts](../src/grapple.ts), [world.ts](../src/world.ts).

1. Add a shared ground-plane contact calculation for straight/swept shot segments.
   Use a radius-aware contact for projectiles and a zero-radius ray contact for
   hitscan. Include the ground in closest-hit selection and host path checks.
   Do not insert the arena-sized plane into every cell of the obstacle hash.
2. Parameterize host obstruction by shot type. Radius-based obstacle inflation
   and broad-phase padding must match the same shot radius; sniper stays a ray.
3. Define ceiling clearance consistently for horizontal admission and upward
   collision, preserving stepping, falling and stair traversal. Fix the observed
   mismatch without treating every movement under an overhang as an upward hit.
4. For enemy grapple assistance, ray-test the actual selected enemy path against
   intervening cover. Compare distances from the same origin in first and third
   person; keep the existing magnetic acquisition allowance.
5. For moving Mecha surfaces, retain a local anchor on the hit collider and update
   its world position as the part moves. Release when the collider/actor loses
   solid authority, dies into an incompatible phase, or is disposed. Keep the
   existing separate cockpit boarding path.

**Tests:** downward/parallel/upward floor shots, bullets starting at floor contact,
homing crossing below ground, sniper floor endpoints, adjacent-cell grazing at
the actual `0.07` projectile radius, zero-radius sniper clearance, low overhangs
during ascent/descent, offset enemy behind cover, shoulder-camera grapple aiming,
moving armor and actor disposal. Reuse town stair and variable-frame-rate tests.

**Acceptance:** a projectile cannot travel through the floor and return; host
and client agree on shot clearance; assisted grapples respect cover; moving
anchors follow the surface without changing player/world collision authority.

### G. Recover safely from a completely blocked Mecha exit

**Finding:** #5. **Owners:** [forgottenMecha.ts](../src/forgottenMecha.ts),
[mechaPilotRelease.ts](../src/mechaPilotRelease.ts),
[mechaHeadView.ts](../src/mechaHeadView.ts), [mechaMovement.ts](../src/mechaMovement.ts).

1. Build a real-asset fixture that blocks all existing release candidates and
   prove the persistent `shutting-down` condition before changing behavior.
2. Recommended fallback: if no collision-safe release is possible, cancel the
   voluntary exit, restore a usable piloted state and show a brief blocked-exit
   message. The player can reposition and retry. Never teleport through geometry
   or leave an invulnerable, uncontrollable shutdown waiting indefinitely.
3. Share a bounded exit search between preflight and final release. Revalidate
   at release against the current animated colliders; preflight alone is not
   sufficient. Avoid rebuilding obstacle arrays for every candidate.
4. Restore camera/helmet/HUD/input coherently on cancellation. Preserve player
   HP/life, selected view, fuel and valid actor state; successful release still
   happens once. Lethal FinalDeath follows its existing immediate-release rule.

**Tests:** fully blocked exit, front blocked but side clear, obstacles added after
preflight, reposition-and-retry, paused shutdown, repeated Exit input, lethal
destruction and leave during reverse presentation.

**Acceptance:** every exit request either releases safely or returns control;
no indefinite ownership trap, clipping or duplicate release callback.

### H. Consolidate HUD visibility at the composition boundary

**Findings:** #1, #2, #14, #17, #19.
**Owners:** [main.ts](../src/main.ts), [hud.ts](../src/hud.ts),
[worldLoading.ts](../src/worldLoading.ts), [mobileControls.ts](../src/mobileControls.ts),
[gameUI.css](../src/gameUI.css), [mobile.css](../src/mobile.css).

1. Derive one small HUD presentation policy from runtime/reveal state, active
   input, life, conversation, scope, terminal state and Mecha phase. Keep it
   testable without WebGL. Avoid a general UI framework or rewriting all menus.
2. Apply it immediately on input/overlay/lifecycle transitions and at the final
   presentation step before drawing. Remove the competing visibility writes
   from the affected callbacks/branches as they migrate.
3. Initialize G-meter/Power Jump content and visibility at the same boot-reveal
   boundary as the ordinary HUD. Keep simulation frozen during reveal. Test
   respawn separately because it has no 500 ms boot reveal.
4. Treat a zero delta as a measurement-reset condition, not a reason to hide an
   otherwise eligible G-meter. Hide it during boarding/startup/shutdown; preserve
   current desktop/touch-specific presentation and actual scoped behavior.
5. Clear the NPC prompt immediately on pause, death, conversation and teardown.
   Keep its click handler subject to the existing interaction eligibility gate.
6. Make crosshair, counters, FPS, bars, Power Jump, speedlines, border warning,
   scope and Mecha head overlays obey explicit ownership. Terminal/menu UI wins
   over stale scope transitions. Keep Mecha's authored shutdown HUD fade where
   it is intentional, and clear hardware overlays on terminal cleanup.

**Tests:** a compact policy matrix for menu/loading/reveal/active/pause/chat/death/
Game Over/disposal, first and third person, scoped and unscoped, touch mode, and
all pilot phases. Add integration assertions for the real application of the
policy; pure policy tests alone cannot catch a remaining stray DOM writer.

**Browser acceptance:** the requested two HUD timing fixes are visible in actual
boot, respawn and Mecha entry/exit. No transient crosshair/HUD reappearance while
pausing scoped multiplayer. Reuse existing fixtures rather than adding a second
review harness.

### I. Separate health values from damage-flash state

**Finding:** #3. **Owners:** [hud.ts](../src/hud.ts), [main.ts](../src/main.ts),
[healthRegen.ts](../src/healthRegen.ts).

1. Replace color-string equality with explicit flash ownership/generation and a
   cancellation/expiry rule. Expiry cannot restore a flash belonging to a prior
   life, Mecha owner or disposed match.
2. Updating health width must not implicitly clear an active flash. The mounted
   per-frame value update and regeneration use the same rule.
3. Use ordinary presentation, not a damage flash, when restoring the on-foot
   health bar after voluntary release. Real damage still starts/extends a flash.
4. Clear pending timers/state on fresh match and teardown; avoid a timer per
   render frame. Preserve the intended damage-flash duration.

**Tests:** browser-normalized CSS, overlapping hits, regeneration during a flash,
mounted damage followed by the ordinary HUD tick, full-health release, zero HP,
respawn and stale expiry after teardown.

**Acceptance:** red is visible for real damage and returns to the normal color;
full-health release stays normal; a stale callback cannot recolor a new owner.

### J. Stabilize reset and third-person presentation order

**Findings:** #9, #18, #20; #29 for paused multiplayer hazards.
**Owners:** [state.ts](../src/state.ts), [playerSpawn.ts](../src/playerSpawn.ts),
[weapons.ts](../src/weapons.ts), [main.ts](../src/main.ts),
[inputSession.ts](../src/inputSession.ts), [healthRegen.ts](../src/healthRegen.ts).

1. Separate weapon simulation/cooldowns from copying the player avatar pose.
   Copy avatar position after movement and hook translation, before resolving
   the final third-person camera and drawing. Preserve firing and collision order.
2. Normalize first/third-person gun pose during reparenting or inspection
   cancellation so rotation cannot survive an inspect transition.
3. Make reset helpers clear transient hover/input/switch state consistently.
   Recommended respawn policy: retain the weapon actually equipped, cancel any
   unfinished switch, synchronize `desiredWeaponName` to it, clear `nextWeaponName`,
   and restore its normal pose. Fresh matches still start with Pistol.
4. Keep match-level clock/score/goggles failure separate from per-life resets.
   Do not accidentally repair bricked goggles or reset the room clock on death.
5. Allow lava damage for living active-match players in multiplayer even while
   local input is paused. Keep offline simulation frozen on pause. Preserve one
   death per life and the existing independent regeneration timing policy.

**Tests:** inspect-to-third-person and back at several animation phases; avatar
and camera positions after physics/hook updates; death during both switch phases;
held hover/fire at reset; fresh match versus church respawn; paused multiplayer
lava through death/respawn; offline pause not consuming hazard time.

**Acceptance:** no twisted gun, avatar frame lag, inherited switch animation or
pause-based lava immunity. Document the retained-weapon policy explicitly.

### K. Clarify world/menu resource ownership and chunk culling

**Findings:** valid portions of #15, #21, #24, #25, #38.
**Owners:** [world.ts](../src/world.ts), [mainMenu.ts](../src/mainMenu.ts),
[smartGoggles.ts](../src/smartGoggles.ts), [multiplayer.ts](../src/multiplayer.ts).

1. Dispose each lobby/preview-owned `InstancedMesh` when removed, releasing its
   instance buffers while retaining shared flame geometry/materials until their
   actual owner ends. Keep resource sets deduplicated and teardown idempotent.
2. Keep Goth hitbox ownership as already implemented: world disposal releases it.
   Do not introduce a second unconditional disposer into the actor and create
   double ownership. Add lifecycle coverage only where the existing contract
   needs protection.
3. Register the animated NPC's presentation root in the same render-distance
   policy as its house, including interior light visibility. Its collider and
   obstacle-hash entry remain active when its visuals are culled.
4. Batch lantern visuals by their actual chunks or use equivalent per-instance
   chunk selection. Lights follow their own position's visible chunk, not one
   group origin. Keep the eight-light night behavior for visible lanterns.
5. Keep a clear distinction between a fresh-world builder and the disposing
   rebuild APIs. Prefer making the internal builder's precondition explicit;
   do not blindly add another disposal to every caller. Direct public rebuild
   requests must use a disposing entry point.
6. Reset/prune goggles' hidden-health-bar references at an actual world replacement
   boundary. Preserve the documented brief outgoing callout overlap; do not turn
   five selected targets into a prohibition on all retiring animation nodes.
7. Make remote avatar removal null-safe where supported by B's lifecycle and
   deduplicate owned resources. Do not dispose shared gun/body resources.

**Tests:** repeated joins/departures and world rebuilds; disposal events once per
owned resource; scoped rebuild followed by unscoping; NPC/light/lantern visibility
around negative and positive chunk boundaries; collision and shot queries
unchanged at low/high render distance.

**Acceptance:** removed instances release their buffers, visible props follow the
correct chunk, gameplay authority survives culling, and repeated lifecycle cycles
do not accumulate retained world references.

### L. Resolve model/consent behavior without unnecessary caching

**Findings:** #13, #16, #30, valid part of #32; unwired chat abort handling.
**Owners:** [gothChat.ts](../src/gothChat.ts), [gothChatConsent.ts](../src/gothChatConsent.ts),
[gothChatEngine.ts](../src/gothChatEngine.ts), [gothKnowledge.ts](../src/gothKnowledge.ts),
[gothGirlfriend.ts](../src/gothGirlfriend.ts), [forgottenMecha.ts](../src/forgottenMecha.ts),
[renderPreparation.ts](../src/renderPreparation.ts).

1. Preserve separate concepts: consent authorizes local AI use; Apply commits the
   immediate-download setting. Discard must not silently start a model download.
   Recommended UX: skip repeating already-granted consent, stage the option,
   and start background loading only after Apply.
2. Keep an accessible modal with focus restoration. Hiding its underlying menu
   is not itself a defect; avoid reworking the chat CSS solely on that claim.
3. Give an in-progress model load an explicit owner. Recommended policy: if
   applied immediate-download is on, closing chat detaches UI while loading
   continues; otherwise closing chat cancels an unfinished interaction-owned load.
   This is an intentional behavior change from the current shared-load comment.
4. Wire cancellation to the actual knowledge fetch and inference-worker lifecycle,
   or remove an unused controller if the final ownership policy makes it obsolete.
   Reopening must not reuse a disposed engine or let stale completion overwrite
   a newer load. Declining consent must never start loading.
5. Measure Goth/Mecha parse and first-visible-frame costs before introducing GLB
   caches. Existing per-match parsing is an overhead tradeoff, not a leak.
6. If the Goth model demonstrably arrives after preparation and causes a visible
   hitch, make its readiness/prewarm a cancellable preparation dependency or add
   a bounded late-preparation stage. Preserve a clear optional-asset failure path;
   a missing NPC asset should not create an indefinite loading screen.
7. Any adopted asset cache needs bounded ownership and correct cloning of skins,
   skeletons, materials and animations. Do not add the nonexistent `labelTexture`
   cache cleanup described by the audit.

**Tests/browser checks:** first consent, saved consent, decline, Apply/Discard,
close/reopen during fetch/engine import/model load, preload on/off, model failure,
match leave during load, and late GLB completion after scene replacement.

**Acceptance:** actual download/cancellation behavior matches the applied setting
and UI text. Only measured model-preparation/caching changes enter implementation.

### M. Remove verified redundancy and update current documentation

**Findings:** #33, #34, #41 and the report's dead-code/CSS inventory.

1. After behavior changes settle, recheck exact symbol references across `src/`,
   `tests/`, HTML fixtures and Worker bindings. Distinguish unused exports,
   internally used declarations, test-only APIs and genuinely unused code.
2. Candidate removals: redundant `lastForceSendTime` bookkeeping, unreachable
   parsed-packet `fallbackSeed`, unreferenced `cockpitOpen`, write-only pilot
   `hudTime`, redundant camera nullish fallback and unnecessary export modifiers.
   Remove unused peer regen fields only after updating their test/fixture uses.
3. Reconcile `labelPlacement`, the duplicate anomaly-center calculation and the
   unused bounding-sphere calculation with the actual consumers. Keep guards
   that validate a needed precondition; do not delete a check solely because
   its value has no later arithmetic use.
4. Keep test-visible geometry/state accessors and defensive method guards unless
   their contract is deliberately replaced. Polar-angle fields are read; a
   zero-listener event does not prove its whole input implementation is dead.
5. Remove verified unused CSS classes/custom properties and duplicate declarations.
   Evaluate overridden properties individually: the earlier color-input rule
   still supplies dimensions. Check menu/tab hover specificity, compact settings
   layouts and touch-help readability with real computed styles.
6. Defer speedline image creation until needed or prepare it during loading if
   measurement justifies it. Remove the duplicate ensure call where safe. Treat
   the hook-badge lookup as a small consistency cleanup, not a performance project.
7. Correct [operations.md](operations.md) to the actual ten room creations per
   half hour, and [architecture.md](architecture.md) to the continuous multiplayer
   lobby clock. Update ownership, packet authority and feature guides as their
   implementations change. Avoid claiming zero-allocation loops.

**Acceptance:** no removal breaks a production entry point, test seam or fixture;
the remaining interfaces explain their purpose. A cleanup-only change adds no
tests that merely mirror deleted lines. Reuse existing checks and focused browser
checks for visual CSS changes.

## 5. Complete disposition of the numbered audit

“Investigate” requires a reproducer or measured problem before behavior changes.
“No fix” rejects the claim for the reviewed checkout, rather than promising the
area can never contain a different bug.

| Audit # | Disposition | Planned work or correction |
| --- | --- | --- |
| 1 | Fix, narrower scope | H: initial reveal plus separate respawn visibility; no 500 ms respawn claim |
| 2 | Fix | H: phase-aware G-meter; do not introduce nonexistent `mountSession` |
| 3 | Fix | I: explicit health flash state and neutral release presentation |
| 4 | Fix | B: full asynchronous termination and initial-input simulation gating |
| 5 | Reproduce then fix | G: bounded blocked-exit recovery |
| 6 | Fix | F: shared ground collision for projectiles/hitscan/host checks |
| 7 | Fix hang; verify padding separately | A: bounded traversal with coverage proof |
| 8 | Fix specific mismatch | F: horizontal clearance and upward ceiling contact |
| 9 | Fix | J: reset gun orientation at inspect/view transitions |
| 10 | Fix | C: host time-based cumulative movement budget |
| 11 | Fix feasible-hit authority | D2: path/acquisition checks; separate UI lock-duration policy |
| 12 | Fix | E: heartbeat acknowledgement cannot prune unseen admissions |
| 13 | Clarify and improve UX | L: persistent consent versus pending download option |
| 14 | Fix actual visibility leak | H: prompt hidden immediately; death overlay already paints above it |
| 15 | Fix menu instances only | K: retain existing world-owned Goth hitbox disposal |
| 16 | Measure first | L: optional asset readiness/prewarm if it produces a hitch |
| 17 | Fix remaining branch | H: crosshair/counters/FPS; bars and death already have guards |
| 18 | Fix | J: avatar pose after accepted movement |
| 19 | Fix lifecycle presentation coherently | B/H: retain existing scope/death/hover cleanup |
| 20 | Fix transient reset gaps | B/J: no unsupported forced-Pistol respawn requirement |
| 21 | Fix | K: actual lantern/NPC chunks, with collision unchanged |
| 22 | No fix | Gameplay goggles are created first; claimed hidden menu ownership is false |
| 23 | Fix | F: target LOS, consistent origin and moving armor anchor |
| 24 | Clarify builder precondition | K: production rebuild APIs already dispose |
| 25 | Fix reference lifecycle; preserve intended overlap | K: five selected callouts permits retiring nodes |
| 26 | Fix | D1: prior-shot deadline, real switch timing, canonical pellet count |
| 27 | Fix using actual constants | F: `0.07` projectile radius and zero-radius sniper |
| 28 | Fix pending metadata gate; investigate host death route | E: no claim of a reproduced ordinary host-death failure |
| 29 | Fix | J: paused multiplayer lava remains hazardous |
| 30 | Explicit load-ownership decision | L: applied preload versus interaction-owned loading |
| 31 | No fix | Editor already tracks `pointerId`; reported `touchLock` implementation absent |
| 32 | Measure GLB costs; reject cache claim | L: alleged `labelTexture`/`textures` cache does not exist |
| 33 | Fix documentation | M: room rate and multiplayer lobby clock |
| 34 | Low-priority cleanup/measurement | M: cached speedline generation placement |
| 35 | Fix heartbeat guard; investigate limiter behavior | E: platform-aware alarm/concurrency reproduction |
| 36 | Fix | E: automatic guest allocation from all valid free names |
| 37 | Fix | E/B: visible host error reporting across teardown |
| 38 | Low-priority lifecycle cleanup | K: null safety and deduplicated owned resources |
| 39 | No fix | Current shader/render-target implementation has no cited canvas/prepared path |
| 40 | No fix | `PointerLockControls.lookTouch` does not exist; real touch look checks input |
| 41 | Optional small cleanup | M: cache/reset hook badge consistently |

## 6. Validation and review contract

### During each implementation batch

- Add a focused regression for a real failure or a meaningful lifecycle/security
  invariant. Extend existing suites rather than building parallel test systems.
- Run affected suites while iterating. For packet changes, keep types, runtime
  parser, sender, host authorization/relay, receiver and tests together.
- For Worker protocol/storage changes, test backwards/invalid inputs, room
  expiry, capability failure and explicit cleanup as well as the happy path.
- Recheck existing invariants: deterministic seed generation, authoritative
  collision despite culling, correct target lives, one death/release per life,
  shared-resource ownership and stale-async suppression.

### Before completing a source-changing batch

1. Run `npm run check` for both TypeScript graphs and the full current suite.
2. Run `npm run build` for production-affecting work and include all regenerated
   tracked/untracked `dist/` additions/deletions. Do not hand-edit hashed assets.
3. Run `git diff --check` and inspect the full working tree, including LFS-managed
   generated files. Confirm the intended source/test/doc files are included.
4. Perform only the browser checks relevant to that batch. Networking changes
   additionally need two real browser clients, host/join, firing/hit/death/respawn,
   departure/rejoin, and a relay-required network when validating TURN.
5. Record automated, local-browser, physical-device and deployed-network results
   separately. A passing Node suite or same-network room does not prove them all.

Reuse the existing town, goggles, Mecha, player-list and chat fixtures documented
in [development.md](development.md) and the compact Mecha acceptance checklist in
[forgotten-mecha.md](forgotten-mecha.md#current-manual-acceptance). Do not repeat
an exhaustive visual review for a helper-only change or write trivial tests for
reversible documentation/cleanup edits.

### Final combined acceptance

- New offline start: synchronized HUD reveal, correct ground impacts and no
  gameplay before successful activation.
- Offline pause/death: frozen simulation, clean overlays, stable respawn and
  retained intended match state.
- Mecha: boarding/startup/shutdown G-meter behavior, damage flash, safe exit,
  blocked-exit recovery, FinalDeath, remount and leave/cancellation.
- Multiplayer: normal movement at supported speeds plus burst rejection;
  legitimate and forged straight/homing fire; scope/pause; lava death; five-player
  naming/admission; host loss; rejoin with no abandoned runtime.
- Resource lifecycle: repeated match/lobby cycles without accumulating owned
  instance buffers, world references, timers or render contexts.
- Current docs describe the implemented behavior and remaining limits. Historical
  counts/results remain dated rather than being presented as fresh verification.

## 7. Scope decisions to carry into implementation

Use the recommended defaults above unless the intended behavior is changed
explicitly: recover a blocked exit by returning control, retain the equipped
weapon on respawn while cancelling its switch, preserve intentional callout
retraction overlap, and make non-preload chat loading interaction-owned.

Three items need evidence/design work inside their package before a fix is chosen:
strict host acquisition timing, Durable Object rate-limiter concurrency, and
GLB caching/prewarm. Do not convert the audit's guesses into mandatory rewrites.

The plan is complete when these packages and dispositions are reviewable. The
repair effort itself is complete only after the accepted fixes, corresponding
documentation/build output and relevant acceptance checks have been delivered.
