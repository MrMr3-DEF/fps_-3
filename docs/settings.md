# Settings

Settings are available from the main menu and the offline pause menu. All categories
share one draft: **Apply** saves and activates changes, **Back** discards unapplied
changes, and **Reset all settings** in the **Reset** menu stages the defaults for every category. Resetting keybinds or
the crosshair within its category only stages defaults for that category.

- **Gameplay:** sensitivity, normal/scoped FOV, immediate chat-model download.
- **Graphics:** render scale, render distance, particles, shadows and quality,
  lava glow, FPS counter.
- **Accessibility:** photosensitivity mode.
- **Reset:** global reset for every settings category. The footer contains only Apply and Back.
- **Keybinds:** all existing keyboard gameplay actions. Select an action and press
  a key; Escape cancels capture. Assigning a used key swaps its previous action
  with the selected action. Escape remains the pause shortcut. Shift and Ctrl
  accept either side. Mouse and touch controls keep their existing behavior.
- **Crosshair:** ring, cross, or dot; color, size, thickness, gap, opacity,
  shadow, and center dot. Shadow and center dot have expandable controls for
  thickness/size, color, and opacity. Gap is available for crosses; the extra center dot
  is unavailable for the dot style. The live preview uses the same SVG renderer
  and pixel dimensions as the applied in-game reticle. Existing scope visibility
  rules continue to hide the reticle when appropriate.

Settings remain in `testfps-settings-v1` local storage. Older saved settings get
new keybind, crosshair, and enabled muzzle-flash defaults. The graphics toggle controls the
color-matched weapon shockwaves and the grappling gun's blue energy shockwave, while the adjacent opacity slider controls
their transparency from 0–100%. New fields are validated on load. Nested draft
values are cloned to keep edits separate from the applied settings and defaults.

Implementation: `settings.ts` handles storage and cloning, `controlSettings.ts`
handles binding translation and reticle rendering, and `settingsMenu.ts` builds
category navigation and the new controls. `main.ts` retains the Apply lifecycle
and translates physical keyboard input before dispatching gameplay actions. Touch
buttons dispatch the existing action codes directly.
