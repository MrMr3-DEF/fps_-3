# Full-screen menu

The main menu uses a sky background, a hovering bean preview and shared goggles
scans. Play, Multiplayer, Weapons and Settings occupy the lower-left column.
Character scans expose suit colors without acquiring gameplay homing locks.
Pause and multiplayer panels reuse the same button layout. The Host room-code
button copies its ready code; Join uses a matching input.

Offline pause freezes simulation and exposes settings; Back returns to Pause.
Multiplayer pause keeps simulation running and offers resume/leave without
settings. Color customization is unavailable throughout a match.

## Ownership and shared presentation

| File | Responsibility |
| --- | --- |
| `index.html` | Static menu, weapon panel, scan overlays and color controls |
| `src/mainMenu.ts` | Preview models, menu actions and visible-only rendering |
| `src/appearance.ts` | Validated suit color and independent local-storage persistence |
| `src/lobbyLineup.ts` | Lobby slot geometry and callout placement preferences |
| `src/weaponMenuScan.ts` | Visible weapon bounds, camera fitting and stable scan frames |
| `src/smartGoggles.ts`, `src/gogglesScanTemplates.ts` | Shared scans, typing and measured callout layout |
| `src/gameUI.css`, `src/mobile.css`, `src/gothChat.css` | Main UI, touch/editor and conversation styles |

Preview resources are separate from gameplay peer meshes. Disposal preserves
shared gameplay geometry/materials. Scans reuse overlays; text measurements
refresh on content/font changes and stay within the viewport. Cyan screen
brackets and the self-hosted Science Gothic font are shared across the UI.
Keep the font's [license notice](../public/fonts/OFL-ScienceGothic.txt) with it.

## Character and lobby

The character readout offers a custom picker plus Cobalt, Coral, Mint, Gold and
Lilac presets. Selection updates the preview and local third-person model.
Multiplayer carries validated suit color in lobby and player state.

The admitted roster places the host at center and guests alternating left/right
in admission order. Each viewer scans other players by name without gameplay
stats. Callouts avoid names/menu controls and retain their placement until roster
or viewport changes. Departures remove previews; replacement peers join the end
of admission order even when reusing a spawn slot. Starting play hides the lineup.

## Weapons

Weapon choices and Back form a lower-left stack; the model occupies the right
half. Stats derive from `WEAPON_STATS` and shared projectile/minigun constants.
Sniper is labeled hitscan. [Katana](katana.md) shows melee damage, radius, charge
and swing facts instead of firearm statistics.

Mouse/touch drag or focused arrow keys rotate the model; automatic spin resumes
after input. Switching retracts the scan, slides models and types the new facts;
rapid selection retains the latest choice. Reduced motion skips spin/sliding.
Visible-mesh rotation envelopes keep scan rectangles stable while models turn;
dormant muzzle effects do not affect their size. Resizing recomputes fitting.

## Local chat download settings

Local AI consent is remembered separately from the immediate-download setting.
The setting stays a draft until Apply; declining/Discard starts no download.
The consent dialog traps focus and returns it to the setting.

Applied immediate download owns a background load that continues after chat
closes. Otherwise, closing cancels unfinished interaction-owned loading;
reopening starts a fresh generation. Stale completions cannot replace the engine
or UI. Closing interrupts replies and clears conversation text. Completed models
can remain within the match; leaving releases them when immediate download is off.
Cached model files may remain in browser storage. See the
[character/chat guide](goth-character.md) for model configuration.
