# Full-screen menu

The main menu uses a sky background, a hovering cyborg preview and shared goggles
scans. Play, Multiplayer, Weapons and Settings occupy the lower-left column.
The character’s scan callout on the main menu contains the suit color picker.
Pause and multiplayer panels reuse the same button layout. The Host room-code
button copies its ready code; Join uses a matching input.

Offline pause freezes simulation and exposes settings; Back returns to Pause.
Multiplayer pause keeps simulation running and offers resume/leave without
settings. Pause previews the equipped weapon in both modes.

## Ownership and shared presentation

| File | Responsibility |
| --- | --- |
| `index.html` | Static menu, weapon panel, scan overlays and color controls |
| `src/mainMenu.ts` | Preview models, menu actions and visible-only rendering |
| `src/appearance.ts`, `src/playerAppearance.ts` | Validated local suit color, persistence and multiplayer publication |
| `src/lobbyLineup.ts` | Lobby slot geometry and callout placement preferences |
| `src/weaponMenuScan.ts` | Visible weapon bounds, camera fitting and stable scan frames |
| `src/smartGoggles.ts`, `src/gogglesScanTemplates.ts` | Shared scans, typing and measured callout layout |
| `src/gameUI.css`, `src/mobile.css`, `src/gothChat.css` | Main UI, touch/editor and conversation styles |

Preview actors have independent skeletons and suit materials. Menu and match views
share the same cyborg, fitted weapons and four animated exhausts. Scans reuse overlays; text measurements
refresh on content/font changes and stay within the viewport. Cyan screen
brackets and the self-hosted Science Gothic font are shared across the UI.
Keep the font's [license notice](../public/fonts/OFL-ScienceGothic.txt) with it.

## Character and lobby

Before entering a match or lobby, choose Cobalt, Coral, Mint, Gold or Lilac in the Character scan readout, or open its native custom color tile. The selection updates the preview and is saved for the local player’s suit in both game modes.
Multiplayer carries validated suit color in lobby and player state. The scoreboard
uses the same color for the visor and chest inlay of each cyborg portrait.

Regenerate the portrait and its accent mask from the character GLB with
`blender -b -P scripts/generate-cyborg-portrait.py` from the repository root.

The admitted roster places the host at center and guests alternating left/right
in admission order. Each viewer scans other players by name without gameplay
stats. Callouts avoid names/menu controls and retain their placement until roster
or viewport changes. Departures remove previews; replacement peers join the end
of admission order even when reusing a spawn slot. Starting play hides the lineup. Menu cameras reserve the controls’ actual bounds and frame the available width or height. Portrait menus place the preview above the controls. Settings uses the same canvas in a compact sidebar tile.

## Weapons

Choose one of five guns, the katana or the grapple. Held view shows the fitted prop on the cyborg at gameplay scale. Select Specifications to isolate the weapon and show its stats in the close-up scan. The pistol and shotgun hold the grapple on the left. Their held reload preview stows the grapple before opening the drawer and draws it again afterward. All five guns replay their actual battery duration. The grapple can show its authored battery service motion. Preview actions leave game ammunition and controls untouched.

Drag or use the focused arrow keys to rotate either view. Close-up returns to automatic spin after input. Switching close-ups retracts the scan and slides the new prop into view. Reduced motion skips automatic rotation and transitions. Specifications include magazine capacity and recharge time for guns, melee properties for the katana, and range and draw timing for the grapple.

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
