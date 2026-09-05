# Deployed multiplayer smoke test — 5 September 2026

Tested https://fps.luigismansion.de/ against the deployed Worker, with real Turnstile and PeerJS connections. The deployed client bundle was `index-VhCzF5Kt.js`.

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
