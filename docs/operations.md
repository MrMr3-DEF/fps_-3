# Cloudflare multiplayer operations

## Deployment model

The Cloudflare Worker is both the static-site origin and the security control plane for multiplayer. It serves `dist/` through the `ASSETS` binding and exposes same-origin `/api` routes for Turnstile verification, room/session management, and short-lived Cloudflare TURN credentials.

Two SQLite-backed Durable Objects are bound in `wrangler.toml`:

| Binding | Class | Purpose |
| --- | --- | --- |
| `TURN_RATE_LIMITER` | `TurnRateLimiter` | Per-IP fixed-window rate-limit buckets |
| `ACTIVE_TURN_ROOM` | `ActiveTurnRoom` | One named object per room code, storing room and session capabilities |

The checked-in migration tag is `v1` and creates both classes. Do not edit an already deployed migration. If the production Worker has consumed `v1`, add a new unique tag for a later migration.

## Required Cloudflare services

1. A Cloudflare Realtime TURN key and an API token allowed to generate credentials for it.
2. A Turnstile widget configured for the exact public hostname.
3. A deployed Worker with the Durable Object bindings and static asset directory from `wrangler.toml`.

TURN and Turnstile are separate products. TURN relays WebRTC traffic when peers cannot connect directly. Turnstile verifies humans before the Worker creates a room or join session.

## Environment variables and secrets

The Worker enables multiplayer only when every required value is present and `DISABLE_TURN` is not `true`.

| Name | Visibility | Meaning |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | Public variable | Browser-facing key for the Turnstile widget |
| `TURNSTILE_HOSTNAME` | Public variable | Exact hostname expected in Turnstile's verification response |
| `TURNSTILE_SECRET_KEY` | Secret | Server-side Turnstile verification key |
| `TURN_KEY_ID` | Variable or secret | Identifier of the Cloudflare Realtime TURN key |
| `TURN_KEY_API_TOKEN` | Secret | Token used by the Worker to generate ICE servers |
| `DISABLE_TURN` | Optional variable | Set to the exact string `true` to disable multiplayer immediately |

`wrangler.toml` currently contains the production Turnstile site key and `fps.luigismansion.de` hostname. The TURN key ID may remain a Wrangler secret; Worker bindings expose variables and secrets through the same `env` interface, so the code does not require it to be public.

Set or rotate secrets without committing their values:

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_KEY_API_TOKEN
npx wrangler secret put TURNSTILE_SECRET_KEY
```

If the TURN key ID is intentionally non-secret, it can instead be placed under `[vars]`. Never place the TURN API token or Turnstile secret key there, in client code, in `index.html`, or in documentation.

For another deployment, update the public values in `wrangler.toml`:

```toml
[vars]
TURNSTILE_SITE_KEY = "your-turnstile-site-key"
TURNSTILE_HOSTNAME = "play.example.com"
```

The Turnstile widget must permit that hostname. The Worker compares Turnstile's returned `hostname` and `action` exactly; an otherwise successful token for another hostname or action is rejected.

## Deploying

Authenticate Wrangler, configure the required values, then run:

```bash
npm run deploy
```

The script type-checks the project, rebuilds `dist/`, and executes `wrangler deploy`. After deployment, verify:

- the main page and hashed assets load;
- `GET /api/security-config` returns `multiplayerEnabled: true`, the intended site key, and room-code length 8;
- Turnstile completes for both hosting and joining;
- a host receives a room and reaches the waiting state;
- a second browser joins, receives the world snapshot, and can enter play;
- gameplay works through a network environment that requires TURN;
- leaving closes or releases the associated server-side capability.

## Public API

All JSON responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. JSON request bodies are limited to 4 KiB while streaming, with a five-second body-read deadline. Oversized streams are cancelled before full buffering.

| Route | Method | Authorization | Result |
| --- | --- | --- | --- |
| `/api/security-config` | `GET` | None | Multiplayer availability, public site key, room-code length |
| `/api/rooms` | `POST` | Turnstile token with `create-room` action | Creates a room; returns host close and TURN-session capabilities |
| `/api/room-sessions` | `POST` | Turnstile token with `join-room` action | Reserves a room slot; returns a TURN-session capability |
| `/api/rooms/:room` | `PATCH` | Host close capability as bearer token | Extends the room lifetime |
| `/api/rooms/:room` | `DELETE` | Host close capability as bearer token | Closes the room and deletes all sessions |
| `/api/room-sessions/:room` | `DELETE` | Session capability as bearer token | Releases one session slot |
| `/api/room-admissions/:room` | `POST` | Host close capability and peer-bound admission ticket | Consumes ticket; returns reserved name and host proof |
| `/api/room-admissions/:room` | `DELETE` | Host close capability and peer ID | Releases a departed peer and its name |
| `/api/turn?room=…&session=…` | `GET` | Session capability in query string, bound to requesting IP | Returns sanitized short-lived ICE servers |

Room codes use eight symbols from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; ambiguous characters are excluded. Codes locate a room but are not authorization. The Worker creates independent 256-bit URL-safe capability tokens for closing a room and requesting TURN credentials.

## Host and join flows

### Host

1. The browser generates a cryptographically random room code.
2. A Turnstile widget issues a token for `create-room`.
3. The Worker validates the token, exact action, exact hostname, client IP, and room-creation rate limit.
4. The room Durable Object stores the room expiry, close capability, and host's five-minute renewable TURN session, fixed peer identity, and case-insensitive username reservation.
5. The Worker exchanges the host session for short-lived ICE servers.
6. The host registers the stable room-derived PeerJS ID and begins a two-minute heartbeat carrying the connected/pending peer roster.
7. The host generates the world seed and sends a snapshot to each opened client data channel.

### Join

1. The browser normalizes and validates the room code.
2. A Turnstile widget issues a token for `join-room`.
3. The Worker validates the token and atomically reserves a name and session if the room exists, has capacity, and has no case-insensitive match for that name. Requests include the username and client-generated peer ID.
4. The session is bound to the requesting IP and exchanged for short-lived ICE servers.
5. The client registers its bound ID with PeerJS and connects to the host's room-derived ID with a separate admission ticket in metadata.
6. The host validates that ticket through the Worker. Only then does it send the admission proof and world snapshot. The client compares that proof with the independently issued proof from registration.
7. The client waits for the authoritative world snapshot before enabling entry to the game.

The browser releases a join session on exit and the host closes the entire room. These are best-effort network calls; short expiry and Durable Object alarms are the fallback cleanup path.

## Lifetimes, capacity, and abuse controls

| Control | Current value |
| --- | --- |
| Room lifetime | 30 minutes from creation or latest heartbeat |
| Host heartbeat cadence | 2 minutes; renews admitted sessions and removes departed peers |
| Room session lifetime | 5 minutes, renewed for admitted peers by the host heartbeat |
| TURN credential TTL | 5 minutes |
| TURN credential claims per session | 2 per five-minute issuance window |
| Client/host ICE refresh cadence | 4 minutes; updates future and current peer connections |
| Room capacity | 5 sessions including the host |
| Room creations per IP | 3 per 30 minutes |
| Join attempts per IP | 6 per 10 minutes |
| TURN requests per IP | 30 per 10 minutes (allows a full room behind one IP to refresh) |
| Turnstile verification timeout | 5 seconds |
| Signalling and data-channel admission timeout | 20 seconds each |
| Browser setup request timeout | 12 seconds |
| TURN upstream request timeout | 10 seconds |
| Client world-snapshot timeout | 10 seconds |

Expired pending sessions are pruned whenever their room Durable Object is read. Admitted name reservations survive a temporary relay-lease expiry; credential claims still require a live lease, and departure/room expiry removes the reservation. The room alarm deletes all storage at room expiry. Rate-limit Durable Objects delete their buckets when each window ends. Infrastructure failure in verification, rate limiting, room storage, or credential generation returns an error rather than bypassing protection.

Only host-confirmed admitted peers receive session renewal. The host heartbeat supplies its active roster; dropped peers lose their names and session access. Pending joins expire without renewal. ICE credentials are refreshed every four minutes using the still-live, IP-bound session, under both session and per-IP quotas. Changing IP or losing the session requires a fresh verified join. Existing connections can remain alive when a refresh fails, but new relay-dependent connections may require leaving and rejoining. A live relay-network smoke test is still required after deployment.

## Security properties

- Secure multiplayer has no public STUN/TURN fallback.
- TURN API credentials and Turnstile secrets remain Worker-side.
- TURN responses are structurally validated and reduced to serializable ICE fields before reaching the browser.
- Room and session capabilities are high-entropy, format-checked, bound to server-side expiry, and never derived from the room code.
- TURN claims must come from the IP that created the room session.
- Turnstile tokens must match the intended action and exact hostname.
- The Worker applies per-IP creation, join, and credential rate limits.
- Admission tickets are separate from TURN and close capabilities, single-use, and bound to a reserved peer ID. A host must demonstrate possession of its close capability to obtain the client-specific admission proof.
- Names are case-insensitively unique per room and cannot be changed by gameplay packets.
- Room reads/checks/writes and alarms are serialized after bounded body parsing.
- The host parses all WebRTC packets and applies additional gameplay authorization described in [Architecture](architecture.md#packet-authority).

The room code still appears in the PeerJS identifier and is shared with players. Treat it as discoverability data, not a secret or proof of permission.

## Troubleshooting

### “Secure multiplayer is unavailable on this deployment”

Call `/api/security-config`. A `false` result means at least one required value is absent, `DISABLE_TURN=true`, or the request reached a server other than the configured Worker. Confirm all five required environment values and the deployed Worker version.

### “Human verification failed”

Check all of the following:

- the Turnstile widget allows the browser's exact hostname;
- `TURNSTILE_HOSTNAME` has no scheme, path, port, or typo and matches the verified response exactly;
- the browser and Worker use the same widget's site and secret keys;
- the widget action is `create-room` for hosting or `join-room` for joining;
- the token is submitted promptly and only once;
- the Worker can reach Cloudflare's Siteverify endpoint within five seconds.

The Worker deliberately reduces every Siteverify mismatch or outage to the same user-facing failure. Use Worker logs and the Turnstile dashboard to distinguish action, hostname, token, and service errors.

### Room exists in the UI but cannot be joined

The browser displays the code before secure registration completes. The Copy button remains disabled until registration succeeds. If the host's PeerJS registration later fails, the Worker room is closed during cleanup. Verify that the host reached “Waiting for players,” that the room has fewer than five sessions, the requested name is unused, and that it has not expired.

### TURN credentials fail

Confirm the TURN key ID belongs to the account represented by the API token, the token can generate credentials, and the Cloudflare TURN endpoint returns an `iceServers` array. Inspect Worker logs for the upstream response status or invalid-data message. Each session has two issuance attempts per five-minute window; repeated diagnostics may require a fresh verified room session.

### Peers authorize but the game never opens

Authorization and WebRTC establishment are separate. Check access to `0.peerjs.com`, PeerJS errors, browser WebRTC logs, ICE candidate gathering, and whether the host remains online. The client drops an unopened data channel after 20 seconds and drops a connection that never supplies a world snapshot after another 10 seconds.

## Monitoring and emergency response

Monitor Cloudflare TURN usage, credential-generation failures, Turnstile analytics, Worker exceptions, Durable Object errors, and rates of HTTP 403, 409, 429, and 503 responses. A sharp rise in room creation or credential issuance can indicate abuse even when requests remain within individual IP limits.

To stop new secure multiplayer sessions without taking down the static game, set `DISABLE_TURN=true` and redeploy. Existing peer connections may remain alive until participants disconnect; the switch prevents the Worker from reporting multiplayer as enabled and blocks new room or TURN issuance.

Official references:

- [Cloudflare Realtime TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)

## Protocol rollout

Deploy the Worker and rebuilt client together. Older room records lack admission identities and fail closed on access; participants must create or join a fresh lobby after this protocol update. No new Durable Object class or migration is required.
