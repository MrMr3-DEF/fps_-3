# Multiplayer checks

Use the current client and matching Worker build. Start from
[local setup](development.md#full-client-and-worker) or the configured deployment
in [Cloudflare operations](operations.md). Use separate browser profiles so each
client has its own session and Turnstile completion.

Local doubles and loopback relays exercise application behavior without proving
external Turnstile, signalling or Cloudflare TURN availability. For relay checks,
confirm the selected ICE candidate pair is actually relayed. Report the tested
environment and limitations in the task response, not in this guide.

## Admission and room lifecycle

- Host a room; join two distinct clients and compare seed, roster and suit colors.
- Reject a case-insensitive duplicate username. Leave and rejoin with that name.
- Check all five room slots, full-room rejection and replacement after departure.
- Join after the initial session lease and exercise credential renewal in a
  relay-required environment.
- Test denied input capture: lobby controls remain usable until activation succeeds.
- Exercise explicit leave and abrupt host loss; clients leave the match, clear
  avatars and scores, and can create or join another room.

## Gameplay and authority

- Move, grapple, fire and switch weapons on host and guest; compare accepted hits,
  obstruction and cooldown behavior.
- Kill and respawn both players; verify one death per life and correct kill credit.
- Keep a client waiting in the lobby while the host plays; check target and score
  synchronization before that client enters.
- Lower render distance; physical cover and target authority remain unchanged.
- Check departure/avatar cleanup, rejoin, late snapshots and a fresh match reset.

## Mecha and shared ending

Use the [Mecha multiplayer checklist](forgotten-mecha.md#multiplayer-acceptance)
for shared actor ownership, exclusive boarding, pilot attacks and late joins.

For wall arrival, compare the ending on an active viewer, paused viewer, dead
viewer and late joiner. Preparation stays behind black; all use the same host
clock and seeded destruction. Departure during preparation cannot attach a scene
to a replacement match. Joining after completion shows the final shot without
replaying attacks or damage.

## Device and network scope

Exercise changing networks, credential refresh and a background host when those
behaviors are affected. Sequential foreground tabs do not establish sustained
concurrent input or latency behavior. Physical touch devices are needed for
multi-finger input, orientation/fullscreen support and safe-area checks; desktop
emulation does not establish them.
