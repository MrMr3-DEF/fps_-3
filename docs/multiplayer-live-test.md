# Deployed multiplayer smoke test — 5 September 2026

Tested https://fps.luigi.host/ against the deployed Worker, with real Turnstile and PeerJS connections. The deployed client bundle was `index-VhCzF5Kt.js`.

## Passed

- Host registration and automatic Turnstile verification; two additional browser clients joined and synchronized with the host.
- Host `AuditHost` rejected joining username `audithost` with the duplicate-name message. A distinct username joined successfully.
- Leaving and rejoining released the client username: `AuditPilot` could return as `auditpilot`.
- A room registered at 11:27:49 UTC accepted another synchronized rejoin at 11:38:36 UTC, beyond the initial five-minute lease.
- Two foreground native Chrome tabs entered multiplayer with working pointer lock. Jumping and automatic-rifle firing worked.
- Client killed host: client gained one kill and host showed the death screen. Host respawned with one death.
- Host killed client: host gained one kill and client showed the death screen. Client respawned with one kill and one death.
- Host explicitly left the lobby: both players returned to the main menu and the client match stats reset.

## Finding and local correction

Embedded Chromium and the automated Chrome tab rejected pointer lock. Host Start Game and client Join Game hid the menu before the request succeeded, leaving an unusable arena view. Native foreground Chrome accepted pointer lock and completed the gameplay checks above.

The local correction removes premature menu hiding from both multiplayer start handlers. The existing successful `lock` event owns menu hiding, so rejection leaves the lobby controls available. Client and Worker typechecks and the production build validate this correction; it has not been deployed or retested live.

## Limits and remaining checks

- Connections were not forced through TURN. Successful same-network play and a late rejoin do not prove relay credential refresh or recovery after a network change.
- Third-client departure/avatar cleanup and target/score updates while waiting to enter play were not exercised in a live match.
- Explicit host Leave Lobby passed. Abrupt tab-close cleanup was inconclusive: an embedded waiting client still showed Ready to join after its host tab closed, before the remaining test tabs were closed. Retest transport loss and its eventual timeout separately.
- Sequential foreground tabs were used for combat; this is not a latency, sustained concurrent-input, or background-host performance test.

All test-created browser tabs were closed after testing. No deployment was performed during this test.

## Local audit-repair acceptance — 19 October 2026

This is a new local result; it does not refresh the deployed September result.
Two native Chrome 155 browser clients used the actual application, PeerJS
BinaryPack and encrypted RTC data channels through a temporary loopback TURN
relay. Both selected candidate pairs were confirmed relay/relay over UDP.
The actual Worker and SQLite Durable Objects ran locally with dummy credentials
and mocked Turnstile/Cloudflare ICE responses; signalling used a local broker.

The final run passed host/join, movement, Pistol/AR damage in both directions,
attributed Sniper death and respawn, moving-peer homing under visual culling,
Shotgun and Minigun damage, departure/avatar cleanup, rejoin, abrupt host
signalling loss, exactly one renderer disposal per browser, and fresh room
creation/cancellation. It reported no page errors. Input capture and positioning
were controlled; the real combat, packet authorization and lifecycle code ran.

Switch phases publish immediately and start their local clocks after intent,
so a delayed movement update or preceding long frame does not shorten a phase
relative to the host. Both TypeScript projects and 416 tests pass; the production
build is regenerated. Clients in one room must use the same build.

No deployment occurred. External service behavior, relay credential refresh,
physical devices and changing-network recovery remain separate checks. See
[audit-repair-progress.md](audit-repair-progress.md) for fixture details, bounded
homing compensation and the complete acceptance record.

## Multiplayer mecha local acceptance — 20 October 2026

Three native Chrome 155 pages exercised the actual application over encrypted
PeerJS data channels through the loopback TURN fixture. The final connected host
and late-joining client both reported relay/relay selected candidate pairs; the
relay forwarded 30,975 channel-data datagrams during the run. Local Worker and
SQLite Durable Objects used dummy credentials with mocked external verification
and ICE responses. No production service configuration or deployment changed.

The final run passed shared actor preparation/pose/health, external Sniper shield
absorption, five actual inside-shield Sniper hits, complete enemy defeat, actual
grapple boarding by a guest, and independent host controls. A guest-piloted rocket
killed the host and credited the guest; simulation continued while the host was
dead. A third client joined during piloting and recovered the occupied cockpit
without gaining local ownership. Voluntary shutdown released the living pilot,
remounting worked, pilot departure restored a mountable wreck, and lethal piloted
destruction released the surviving replacement pilot into ordinary play. The
host terminal event reached the dead host and third client, and host departure
disposed both remaining scenes/renderers. The final run recorded no page errors.

Input capture, travel and encounter phases were controlled by the fixture. The
weapon hits, cockpit grapple, rocket damage, attribution, serialization, host
commands and teardown used production code. Final destruction and terminal
broadcast were triggered directly to review their lifecycle; exact wall-punch
completion and enemy multi-player contacts are covered separately by real-asset
Node tests. This is local runtime evidence, not external Cloudflare/PeerJS,
credential-refresh, changing-network or physical-control verification.

The run exposed a synchronous shutdown-input revocation race; the repair and its
regression were included in the successful replay. A subsequent inspection added
replication of the blocked-exit camera recovery flag, covered by a focused owning
client/observer regression. Final current-source validation passes both
TypeScript projects and all 450 tests, and the production build is regenerated.
Production asset references, changed documentation links and whitespace pass;
the protected follow-up list remains unchanged. All fixture browser pages and
local signalling, Worker and TURN services were closed afterward.
