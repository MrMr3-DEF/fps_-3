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

- Choose different colors on each player’s main-menu Character scan. Use one preset and one custom color, then host a room and join two distinct clients. Compare the seed, roster and suit colors.
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
- Spend rounds on each client, then reload with E. Join during a reload to see
  its current progress. Switching or grappling during reload keeps the old count.
  Hold Reload while pulling, release the hook, then press Reload again. The launcher stays in hand until the fresh press stows it and starts the reload.
- Hold rifle fire and draw the grapple. The tether launches after the hand reaches
  it. Release the cable and verify the launcher remains visible on both clients.
  Refire it, then release and press the rifle trigger to stow it and fire after
  regripping. Switch between pistol and shotgun while pulling and check that
  the tether and grip survive. Join with the launcher idle in hand and check
  that the observer sees the same pose.
- Compare walking, powered takeoff, hover exhaust, grappling, inspection and
  cockpit poses on the owner and an observer.
- Kill and respawn both players; verify one death per life and correct kill credit.
- Check each player’s selected color on the visor, chest glow and scoreboard
  on both clients while stationary, after a hit, after respawn and from a late joiner.
  Pause shows the equipped model with the same suit color.
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
