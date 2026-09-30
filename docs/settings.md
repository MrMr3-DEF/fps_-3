# Settings

Settings are available from the main menu and the offline pause menu. All categories
share one draft: **Apply** saves and activates changes, **Back** discards unapplied
changes, and **Reset all settings** in the **Reset** menu stages the defaults for every category. Resetting keybinds or
the crosshair within its category only stages defaults for that category.

Categories form a vertical sidebar on the left. The sidebar and category content
scroll independently on smaller screens, while Apply and Back remain visible below
the content. Up/Down arrows move between tabs; Home/End select the first/last tab
and bring it into view. Selecting a category starts its content at the top. Settings
hides the game title and has no visible Settings heading. Controls adapt to the
content area's width, including stacked labels and sliders on narrow screens.

- **Gameplay:** sensitivity, normal/scoped FOV, immediate chat-model download.
- **Graphics:** render scale, render distance, particles, shadows and quality,
  lava glow, muzzle flashes, bullet trails, FPS counter.
- **Accessibility:** photosensitivity mode.
- **Reset:** global reset for every settings category. The footer contains only Apply and Back.
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
  to shoot and dragging to aim. Its Save immediately stores the layout and Fire type;
  Exit asks before discarding its draft.
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

Layout validation on September 30, 2026: native Chrome desktop and mobile emulation
at 821 × 400, 821 × 300, and 500 × 300. Checked independent sidebar/content scrolling,
Up/Down and Home/End navigation, narrow graphics/crosshair/input controls, visible
Apply/Back with an unsaved draft, hidden headings in settings, and title restoration
after Back. The existing Apply/Back draft lifecycle was retained.

Input-selector follow-up on September 30, 2026: native Chrome desktop showed both
input options, renamed the category to Keybinds/Controls when switching, exposed
the touch editor, and retained the previously saved Touch choice. Pointer-handler
regressions exercise touch movement, firing, aiming and release with either a
coarse or fine primary pointer.

Implementation: `settings.ts` handles storage and cloning, `controlSettings.ts`
handles binding translation and reticle rendering, and `settingsMenu.ts` builds
category navigation and the new controls. `main.ts` retains the Apply lifecycle
and translates physical keyboard input before dispatching gameplay actions. Touch
buttons dispatch the existing action codes directly.
