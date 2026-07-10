# Secure multiplayer deployment

Multiplayer now fails closed. There is no public STUN/TURN or Open Relay
fallback: a browser receives Cloudflare TURN credentials only after it has a
verified, short-lived room-session capability.

## Configure Cloudflare

1. Create a Cloudflare Calls TURN key. Keep its token ID (`TURN_KEY_ID`) and
   create an API token that is allowed to generate credentials for that key.
   The browser must never receive either server-side credential.
2. Create a Turnstile widget for the exact public hostname that serves this
   Worker (for example, `play.example.com`). The Worker checks both the
   Turnstile action and this hostname on every verification.
3. Add the public configuration to `wrangler.toml` or the deployed Worker
   environment. Do not commit real values to a public repository unless that is
   intentional:

   ```toml
   [vars]
   TURN_KEY_ID = "your-turn-key-id"
   TURNSTILE_SITE_KEY = "your-turnstile-site-key"
   TURNSTILE_HOSTNAME = "play.example.com"
   ```

4. Store the long-lived credentials as Wrangler secrets:

   ```sh
   npx wrangler secret put TURN_KEY_API_TOKEN
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

5. Run `npm run build`, then deploy normally with `npx wrangler deploy`.
   The `wrangler.toml` Durable Object bindings and `v1` SQLite migration must
   be deployed with this Worker. If this Worker already has a deployed
   migration tagged `v1`, choose a unique next migration tag instead of
   reusing it.

The implementation follows Cloudflare's guidance to keep TURN keys only on a
backend and issue expiring credentials, and to validate each Turnstile token
server-side (including action and hostname):

- [Cloudflare Calls TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)

## Abuse controls

- Room codes contain eight unambiguous characters; they are not themselves
  TURN authorization.
- Hosts complete Turnstile action `create-room`; joining players complete the
  separate `join-room` action.
- Each active room has at most five server-stored TURN sessions, including the
  host. A session is bound to the originating Cloudflare client IP, lasts five
  minutes, and can mint at most two five-minute credential sets.
- Room create, room join, and credential endpoints are independently rate
  limited using Durable Objects. Session, room, and capability expiry bounds
  cleanup even when a browser disappears.
- Hosts refresh an active room every ten minutes and close it best-effort on
  leave. Without a heartbeat the room expires after 30 minutes.

If any required configuration is missing, the menu shows that secure
multiplayer is unavailable. `DISABLE_TURN=true` intentionally has the same
fail-closed behavior; it does not enable a fallback relay.

## Operations

Watch TURN credential generation and Turnstile validation metrics after
deployment. A rise in rejected verification, rate-limit, room-full, or
credential-exhausted responses is a useful early signal of attempted abuse.
For a genuine long-running game reconnect, the player must complete the join
verification again after the short session expires; this is intentional so a
leaked invite cannot mint relays indefinitely.
