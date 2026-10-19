# Audit repair progress

Implementation and local acceptance completed 19 October 2026 against
`4f9a4a9`. The [repair plan](audit-repair-plan.md) remains the complete scope.
All packages below are implemented and locally verified. The incremental log
retains earlier counts and open gates as dated history; the final acceptance
record below supersedes those gates. Deployment and physical-device limits are
listed separately.

## Package status

| Package | Current state | Evidence or remaining gate |
| --- | --- | --- |
| A | Implemented | Exact hang reproduced before repair; bounded subprocess regression, reversed/axis-swapped inputs, invalid inputs and 500 seeded independent coverage comparisons pass |
| B | Implemented and locally verified | Notification seam, idempotent root disposal, synchronous input release, generation cancellation and prepared-offline simulation gating; Node failure/stale-callback tests and local Chrome disposal check pass; native relay-only host loss, rejoin and fresh-room acceptance also pass |
| C | Implemented and locally verified | Cumulative receipt-time travel budget; burst, silence cap, fastest configured movement, rejected-state preservation and respawn regressions pass |
| D1 | Implemented and locally verified | Previous-shot deadline, non-compounding jitter, both switch phases and canonical pellets; parser, authority, two isolated module-graph room tests and native browser combat pass; phase changes publish immediately and a new switch does not consume the preceding frame |
| D2 | Implemented and locally verified | Shared 120 Hz guidance, bounded history/acquisition/replay, physical obstruction and identity checks; 159 real client pellet claims across 84 combinations plus native moving-peer homing pass |
| E | Implemented and locally verified | Generation snapshots/migration, malformed metadata gate, five-slot naming, fail-closed heartbeat, host diagnostics and expiry-aware limiter; unit/Worker integration, actual SQLite workerd quota/five-slot probes and native host/join/rejoin pass |
| F | Implemented and locally verified | Shared ground contact, shot-radius obstruction/padding, ceiling clearance, assisted-target cover, rendered shoulder ray and moving armor anchors; focused collision/stair/Mecha regressions and browser ground-impact checks pass |
| G | Implemented and locally verified | Real asset and actual Chrome pass blocked preflight, late obstruction, bounded recovery, control/HUD restoration and safe retry; mount/lifecycle/finishing suites pass |
| H | Implemented | One policy/applicator; Node matrix and actual Chrome boot-reveal, scoped MP pause, respawn, all sampled Mecha entry/exit phases and mounted pause pass |
| I | Implemented | Explicit flash generation/timer ownership, neutral release and owner/life cancellation; unit checks and actual browser mounted damage/expiry/release checks pass |
| J | Implemented and locally verified | Final avatar pose copy, inspect/view normalization, retained-weapon switch reset and paused multiplayer lava; lifecycle/hazard regressions and actual browser pose/view/lava checks pass |
| K | Implemented | Fresh-world precondition, null-scene/deduplicated disposal, NPC/light/lantern chunks and goggles world-generation reset; Node lifecycle checks and three actual WebGL lobby churn cycles pass |
| L | Implemented | Saved-consent/Apply/Discard browser checks; abort/stale-import/worker/load ownership regressions; two local asset profiles recorded without introducing caches |
| M | Implemented and reviewed | Removed verified redundant state/fallbacks/private exports and unused CSS; real computed-style checks pass; current ownership and protocol documentation updated |

## Delivered behavior

- Segment traversal never advances an axis beyond its endpoint cell and has a
  finite cell-progress bound. Invalid segment inputs fail explicitly.
- Unexpected session termination invalidates networking work before asking the
  composition root to dispose the arena. Duplicate failure events cannot repeat
  the renderer disposal. Held input is released before a deferred browser event.
- Host travel allowance is capped once and replenished by elapsed receipt time,
  including for dead updates in the same life. Invalid movement cannot change
  death, equipment or shot state.
- Shot deadlines survive weapon changes. Update packets now require validated
  switching phase and pending weapon fields; mixed older/newer clients are not
  protocol compatible. Host and viewers use configured pellet counts.
- Mecha exit checks before shutdown and again at release. A newly blocked exit
  restores the standing cockpit behind the boot reveal, retains energy and view
  intent, and returns control. Preflight failure leaves control active and shows
  the same brief reposition-and-retry message.
- Room heartbeats pair roster snapshots with server admission generations. Old
  rosters cannot remove new admissions; omitted orphan sessions still expire.
  Pending channels remain represented when admission responses return out of
  order. All five slots work with a custom host or `Guest2`/`Guest5` host.
- Ground contact participates in closest-hit selection for local/replicated
  projectiles and sniper rays. Host padding matches the actual shot radius;
  straight peer hits survive visual culling. Assisted grapples test target LOS,
  use one aim origin and keep Mecha anchors in collider-local coordinates.
- Health value updates preserve a live damage flash; resets and health-owner
  transfers cancel it. Respawn cancels unfinished weapon presentation while
  retaining the equipped weapon and match state. Avatar pose is copied after
  movement/hook updates, and paused multiplayer players remain vulnerable to lava.

## Verification log

- Initial implemented A/B/C/G batch: `npm run check` passed both TypeScript
  projects and 369 tests.
- D1 focused parser/authority/integration suites pass. The existing BinaryPack
  room fixture now drives real weapon switching rather than assigning equipment
  instantly; its every-weapon/both-directions damage, death, respawn and health
  inspection test passes.
- Local Chrome 155: the actual application remained prepared but frozen after
  an intentionally denied initial input request; simulated session termination
  disposed the renderer once, cleared scene/camera/controls/renderer references,
  released held input and returned to the join panel without page errors.
- Final combined `npm run check` for these changes passed both TypeScript
  projects and **374/374 tests**. `npm run build` passed and regenerated the
  tracked production output. `git diff --check` passed; all three built HTML
  asset references exist, and links in the changed feature/architecture/plan
  documents resolve.
- The final local Chrome check also captured real application update packets
  for withdrawal, bring-in and idle; every captured packet passed the runtime
  parser. Teardown hid the ordinary HUD, Power Jump and NPC prompt in addition
  to releasing resources and held input, with no page errors.
- These browser checks used local controlled input/termination and a recording
  transport. The BinaryPack room test uses isolated real game module graphs
  with simulated transport/authentication. Neither result proves a deployed
  PeerJS/TURN session. Two actual browser peers and relay-required networking,
  plus the remaining combined gameplay acceptance, are still outstanding.
- E/F/I/J combined `npm run check` passed both TypeScript projects and
  **396/396 tests**. This includes stale/legacy/reordered heartbeat cases,
  metadata flooding, disabled configuration, real ground/ceiling/stair geometry,
  real armor-grapple motion/disposal, flash ownership, view/reset poses and lava
  damage through pause/death/respawn. The two-module-graph room test also verifies
  parseable host/client death attribution after actual accepted lethal hits.
- A temporary local workerd probe exercised the actual configured SQLite-backed
  Durable Objects with dummy credentials and mocked external services: 20
  concurrent quota requests admitted exactly three; a `Guest2` host plus four
  automatic guests retained credentials across stale heartbeats. Forcing the
  previous alarm handler after a new quota window started reproduced bucket loss
  before repair and correctly returned 429 after repair. No extra request
  serialization was added. This is local runtime evidence, not a deployed TURN
  or natural alarm-delivery timing measurement.
- The follow-up actual-application Chrome check passed with no page errors:
  final avatar position matched the accepted camera/player position exactly;
  inspection-to-third-person left zero yaw/roll; real mounted damage remained red
  through an ordinary value update and expired to green; mounted destruction
  returned a full-health on-foot green bar with unchanged score. A downward
  projectile retired at y=0.07, paused multiplayer lava caused one death, and
  termination still released the renderer once and cleared all runtime/HUD state.
  The check controlled actor/input state and used a recording transport; it does
  not replace two actual network peers or the remaining HUD timing acceptance.
- Additional regressions prove guidance cannot rescue a projectile from below
  the floor, and a victim can report one valid attributed death and respawn after
  its killer leaves. No speculative host-death attribution rewrite was necessary.
- Final check for this follow-up batch: both TypeScript projects and
  **397/397 tests** pass. The browser check also exercised an actor-owned HP
  reduction (the route used by mounted hazards): the ordinary HUD detected it
  once, preserved the red flash, expired it and restored neutral presentation
  on destruction/release. `npm run build` passed and regenerated production
  output; built HTML references, tracked/new-file whitespace and the final
  source/test/asset inventory were checked. Existing historical-document
  deletions and the protected follow-up file remain unchanged.

Pre-existing deletions of the two historical September audit documents remain
untouched. `docs/to_be_changed.md` is unchanged.

## 19 October follow-up: D2, H, K, L and cleanup

- Guided client bullets and host replay share fixed 1/120-second integration,
  finite steering, muzzle-inclusive range and per-step collision. Each target
  history is bounded at 128 samples; observation lag is capped at 150 ms, replay
  candidates at 12, contact tolerance at 0.35 units and arrival grace at 100 ms.
  A claim has at most 1,128 replay steps. A receipt-time token budget allows at
  most 40,000 step units/second plus one capped burst per shooter. Context/history
  searches cost 256 units before work starts, including zero-candidate failures. An instrumented
  synthetic 1,000-invalid-claim probe stopped at that cap (about 8 ms for flight
  math with a no-op collision callback); it does not measure full world-query or
  browser/network performance. UI lock-animation duration remains unverified by
  design. Full-speed Minigun ten-shot sampling is retained.
- The real client weapon/projectile loop produced 159 accepted pellet claims in
  84 combinations of four projectile weapons, close/long range, walking/fast
  approach motion, bounded observation lag, near-range cube corners and
  fixed/variable frame partitions. A reproduced range-edge mismatch now uses
  consistent enclosing-body guidance bounds without enlarging collision or
  travel limits. Adversarial tests cover
  fabricated thresholds/paths, arrival time, floor/cover, replay and target
  replacement. The real host path separately verifies fully covered acquisition,
  partial silhouettes, intervening bodies and replacement revisions. Guided
  peer targeting remains valid under render culling. Native peer validation is
  still being completed separately.
- One HUD policy now runs on transitions, before frame-loop early returns and
  before drawing. Actual Chrome 155 application checks sampled the complete
  ordinary HUD, neutral G-meter and initialized Power Jump during the frozen
  black-screen reveal. Clock, actor time and player height stayed unchanged in
  those reveal samples. Respawn restored the complete HUD without boot loading.
  Scoped multiplayer pause hid crosshair, counters, bars, scope, G-meter, Power
  Jump and prompt immediately and after continued simulation. Mounted pause
  also hid hardware overlays. Real-asset boarding, loading, HUD fade, reveal,
  piloting, reverse reveal/HUD/shutdown and safe release obeyed the same policy.
  Input capture and phase stepping were controlled by the fixture; this is not
  a physical input-device or visual-art review.
- Resource regressions cover NPC root/fill-light chunk visibility with unchanged
  collision, negative/positive lantern chunk boundaries, one disposal of the
  existing world-owned Goth hitbox, fresh-builder rejection and world disposal
  after its scene reference is cleared. Scoped world replacement releases old
  health-bar references. Remote avatars deduplicate owned geometry/material/
  texture disposal and keep shared body/gun resources. Actual Chrome WebGL lobby
  churn removed twelve guest instance buffers exactly once over three full
  join/leave cycles; shared flame geometry/material were disposed once only when
  the menu ended, together with its thirteenth (creator) instance buffer.
- Chat cancellation now reaches the knowledge fetch and worker. Tests hold and
  release fetch/import/model work to prove abandoned generations cannot clear or
  replace a new load. The real engine wrapper suppresses late progress and
  terminates a cancelled worker once. A local Chrome model stub confirmed zero
  loads after decline, consent approval or Discard, saved-consent reuse and one
  load after Apply. No external model files were downloaded by these checks.
- Two fresh local Chrome/SwiftShader profiles of the final preparation path
  measured Goth parsing at 13.1–16.5 ms and Mecha parsing at 19.3–21.0 ms; complete
  load/install took 38.6–42.9 ms and 96.6–105.7 ms respectively. Both actors were
  ready before reveal. First reveal draws ranged from 242 to 697 ms, and some
  offscreen preparation draws took several seconds in software WebGL. These are
  local CPU/software-rendering measurements, not native-GPU performance claims.
  No late actor load was observed and no speculative model cache was added.
- Cleanup removes duplicate send-time bookkeeping, impossible spread fallback,
  write-only peer regen/pilot HUD fields, the unused cockpit/navigation alias,
  unused label-placement state and repeated anomaly-center calculation. Shared
  schema types, test-visible geometry accessors, polar bounds and defensive
  generation guards remain. Only internal orchestration/network functions lost
  unnecessary export modifiers. Speedline images now wait for the active speed
  threshold; hook-badge visibility has one lookup helper.
- Actual computed-style checks preserve 60×34 color-input dimensions and 4 px
  padding, restore the selected weapon-tab hover color, use compact three-column
  settings where space permits and two columns in narrow containers, and retain
  readable 10 px touch help. Empty menu/CSS selectors and overridden properties
  were removed individually. The latest full `npm run check` passed both
  TypeScript projects and **415/415 tests** at that checkpoint. The final switch-clock regression and
  combined acceptance below supersede this intermediate count.

## Final local Mecha acceptance — 19 October

Chrome 155 exercised the real loaded actor through boarding, startup loading,
HUD fade, reveal, active piloting and all reverse shutdown phases. The boot
reveal included FPS, bars, crosshair, G-meter and Power Jump while clock, actor
time and player height stayed frozen. Death/respawn and scoped/mounted pause
restored or hid the complete HUD as appropriate, with no page errors.

A fully blocked preflight rejected Exit, displayed the warning and kept input
active. An obstruction added after successful preflight forced bounded startup
recovery; the pilot regained active control and the G-meter. Removing the
obstruction and retrying released safely and restored the on-foot HUD. The
fixture controlled input capture and phase stepping. Physical controls and
artistic timing remain the separate manual review in the Mecha guide.

## Final combined acceptance — 19 October 2026

The complete repair scope is implemented. `npm run check` passes both TypeScript
projects and **416/416 tests**. `npm run build` passes and regenerates the tracked
production output; its existing large-chunk warning remains. The full working-tree
inventory, tracked/new-file whitespace, changed document links and built HTML
asset references were reviewed. No application dependency was added.

A late native-browser regression found two related switch-clock gaps. The root
now publishes each switch phase immediately instead of waiting for the movement
throttle. A new withdrawal starts at zero, without consuming elapsed time from
before its intent. A real weapon/host-state regression reproduced rejection with
a 50 ms starting frame before repair and passes with starting frames of 1/240 second, 1/60 second
and 50 ms after repair. The host timing allowance was not widened.

Two real Chrome 155 browser clients then completed the actual application flow
with PeerJS BinaryPack and native encrypted RTC data channels. Both selected ICE
pairs were confirmed as UDP **relay/relay**, with `iceTransportPolicy: relay`.
The final run passed:

- Host registration, admission, world preparation and active movement streams.
- Guest Pistol damage to host, host AR damage to guest, attributed lethal Sniper
  damage to host, and host respawn into the next accepted life.
- AR guidance toward a moving host after visual peer culling, Shotgun damage,
  and actual Minigun trigger spin-up and damage.
- Guest departure removing its runtime and the host's remote avatar, followed by
  rejoin into the same active room after complete teardown.
- Abrupt host signalling loss clearing both scenes/renderers/input sessions,
  with exactly one renderer disposal on each side.
- A new host room with a fresh renderer and zero old connections, then clean
  cancellation. No page errors occurred in the final run.

The temporary network fixture ran the actual Worker and SQLite Durable Objects
locally, with dummy credentials and mocked Turnstile/Cloudflare ICE responses.
A loopback signalling broker and TURN relay carried real browser RTC traffic;
the relay fixture supplied missing channel-data forwarding and authenticated
ChannelBind replies in its temporary library adapter. Positions and input
capture were controlled for repeatability, while the real weapon, collision,
packet, health, death, reset and teardown code ran. No network payload was
fabricated as a substitute for a browser hit. This verifies local relay use,
not deployed Cloudflare/PeerJS service behavior or credential refresh across
network changes.

| Final acceptance area | Evidence |
| --- | --- |
| Offline reveal, initial-input freeze, pause and respawn | Actual Chrome application checks, input/loading/reset tests |
| Mecha phases, flashes, blocked/safe exit, destruction, remount and cancellation | Actual Chrome phase/recovery/flash checks and real-asset lifecycle/finishing tests |
| Movement limits, straight/guided fire and target lives | Host adversarial tests, 159 actual client pellet claims across 84 cases, native two-browser combat |
| Scope/pause, lava, retained match and weapon state | Actual Chrome checks plus hazard/reset integration regressions |
| Five-player admission, ordering, quotas and host diagnostics | Worker tests and real SQLite workerd probes, with native two-browser host/join/rejoin/loss |
| Resource lifetime and chat cancellation | Three five-avatar WebGL lobby churn cycles, world/goggles/peer ownership tests, delayed async/worker tests and settings browser checks |
| Cleanup and documentation | Full checks/build, computed CSS checks, source/interface review, document/asset links and final diff inventory |

Room participants must use the same client build because switching fields and
homing thresholds are required by the runtime parser. The host checks feasible
acquisition and flight; it deliberately does not enforce the visual lock-animation
duration. Movement and health retain the documented client-simulation trust model.

No deployment, commit, staging or pull request was performed. Real external
Cloudflare/PeerJS operation, physical input devices, native-GPU performance and
the separate visual-art checklist were not claimed as verified. Chat model-load
UI used a stub; cancellation was also tested against the real engine wrapper,
but these checks did not download or run the external model weights.

The two pre-existing historical audit-document deletions remain preserved. The
repair did not edit `docs/to_be_changed.md`; an independent edit appeared there
during execution (19 October, 13:04 local time) and was retained verbatim.
