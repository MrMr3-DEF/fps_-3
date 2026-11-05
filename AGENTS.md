# Working on FPS Arena

Start with [docs/README.md](docs/README.md). Read [README.md](README.md) for the project overview and [docs/development.md](docs/development.md) for the contribution workflow and local verification. Use [docs/architecture.md](docs/architecture.md) to find the owning module and lifecycle boundaries, then read the relevant feature guide before editing. [docs/to_be_changed.md](docs/to_be_changed.md) is the current follow-up list; the September audit documents are historical records.

- Inspect the working tree before editing. Preserve the existing source-file `.js` import suffixes; TypeScript resolves them to `.ts`.
- Use the reset helpers in `src/state.ts` rather than carrying player or match state into a new session. `src/config.ts` owns shared gameplay values. Keep the `damage.ts` and `weaponNetworkPort.ts` dependency seams intact.
- Keep match creation, cancellation, reset, and disposal in sync. World generation must remain deterministic for a shared seed; render distance must not change collision or hit authority.
- Treat WebRTC packets as untrusted. A packet change needs a runtime parser, host authority decision, sender/receiver handling, and focused tests. Keep Worker secrets and room capabilities server-side.
- Keep multiplayer fail-closed when security configuration is missing; do not add public STUN/TURN fallbacks. Keep client and Worker TypeScript configurations separate.
- Explain non-obvious invariants and lifecycle reasons in inline comments. Avoid comments that merely restate the next line; update or remove comments when behavior changes.
- Run `npm run check` for source changes. Run `npm run build` for production-affecting changes and include the regenerated, tracked `dist/` output. Do not hand-edit hashed assets.
- Keep testing and verification to the minimum necessary, including visual inspections. Add new tests only when deemed very important, such as protecting critical gameplay or security invariants. Perform extended testing only when explicitly requested by the user. The required checks and builds above still apply; avoid additional broad checks or repeated successful runs.
- As soon as testing or verification begins, minimize token usage: use focused commands, concise output, and brief result summaries. Inspect detailed logs only when needed to diagnose a failure.
- Keep the relevant docs current when behavior or workflows change. For interactive terminal editing, prefer vim over nano.
