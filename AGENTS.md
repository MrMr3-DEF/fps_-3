# Working on FPS Arena

Start with [docs/README.md](docs/README.md). For a fresh handoff, read [docs/agent-handoff.md](docs/agent-handoff.md), then use [docs/architecture.md](docs/architecture.md) to find the owning module and [docs/development.md](docs/development.md) for local verification. [docs/to_be_changed.md](docs/to_be_changed.md) is the current follow-up list; the September audit documents are historical records.

- Inspect the working tree before editing. Preserve the existing source-file `.js` import suffixes; TypeScript resolves them to `.ts`.
- Keep match creation, cancellation, reset, and disposal in sync. World generation must remain deterministic for a shared seed; render distance must not change collision or hit authority.
- Treat WebRTC packets as untrusted. A packet change needs a runtime parser, host authority decision, sender/receiver handling, and focused tests. Keep Worker secrets and room capabilities server-side.
- Explain non-obvious invariants and lifecycle reasons in inline comments. Avoid comments that merely restate the next line; update or remove comments when behavior changes.
- Run `npm run check` for source changes. Run `npm run build` for production-affecting changes and include the regenerated, tracked `dist/` output. Do not hand-edit hashed assets.
- Keep the relevant docs current when behavior or workflows change. For interactive terminal editing, prefer vim over nano.
