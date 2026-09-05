# Development workflow

## Prerequisites

- Node.js 22.15 or newer, matching the `engines` requirement in `package.json`.
- npm, using the committed `package-lock.json`.
- A WebGL-capable browser.
- Wrangler authentication and Cloudflare credentials only when exercising or deploying secure multiplayer.

Install dependencies with:

```bash
npm ci
```

Use `npm install` instead when intentionally changing dependencies and the lockfile.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite with hot reload. `/api` requests are proxied to `127.0.0.1:8787`. |
| `npm run worker:dev` | Start the Cloudflare Worker locally through Wrangler. |
| `npm run typecheck:client` | Check browser source with `tsconfig.json`. |
| `npm run typecheck:worker` | Check the Worker entry and its dependencies with `tsconfig.worker.json`. |
| `npm run typecheck` | Run both TypeScript checks. |
| `npm test` | Run all `tests/*.test.ts` files with Node's built-in test runner and type stripping. The test-only resolution hook maps source `.js` imports to `.ts` and substitutes deterministic PeerJS/physics-query doubles. |
| `npm run check` | Run type checking and unit tests. |
| `npm run build` | Run type checking, then generate the production bundle in `dist/`. |
| `npm run preview` | Serve the existing `dist/` bundle locally. It does not rebuild first. |
| `npm run deploy` | Build and deploy the Worker and static assets with Wrangler. |

Stop any development or preview server with `Ctrl+C` in the terminal that owns it.

## Local run modes

### Offline gameplay and client UI

Run `npm run dev` and open the Vite URL. Offline singleplayer, rendering, settings, input, and most menu work do not require the Worker.

The multiplayer menu will report that secure multiplayer is unavailable if nothing is listening on port 8787 or the Worker is missing its required configuration. This is intentional fail-closed behavior.

### Full client and Worker

Use two terminals:

```bash
# terminal 1
npm run worker:dev

# terminal 2
npm run dev
```

Vite serves source changes and forwards `/api` to Wrangler. Provide local Worker values through Wrangler's supported local environment mechanism and never commit them. Turnstile also has to accept the hostname used by the browser; a token issued for `localhost` is rejected when the Worker expects the production hostname.

The complete variable list and service setup are in [Cloudflare operations](operations.md).

### Production bundle

Run `npm run build`, then `npm run preview`. Preview is useful for checking chunk loading and the generated HTML, but Worker API routes still need a compatible backend if multiplayer is tested through the preview origin.

## Source and build conventions

The project uses strict TypeScript, ES modules, and browser-oriented bundler resolution. Source imports include `.js` extensions even though the files on disk are `.ts`; preserve that convention.

`tsconfig.json` checks the browser graph and excludes `src/worker.ts`. `tsconfig.worker.json` checks the Worker graph with Cloudflare runtime types. Code shared by both sides, such as `config.ts` and `turnRoom.ts`, must remain valid in each graph that imports it.

Vite writes to `dist/`, empties the directory first, and splits Three.js into its own chunk. `dist/` is committed because deployment and CI treat it as a checked-in artifact. Do not edit hashed bundle files manually. Change source, run the build, and commit the resulting additions/deletions under `dist/assets/` together with `dist/index.html`.

Local-only material is ignored by `.gitignore`: dependencies, `.wrangler/`, `.env*`, logs, editor/OS clutter, coverage, screenshots, and analysis artifacts. Tests are not temporary output and must remain tracked.

## Tests

The test suite focuses on deterministic logic and security boundaries that can run without WebGL or a browser:

| Test file | Coverage |
| --- | --- |
| `config.test.ts` | Valid weapon statistics and projectile-budget assumptions |
| `gameplayMath.test.ts` | Frame-delta clamping and swept sphere/AABB collision |
| `mouseButtons.test.ts` | Simultaneous pointer buttons and safe bitmask decoding |
| `multiplayerVisuals.test.ts` | Overlapping remote damage pulses and material restoration |
| `networkTypes.test.ts` | Accepted packets and rejection of malformed or excessive network data |
| `spatialHash.test.ts` | Radius queries, reusable outputs, clearing, segment traversal, deduplication, negative cells, grid corners |
| `turnRoom.test.ts` | Room capacity, capability checks, credential quotas, and cleanup |

Additional regression suites cover bounded streaming JSON, deterministic shot authority and life transitions, movement/collision, Worker-backed admission, case-insensitive username reservations, concurrent room mutations, departure, waiting-room synchronization, and stale callbacks. PeerJS signalling and Cloudflare upstream services are simulated in these integration tests; they do not replace a real relay-network smoke test.

Keep testable logic independent of the DOM, Three.js renderer, PeerJS implementation, and Cloudflare bindings where practical. The `TurnRoomStateMachine` storage interface is an example: tests use an in-memory implementation while production supplies Durable Object storage.

Add or update tests for changes to packet parsing, authorization rules, geometry math, state-machine quotas, input decoding, shared-material lifecycle, and configuration invariants. Browser-only changes still require manual validation.

## CI contract

GitHub Actions runs on pushes and pull requests using Node 22. It performs:

1. `npm ci`
2. `npm run check`
3. `npm run build`
4. `git diff --exit-code -- dist`

The last step fails when committed generated assets do not match the source. A local change is ready for CI when `npm run check` and `npm run build` both pass and `git status` shows only intended source, documentation, and regenerated bundle changes.

## Validation by change type

| Change | Minimum validation |
| --- | --- |
| Pure helper, parser, quota, or configuration | Relevant unit test plus `npm run check` |
| Rendering, HUD, input, settings, weapons, physics | `npm run check`, production build, and manual browser play |
| Multiplayer packet behavior | Unit tests, two browser clients, host/client join, hit/death/respawn, disconnect and rejoin |
| Worker API or Cloudflare configuration | Worker typecheck, local or staging API exercise, full host/join flow, deployment logs |
| Dependency or build configuration | Clean `npm ci`, check, build, preview, and inspection of generated chunks |

For manual multiplayer testing, use separate browser profiles or a private window when useful; each peer needs its own page and Turnstile completion. Exercise both direct-looking connections and environments likely to require TURN, because a successful same-network test does not prove relay credentials work.

## Debugging guide

- If the game UI loads but multiplayer says it is unavailable, inspect `GET /api/security-config` and the Worker environment.
- If Vite returns a proxy error, verify Wrangler is running on port 8787.
- If a room is authorized but peers never connect, inspect PeerJS errors, WebRTC ICE candidate state, TURN issuance, and the 20-second data-channel timeout.
- If worlds differ, verify the client received and applied `world_snapshot` before play and that all procedural randomness uses the seeded world generator.
- If shots pass through fast targets or pillars, test the segment helpers rather than replacing swept collision with endpoint distance checks.
- If visuals change permanently after a temporary effect, inspect material sharing, cloned materials, timers, and disposal. Shared materials must not be mutated without restoration or per-object isolation.
- If a bug appears only after leaving and starting again, inspect reset functions, interval/timeout cancellation, event listeners, object pools, and Three.js disposal.

Use the ownership table and data-flow notes in [Architecture](architecture.md) before moving responsibilities between files.
