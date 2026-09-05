# FPS Arena documentation

This directory is the starting point for humans and AI agents working on FPS Arena. The project is a browser-based Three.js arena shooter with offline play and small peer-to-peer multiplayer rooms. The arena, characters, weapons, effects, UI, and textures are generated in code; there is no separate asset pipeline.

## Documentation map

Each document owns a distinct subject so information has one canonical location:

- [Architecture](architecture.md) explains the runtime, module boundaries, frame loop, world generation, gameplay, and multiplayer data flow.
- [Development](development.md) covers prerequisites, local workflows, scripts, tests, CI, generated output, and change validation.
- [Cloudflare operations](operations.md) covers deployment, bindings, TURN and Turnstile configuration, API routes, quotas, security properties, and troubleshooting.
- [Audit resolution](audit-resolution.md) records fixes and validation for the September audit.
- [Change backlog](to_be_changed.md) is the short, living list of known bugs and requested features. It is not a design document.

## Project at a glance

| Area | Implementation |
| --- | --- |
| Client | TypeScript, Three.js, PeerJS, DOM/CSS in `index.html` |
| Build | Vite, with output committed under `dist/` |
| Backend | Cloudflare Worker in `src/worker.ts` |
| Stateful backend | Two SQLite-backed Durable Objects |
| Multiplayer transport | PeerJS signalling plus WebRTC data channels using short-lived Cloudflare STUN/TURN credentials |
| Human verification | Cloudflare Turnstile for room creation and joining |
| Tests | Node's built-in test runner against TypeScript source |
| Production host | `fps.luigismansion.de` in the checked-in Worker configuration |

The browser entry point is `src/main.ts`; the Worker entry point is `src/worker.ts`. `src/config.ts` is the canonical location for gameplay constants, limits, weapon statistics, and world-density settings.

## Read before changing code

- `state.ts` is the mutable runtime state shared by client systems. Match and player reset helpers must be used when starting, leaving, dying, or respawning.
- Imports between TypeScript source files deliberately use `.js` suffixes. Vite and the TypeScript `bundler` resolver map them to the `.ts` sources; do not mechanically change them to `.ts`.
- Client and Worker code use separate TypeScript configurations because the Worker needs Cloudflare types and the browser client must not inherit them.
- `dist/` is version-controlled. A source change that affects the bundle is incomplete until `npm run build` has refreshed it.
- Multiplayer fails closed when its security configuration is absent. Do not add public STUN/TURN fallbacks or expose TURN secrets to the browser.
- The host validates and relays gameplay packets in a star topology. New packet types require both runtime parsing and an explicit authority decision.
- `damage.ts` and `weaponNetworkPort.ts` are intentional dependency-injection seams that prevent import cycles.
- Render distance controls visibility only. Collision, grappling, projectiles, peers, particles, the floor, and fog are independent of it.
- Tests are source files and belong in version control. Generated coverage, logs, local environment files, Wrangler state, and dependencies do not.

For the exact workflow and validation commands, continue with [Development](development.md). For a code change, use [Architecture](architecture.md) to identify the owning module before editing.
