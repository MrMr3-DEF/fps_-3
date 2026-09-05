# Follow-up validation

The September audit fixes are implemented; see [audit resolution](audit-resolution.md).

- Deploy the local pointer-lock menu correction and verify rejected requests leave Start Game / Join Game available.
- Exercise a TURN-dependent network, credential refresh and recovery after a network change.
- Verify third-client departure/avatar cleanup and authoritative target/score updates while a client waits to enter play.
- Retest abrupt host tab closure and transport-loss timeout. Explicit host Leave Lobby passed, but embedded-tab closure was inconclusive.

Real Turnstile, a host plus two client admissions, a rejoin after ten minutes, foreground pointer-lock combat in both directions, respawns and explicit host departure passed the [deployed smoke test](multiplayer-live-test.md).

No additional feature requests are currently recorded.
