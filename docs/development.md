# Development workflow

## Working on a change

1. Inspect `git status` and preserve unrelated changes.
2. Use the [documentation index](README.md) and
   [module ownership table](architecture.md#module-ownership) to find the system.
   Read its feature guide and inspect current code before editing.
3. Keep success, cancellation, reset and disposal paths aligned. Update the
   owning guide with concise current behavior; report verification results in
   the task response rather than adding a log to the docs.
4. Follow [validation by change type](#validation-by-change-type). Include
   regenerated `dist/` for production changes. Modify `AGENTS.md` only when the
   user explicitly requests it.

## Prerequisites and setup

- Node.js 22.15 or newer, npm and the committed `package-lock.json`.
- Git LFS for Blender binaries, model assets and generated chat bundles.
- A WebGL-capable browser; local chat also needs WebGPU and shader-f16.
- Cloudflare credentials only for secure multiplayer or deployment.

Install Git LFS before cloning:

```bash
brew install git-lfs
git lfs install
git clone https://github.com/MrMr3-DEF/fps_-3.git
cd fps_-3
git lfs pull
npm ci
```

For an existing checkout, use `git lfs install --local` and `git lfs pull`.
Development, tests and builds need real assets, not LFS pointer files. External
build/deployment checkouts must also download LFS contents.

`.gitattributes` tracks Blender `.blend`, `.glb`, `.png`, `.jpg` and `.mp4` files,
plus generated GLBs and Goth engine/worker bundles under `dist/assets/`.
Scripts, JSON, Markdown and character knowledge stay in regular Git. Chat model
weights download from external hosts. Commit assets normally; the LFS pre-push
hook uploads their contents. Storage and bandwidth use the repository owner's
[GitHub LFS allowances](https://docs.github.com/en/billing/concepts/product-billing/git-lfs).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite with hot reload; proxies `/api` to `127.0.0.1:8787` |
| `npm run worker:dev` | Local Cloudflare Worker through Wrangler |
| `npm run typecheck:client` | Browser graph with `tsconfig.json` |
| `npm run typecheck:worker` | Worker graph with `tsconfig.worker.json` |
| `npm run typecheck` | Both TypeScript checks |
| `npm test` | All `tests/*.test.ts` with Node's test runner and type stripping |
| `npm run check` | Type checking and tests |
| `npm run build` | Type checking and production output in `dist/` |
| `npm run preview` | Serve existing `dist/` without rebuilding |
| `npm run deploy` | Build and deploy Worker plus static assets |

Stop local servers with Ctrl+C in their owning terminal. Use `npm install` only
when intentionally updating dependencies and the lockfile.

## Local run modes

### Offline gameplay and client UI

Run `npm run dev` and open the Vite URL. Offline play, rendering, settings,
input and menu work do not require the Worker. Secure multiplayer fails closed
when the Worker or its security configuration is unavailable.

### Full client and Worker

Run `npm run worker:dev` and `npm run dev` in separate terminals. Vite forwards
API requests to Wrangler. Supply local secrets through Wrangler's local
configuration mechanism; never commit them. Turnstile must accept the browser
hostname and match the Worker's expected hostname. See
[Cloudflare operations](operations.md) for variables and service setup.

### Production bundle

Use `npm run build`, then `npm run preview` for production chunk-loading checks.
Worker API routes still need a compatible backend at the preview origin.

## Source and build conventions

Source uses strict TypeScript and ES modules. Preserve `.js` import suffixes;
TypeScript resolves them to `.ts`. Browser and Worker TypeScript configurations
remain separate; shared modules must be valid in both importing graphs.

Vite empties `dist/` before building. Production output is tracked: change source,
regenerate the bundle and include added/deleted hashed assets with `dist/index.html`.
Never hand-edit bundles. Explicitly add new source, tests and generated files;
`git commit -a` does not include untracked paths.

Dependencies, Wrangler state, secrets, logs, screenshots and analysis artifacts
are local-only. Tests and maintained preview fixtures remain tracked.

## Tests

Add tests only for significant gameplay, security, lifecycle or reliability
requirements, or meaningful reproducible bugs. Identify the failure and inspect
existing coverage first. Cosmetic changes, routine refactors, presentation timing
and tuning values normally need no new test. Assert observable outcomes and
essential relationships rather than duplicated constants or animation samples.
Keep setup proportional to risk and update or remove obsolete assertions.

Useful boundaries include packet parsing/authority, shot and damage rules,
collision, deterministic world generation, admission quotas, input cancellation,
state resets and resource ownership. Keep testable logic independent of the DOM,
renderer, PeerJS and Cloudflare bindings where practical.

The test resolution hook in `tests/register.mjs` maps source `.js` imports to
`.ts` and provides deterministic PeerJS/physics doubles. Room state-machine tests
use in-memory storage; integration tests simulate upstream services. These do
not establish external TURN behavior or physical-device input quality.

## Validation by change type

| Change | Required checks and focused review |
| --- | --- |
| Documentation only | Check changed facts and links; no gameplay run needed |
| Tests only | `npm run check` |
| Source | `npm run check`; use affected existing suites while diagnosing failures |
| Production code, public assets or build configuration | `npm run check` and `npm run build`; include regenerated `dist/` |
| Visible behavior | Inspect the affected interaction or existing preview when needed |
| Packet or room authority | Focused parser/authority coverage; use the multiplayer checklist for transport behavior |
| Dependency installation | `npm ci` when dependencies or lockfile change, then check and build |

Run the required checks once after the final changes. Repeat for failures or
later relevant edits. Extended browser/device/network sweeps require an explicit
request. Report automated, local-browser, physical-device and deployed-service
results separately; do not turn task results into permanent documentation.

## Browser visual checks

Run Vite and use the existing fixture for the affected feature. Fixtures use
production modules, are excluded from the production entry and keep review
preferences temporary. Real input capture and external-service checks use the
main application.

| Fixture | Review scope |
| --- | --- |
| `/tests/lighting-preview.html` | Sun/shadows, lava glow, fog, blur, wind, altitude and weather phase |
| `/tests/town-preview.html` | Seeded streets/interiors, walls, stairs, rooftops, well and spawn views |
| `/tests/player-list-preview.html` | Multiplayer Tab list and sample scores |
| `/tests/player-list-preview.html?locator-preview` | Direction markers, elevation, culling and pilot occupancy |
| `/tests/player-list-preview.html?weapon-preview` | Equipped/vehicle icons and touch HUD placement |
| `/tests/player-list-preview.html?stomp-icons` | Stomp pictogram drafts |
| `/tests/goggles-preview.html` | Scans; `?crowded-preview`, `?homing-preview`, `?celestial-preview`, `?elimination-pan` and `?brick-preview` select cases |
| `/tests/goth-preview.html` | NPC rig poses |
| `/tests/goth-chat-preview.html` | Real local model, retriever and chat UI without pointer lock |
| `/tests/mecha-preview.html` | Combat, boarding, piloting, blocked exits and cleanup |
| `/tests/mecha-cutscene-preview.html` | Shared ending, absolute-time seeks and seeded debris |
| `/tests/katana-preview.html` | Melee input, contact, charge and cancellation |
| `/tests/katana-feedback-preview.html` | Trail, impact frame and rear-nape volume |

Lighting fixture frame duration includes vsync and is not GPU timing. Actual
match startup separately exercises loading and renderer preparation. Emulation
does not establish physical multi-touch, safe areas or device performance.
Feature-specific procedures live in [Mecha](forgotten-mecha.md),
[Katana](katana.md), [Mobile controls](mobile-controls.md) and
[Multiplayer checks](multiplayer-live-test.md).

## Generated HUD icons

The firearm and katana icons use side projections of the fitted player GLBs. Regenerate the static silhouettes after model changes.

```bash
node --experimental-strip-types --import ./tests/register.mjs scripts/generate-weapon-icons.mjs
```

Include `src/weaponIndicatorIcons.ts` with the build. The stomp source is
`src/mechaStompIcon.svg`; drafts in `tests/fixtures/stomp-icons/` are produced by
`scripts/generate-stomp-icon-previews.mjs`. Gameplay uses cached SVGs without
loading a model or allocating an icon renderer.

The player list uses a portrait and accent mask rendered from the cyborg GLB. Regenerate both in Blender with `blender -b -P scripts/generate-cyborg-portrait.py`.

## CI contract

GitHub Actions uses Node 22 and LFS-enabled checkout, then runs:

1. `git lfs fsck`
2. `npm ci`
3. `npm run check`
4. `npm run build`
5. A Git status check for changed or untracked output under `dist/`.

CI requires the committed output to match the source. The complete-world
fingerprint test rounds positions to nine decimal places for ARM64/x64
trigonometric differences; instance matrices and scene ownership remain exact.

## Debugging guide

- Multiplayer unavailable: inspect `/api/security-config` and Worker configuration.
- Vite proxy failure: check Wrangler on port 8787.
- Authorized peers cannot connect: inspect PeerJS, ICE state, TURN issuance and
  the data-channel timeout.
- Worlds differ: check snapshot application and seeded random-stream ordering.
- Missed fast collisions: inspect swept queries and closest-hit selection.
- Persistent visual changes: inspect shared materials and restoration/disposal.
- Restart-only failures: inspect reset helpers, pending work, listeners and pools.

See [Architecture](architecture.md) before moving responsibilities between files.
