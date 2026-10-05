# FPS Arena documentation

For a project overview and quick start, see the [project README](../README.md).

## Development

Start with [Development](development.md) for setup, local run modes, tests, and
the contribution workflow. Use [Architecture](architecture.md) to find the
owning module and understand runtime state, lifecycle, and multiplayer data flow.
Feature guides below cover current behavior and manual checks.

| Guide | Contents |
| --- | --- |
| [Architecture](architecture.md) | Runtime layers, module ownership, world generation, gameplay, and networking |
| [Development](development.md) | Prerequisites, scripts, tests, browser fixtures, CI, and generated output |
| [Cloudflare operations](operations.md) | Deployment, bindings, TURN, Turnstile, API routes, and troubleshooting |
| [Planned changes](to_be_changed.md) | Original feature requests and follow-up list |

## Features and assets

| Guide | Contents |
| --- | --- |
| [Full-screen menu](main-menu.md) | Character customization, controls, and weapon specifications |
| [Mobile controls](mobile-controls.md) | Touch input, layout editing, landscape behavior, and device validation |
| [Forgotten Mecha](forgotten-mecha.md) | Siege robot behavior, combat, mounting, piloting, and manual acceptance checks |
| [Blender assets](../blender_assets/README.md) | Asset layout and exports |
| [NPC character files](../public/npc/goth/README.md) | Editing character behavior and knowledge for local chat |
| [Fonts](../public/fonts/README.md) | Font provenance and licensing |

## Validation and historical records

[Multiplayer live test](multiplayer-live-test.md) tracks deployed networking
checks. Physical-device checks live in [Mobile controls](mobile-controls.md).

[Code audit](code-audit.md) and [Audit resolution](audit-resolution.md) record
the September audit and subsequent fixes. They are historical records rather
than the current backlog. Dated verification results describe the environment
and code tested at that time; use the development guide to verify a new change.
