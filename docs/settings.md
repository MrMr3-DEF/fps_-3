# Settings

Settings are available from the main menu and the offline pause menu. All categories
share one draft: **Back** sits below the categories when there are no pending
changes. Editing a setting replaces it with side-by-side **Apply** and **Discard**
buttons. Apply saves and activates the shared draft; Discard restores the applied
values. Either action stays in settings and restores Back. Escape follows the
visible Discard or Back action. **Reset all settings** in the **Reset** menu stages the defaults for every category. Resetting keybinds or
the crosshair within its category only stages defaults for that category.

Categories form a vertical sidebar on the left. The sidebar and category content
scroll independently on smaller screens, while the action buttons remain reachable
below the categories. There is no footer box; the content uses the full available
height. Category and action buttons share the main menu's rounded shape, padding,
dark translucent surface and cyan active state. Their left edge stays on the same
horizontal anchor as the main menu buttons, and the first category aligns with the
top edge of the settings box. The content box fits the remaining width beside the
button column, up to 920px. Compact layouts reuse the main menu's smaller buttons
and spacing. Up/Down arrows move between tabs; Home/End select the first/last tab
and bring it into view. Selecting a category starts its content at the top. Settings
hides the game title and has no visible Settings heading. Controls adapt to the
content area's width, including stacked labels and sliders on narrow screens.

- **Gameplay:** sensitivity, raw mouse input, optional mouse spike protection,
  normal/scoped FOV, immediate chat-model download. Raw input and spike protection
  default to Off. Both mice and trackpads use adaptive aim smoothing; high-polling
  mice use a correspondingly short interpolation window. Raw input bypasses system
  acceleration; spike protection is only for erroneous extreme jumps and may
  discard genuine flicks. Scoped gain follows perspective projection throughout
  zoom. See [Desktop pointer input](pointer-input.md).
- **Graphics:** render scale, render distance, particles, shadows and quality,
  fog, motion blur, lava glow, muzzle flashes, bullet trails, FPS counter.
- **Accessibility:** photosensitivity mode.
- **Reset:** global reset for every settings category.
- **Keybinds:** all existing keyboard gameplay actions. Select an action and press
  a key; Escape cancels capture. Assigning a used key swaps its previous action
  with the selected action. Escape remains the pause shortcut. Shift and Ctrl
  accept either side. A **Touch / Keyboard** selector is available on every device.
  New settings default to Touch for a coarse primary pointer and Keyboard otherwise;
  a saved choice takes precedence, including on touchscreen computers with a mouse.
  Touch names this category **Controls** and replaces bindings with **Edit controls**;
  Keyboard restores **Keybinds**. Apply saves the input method. The touch editor
  has a blank sky, draggable controls, and a 50–250% size slider for the selected control.
  Selecting Fire also provides Joystick/Button options; Joystick defaults to holding
  to shoot and dragging to aim. Its Apply commits the layout, Fire type, and shared
  settings draft immediately, including the input method, while keeping the editor
  open. Returning to settings requires no second Apply. Exit asks before discarding
  changes made since the editor's last Apply.
  See [Mobile controls](mobile-controls.md) for the editor and input lifecycle.
- **Crosshair:** ring, cross, or dot; color, size, thickness, gap, opacity,
  shadow, center dot, and hitmarker. Shadow, center dot, and hitmarker have expandable controls.
  The hitmarker flashes four white diagonal strokes for a confirmed hit and red for a confirmed kill;
  it can be enabled or disabled and adjusted for line length, center gap, thickness, opacity, and duration.
  Gap is available for crosses; the extra center dot
  is unavailable for the dot style. The live preview uses the same SVG renderer
  and pixel dimensions as the applied in-game reticle. Existing scope visibility
  rules continue to hide the reticle when appropriate.

Settings remain in `testfps-settings-v1` local storage. Older saved settings get
new keybind, crosshair, enabled muzzle-flash, device-appropriate input, Fire joystick, and default touch-layout values. The graphics toggle controls the
color-matched weapon shockwaves and the grappling gun's blue energy shockwave, while the adjacent opacity slider controls
their transparency from 0–100%. Bullet Trails disables trail allocation for both local and replicated projectiles and clears
existing afterimages when applied. New fields are validated on load. Nested draft
values are cloned to keep edits separate from the applied settings and defaults.

Lava Pool Glow defaults to on for new settings. A saved explicit `false` stays off after reload; a missing or malformed stored value uses the default. Shadows default to on with low quality, and their quality can be changed without rebuilding the arena.

Fog and Motion Blur default to on, including when loading older saved settings.
Either can be disabled independently through Apply; Discard and Reset use the
same shared draft as the other controls. Fog drifts across the map in irregular
banks, becoming denser with altitude on average, with ground patches and clear
openings overhead. Disabling Fog removes gameplay fog completely. Offline pause
also pauses its movement. Motion Blur subtly softens camera turns and travel,
leaving the HUD sharp; it does not accumulate old frames or independently blur
moving objects. Photosensitivity Mode and the system's reduced-motion preference
suppress blur while preserving its saved toggle. Both effects honor Render Scale
and share one render target/pass; disabling both removes that overhead. Devices
without depth-texture support use ordinary distance fog and skip motion blur.
Menu previews and the terminal cinematic retain their own presentation.

Implementation: `settings.ts` handles storage and cloning, `controlSettings.ts`
handles binding translation and reticle rendering, and `settingsMenu.ts` builds
category navigation and controls. `main.ts` retains the Apply lifecycle
and translates physical keyboard input before dispatching gameplay actions. Touch
buttons dispatch the existing action codes directly.
