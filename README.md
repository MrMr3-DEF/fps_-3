# FPS Arena

A browser-based arena shooter built with TypeScript and Three.js. Play offline
or join a small peer-to-peer multiplayer room.

[Play FPS Arena](https://fps.luigi.host)

## Features

- A seeded procedural arena with a walled town, wilderness, and lava hazards.
- Five weapons, smart goggles, grappling, air hover, and third-person view.
- A shared siege robot with enemy combat and a pilotable cockpit in singleplayer and multiplayer.
- Keyboard/mouse and customizable touch controls.
- WebRTC multiplayer with Cloudflare-backed room admission and TURN credentials.
- An optional NPC conversation system that runs a language model in the browser.

## Run locally

Requires Node.js **22.15 or newer**, npm, Git LFS, and a WebGL-capable browser.
Install [Git LFS](https://git-lfs.com/) before cloning so model assets download
correctly.

```bash
git lfs install
git clone https://github.com/MrMr3-DEF/fps_-3.git
cd fps_-3
git lfs pull
npm ci
npm run dev
```

Open the URL printed by Vite. Offline play works without the backend. Secure
multiplayer also requires the Cloudflare Worker and its credentials; see
[local development](docs/development.md#full-client-and-worker) and
[Cloudflare setup](docs/operations.md).

## Development

```bash
npm run check    # TypeScript checks and tests
npm run build    # Production bundle
npm run preview  # Serve the built bundle locally
```

Production output in `dist/` is tracked in Git and must be regenerated when
changing production code. See the [development guide](docs/development.md) for
tests, browser fixtures, and CI requirements.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture and module ownership](docs/architecture.md)
- [Development and contribution workflow](docs/development.md)
- [Deployment and multiplayer operations](docs/operations.md)
- [Controls and customization](docs/main-menu.md)
- [Touch controls](docs/mobile-controls.md)
- [Forgotten Mecha](docs/forgotten-mecha.md)
- [Blender assets](blender_assets/README.md)
