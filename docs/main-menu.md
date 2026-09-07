# Full-screen menu

The menu uses a full-window two-column layout: existing play, multiplayer, settings and lobby panels on the left; a live preview of the playable bean model and suit customization on the right. Pause and leave flows remain available. All buttons, including mobile action buttons, use the HUD bars' 4px corner radius.

`index.html` owns the static menu buttons, weapons panel, and character-preview layout so they exist before JavaScript runs. `src/mainMenu.ts` initializes their behavior and renders the preview once per page. `src/gameUI.css` is loaded directly from the document head and owns the current menu, settings, and HUD styling. The old inline theme has been removed; edit this stylesheet rather than adding a second theme or inline presentation styles. Touch controls and desktop/touch description visibility live in `src/mobile.css`, also loaded from the document head, and girlfriend chat styling lives in `src/gothChat.css`. The preview renders only while the menu is visible, at up to 30 FPS, and adjusts camera distance to fit narrow panels.

Suit color offers six presets and a custom color picker. `src/appearance.ts` validates and saves the selection in local storage independently of gameplay settings. The color updates the local third-person model and travels as an optional validated 24-bit `bodyColor` in multiplayer state packets. Older packets without a color remain accepted.

The weapons screen derives damage, pellets, maximum damage per shot, rate, spread, recoil and cooldown from `WEAPON_STATS`. Minigun ramp and rate values use the minigun constants. No duplicate editable stat table is maintained.

Validation: 45 tests, both TypeScript checks, production build and diff whitespace checks pass. Browser checks covered desktop and 821×400 touch layout, preset selection and persistence, and weapon-tab navigation including minigun values. Physical-phone usability and live multiplayer color replication remain deployment checks.

Suit customization is hidden throughout a match, including pause. The weapons screen replaces the character preview with the selected gameplay gun model. Drag with mouse or touch, or focus the preview and use arrow keys to rotate. Models are cached per weapon, centered and scaled to fit; rotations persist when revisiting a weapon. Preview-owned resources are disposed without disposing shared gameplay geometry/materials. Browser checks verified pistol rotation and minigun selection.
