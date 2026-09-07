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
| `town.test.ts` | 1,000 seeded layouts, street/door clearance, real world rebuilds/disposal, hazard exclusion, collision, ceilings, rooftop edges, projectile/grapple geometry, culling and enemy placement |
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

## Town visual checks

With `npm run dev` running, open `/tests/town-preview.html` to inspect the real world generator with a chosen seed. The Aerial, Street, Doorway, Interior, Rooftop, Church, Church interior, Rampart, Stairs and Lookout buttons expose repeatable camera views and renderer draw/triangle counts. This development-only HTML fixture is outside the production Vite entry and is not included in `dist/`. Test actual match startup and HUD separately in the main game and production preview.

Central-town validation (September 7, 2026): `npm run check` passes all 64 tests, including 1,000 layout seeds; `npm run build` succeeds. Browser visual checks cover aerial, doorway and interior views on seeds 0 and 42. The production bundle was smoke-tested in Safari for offline startup, pointer lock, movement, jumping and grapple input. The embedded Chromium browser renders the visual fixture but cannot acquire pointer lock in this environment. Multiplayer admission/authority remains covered by simulated integration tests; a live relay-network session was not exercised for this change.

The taller-wall/church follow-up adds regression coverage for exactly one church per seed, the configured church tower height, all four covered gate lintels, and the church ceiling and grapple surfaces. The 1,000-seed sweep includes church plot variation and unobstructed approaches.

Rampart/roof polish validation: the suite now covers walking the full ascent, a complete rampart loop through all four open lookouts, descent without jumping, and roof/shell separation. The viewer also offers a Roof motion button to orbit a house at roof height while checking for flicker. The church tower is now 80% of wall height.

Ground-paving regression checks cover non-overlapping tiles and exact paved area across 100 seeds, the grass cutout, floor grappling, distant ground visibility, and coplanar rampart/landing/bridge joins. The Ground motion viewer button checks streets and footpaths at changing camera angles and heights.

Straight-ascent/well validation adds actual walking-input tests at 20–240 FPS plus variable frame times, near-limit step heights, gate clearance, deterministic well geometry, and safe spawn/detour checks. The Well viewer button shows the fixed central prop.

Town spawn regression checks cover distinct houses and doorway orientation across 1,000 seeds, walking out after initial spawn and repeated church respawns, host-assigned house slots, departure/replacement, and rejection of invalid or duplicate snapshots. The development town viewer includes House spawn and Death respawn views using the real spawn placement helper.

The town viewer has Goth house and Goth interior views. Regression checks verify one goth house across 1,000 seeds, exclusion from player house assignments, clear interiors, roof collision and disposal of merged ornament geometry.

## Goth girlfriend and local chat

The supplied rigged GLB stands inside the guaranteed goth house. In singleplayer or as the multiplayer lobby creator/host, approach within four units, look at her, and press **F**. Joined players can see her standing in the house, but receive no interaction prompt and cannot trigger the wave, camera move, notice or chat. Losing host eligibility closes an existing conversation. She waves, pointer lock releases, and a typed conversation panel opens. Over 0.55 seconds the actual player camera eases to a centered spot 3.2 units in front of her and turns toward her face. Conversation owns the pose until Esc; closing mid-move cancels without snapping. Third-person players temporarily get the same unobstructed conversation view. Her supplied model is uniformly fitted to 3.564 units, 8% taller than the visible 3.3-unit player mesh, with its soles kept on the floor. An information banner requires explicit approval before the first model load. After approval, chat loads SmolLM2-360M-Instruct-q0f16-MLC through WebLLM in a browser worker. Subsequent answers stream into the panel, with an Explain, Shrug or Agree gesture queued when generated text begins. The wave completes before a queued talking gesture starts.

Character files live in `public/npc/goth/`. Start with [the editing guide](../public/npc/goth/README.md). Identity and behavior are always included, optional example replies can establish tone, and lexical RAG retrieves relevant Markdown passages. The current unnamed character is already the player's adult girlfriend and has a dry, goth, commanding and dominant personality. Model responses remain probabilistic; a 360M model can miss instructions or ignore relevant facts even when retrieval succeeds.

Save character-file edits and refresh the browser to try them in a fresh conversation. Chat hides the game HUD, uses a bottom input bar with Enter to send and Esc to return, and routes keyboard and wheel input to the conversation. The first-use notice links to WebLLM and the existing legal pages; approval is remembered in versioned browser storage. Initial downloads need network access; inference is local. WebGPU requires HTTPS or localhost, and f16 requires shader-f16. Loading errors, cancellation and timeouts are shown in the chat. No dialogue content is sent to an AI service. Conversations and gestures are local to each player's browser, and no game actions are executed from model text.

`/tests/goth-preview.html` inspects individual rig poses; `/tests/goth-chat-preview.html` tests the actual character, chat UI, model and retriever without pointer lock. Both fixtures are excluded from the production entry. The production build includes the character's public files and the lazy-loaded WebLLM engine/worker assets. Update the generated `dist/` output with source changes.

Validation for local chat: all 108 tests pass, including prompt size/Unicode handling, retrieval of actual lore, role-pair history, configuration validation, and wave-to-talk sequencing. Real WebGPU browser tests exercise model downloads, cached startup, streamed responses and character prompting. Safari gameplay verifies F-key opening, the wave, pointer-lock release/resume, zero movement/fire input while chatting, and cancelling/reopening a model load. On this Safari/GPU combination model initialization failed; the UI supports retry and reports a browser/GPU compatibility error. Successful inference was verified in the embedded Chromium preview. Model quality remains inconsistent: the tiny model sometimes answers correctly and sometimes drifts or repeats despite correct retrieval.

The compiled production worker was also served with `vite preview`, loaded real model weights, and generated a correct minimal factual reply. Cancellation of an active generated reply and reopening into a fresh request were verified without browser console errors.

Camera transition checks cover 30/60/144 Hz, cancellation/reopening, the actual player mesh height, and collision-free centered destinations across 1,000 town seeds. The direct chat fixture starts off-center to make the camera move easy to inspect.

Chat consumes Escape keydown and repeats, then closes on keyup so mouse capture is not reacquired while the browser is still handling its unlock key. Normal chat exit does not open the pause panel. Native Chrome and Safari checks confirmed active pointer lock after chat exit; a separate Escape press still pauses normal gameplay. Regression tests cover held keys, IME cancellation and closing during a pending Escape press.

The idle pose rolls both forearms inward so palms face the thighs. This rotation blends out only for the gesturing arm and returns smoothly afterward; palm orientation is checked against the supplied rig at three world orientations.

Power jump starts disabled on every house spawn and church respawn, including multiplayer placement. The first horizontal crossing beyond the castle walls (`TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2`) enables it once per life. Returning inside does not disable it, and later crossings do not override Ctrl or the HUD toggle. The activation does not change a normal jump already in progress.
