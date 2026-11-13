# Mobile controls

Devices whose primary pointer is coarse default to touch controls; other devices default to keyboard controls. Settings on every device include a **Touch / Keyboard** input selector: **Touch** names the category **Controls**, while **Keyboard** names it **Keybinds** and exposes the existing keyboard bindings. **Apply** saves and activates the selected input method; **Discard** restores the applied choice. Either action keeps settings open and restores the regular **Back** button below the categories. Saved choices take precedence over device detection. Touch input also works on computers whose primary pointer is a mouse, so hybrid touchscreen devices can select it explicitly. Both modes use the same gameplay, physics and multiplayer paths.

| Control | Action |
| --- | --- |
| Left joystick | Analog movement with a dead zone and capped diagonal speed |
| Drag open screen space | Look around; uses the Aim Sensitivity setting and slows while aiming |
| Fire joystick (default) | Hold to repeat shots and drag the same thumb to aim; minigun retains its spin-up |
| Fire button (optional) | Hold to repeat shots; aim by dragging open screen space |
| Hold Aim | Aim through goggles; temporarily use first person while third-person view is active |
| Jump | Jump or detach from a pulling grapple |
| Hold Hover | Use hover thrusters in the air |
| Grapple | Fire or release the grappling hook |
| Weapon | Cycle through all six weapons |
| Inspect / View | Inspect the weapon / toggle third person |
| Power jump | Toggle power jump |
| Pause | Show Resume and Leave Game/Lobby |

Weapons use their existing automatic cooldown system, so there is no separate reload action. Buttons and the joystick have translucent backgrounds. Each touch owns its control until release, cancellation or lost capture, allowing movement, looking and firing together. Pausing, death, host disconnection, app backgrounding, fullscreen exit and rotation to portrait release held inputs.

The Fire joystick uses the same relative drag aiming, sensitivity and scoped slowdown as open screen space. Shooting starts on contact; moving that finger aims while the movement joystick retains its independent touch. Pressing away from the Fire joystick's center does not turn the camera. Pointer capture permits aiming beyond the visible control; its knob is visually bounded and recenters on release. The Button variant keeps the existing hold-to-fire behavior without aiming from that control.

Touch gameplay is landscape-only. Starting or resuming requests fullscreen and a landscape orientation lock where supported. Browsers that reject these APIs remain playable in landscape and show a blocking rotate-device screen in portrait. Returning to landscape after rotation leaves the game paused until Resume is tapped. Menus scroll on short screens, and gameplay controls respect display safe areas. Switching the input method releases the old input session and leaves the game paused; resuming Keyboard mode requests pointer lock.

The mobile HUD keeps equal-sized health and reload bars stacked horizontally, with the vertical hover bar beside them. Each horizontal bar is 124 × 19px including borders, with a 6px gap. The stack is 44px tall, matching the default Power jump toggle; the hover bar shares that height and bottom anchor. Desktop bar dimensions are unchanged.

The locator sits at the top center, 20px below the safe top edge. Its width
shares the health/reload sizing (124px here, 484px on desktop) and its corners
use the shared 4px control radius. Player dots keep their suit color, including
duplicate colors, and stay 20px across with the shared 4px corner radius. The
mecha uses a silver marker with square, pixelated rust spots. Markers overlap on
the line, with small above/below-view arrows; scoped
aiming keeps the locator visible while the bottom bars hide.

The selected-weapon panel uses the same neutral styling as Power Jump when off.
Its 88 × 44px touch size shares the bar-stack height and 4px control radius.
It stays at the far right, 10px above the actual action-button cluster, using
the saved layout and safe-area bounds without moving controls. Extreme custom
layouts clamp the panel to the safe top edge. With keyboard input the panel
uses the bottom-right anchor instead. Scoped aiming on foot hides it with the
health/ammo bars; active mecha piloting shows the selected rocket or stomp-foot
silhouette. The stomp uses the same 4px corners and white static icon styling.

## Editing the layout

In **Controls**, **Edit controls** opens a blank sky preview from either the main menu or offline pause settings. Drag any button or the movement joystick to reposition it. Selecting a control highlights it and opens a **50–250%** size slider above it (below it when the top edge leaves insufficient room). Tap the sky to deselect. Controls retain their size proportions and are clamped inside display safe areas. Saved centers are relative to the safe viewport so the same layout adapts to landscape size and browser chrome changes.

Selecting Fire also exposes **Joystick / Button** options beside its size controls. Joystick is the default for new and older settings. Switching shape retains the Fire control's center and scale, subject to safe-area bounds; it does not move other controls. Both shapes remain inactive in the editor.

**Apply** immediately commits the layout, Fire type, and entire shared settings draft to `testfps-settings-v1`, then keeps the editor open. This includes a pending Touch selection or changes in other categories, so returning to settings shows **Back** with no second Apply required. Further editor edits stay separate from that applied baseline. **Exit** and Escape return directly when the layout is unchanged; otherwise they ask **“Are you sure you want to leave without saving?”**, with **Go back** and **Leave**. Leaving discards only changes since the editor's last Apply; reopening restores the applied layout and type. Global settings reset stages the default layout, Fire joystick and device-appropriate input mode along with other defaults.

The preview reuses the actual gameplay control markup and layout geometry, but has no gameplay event handlers, pointer lock, renderer, or world generation. A paused match stays paused. The editor cancels drags on rotation, focus loss, and app backgrounding, removes its listeners on close, and restores focus to Edit controls. In portrait it shows a rotate notice with Exit still available.

## Device checks

Use physical iOS/Android devices for simultaneous movement/look/fire, orientation,
fullscreen support, safe areas and sustained performance. Desktop emulation only
checks layout and simulated pointer behavior. Check the affected interaction,
including cancellation on blur/portrait, pause/resume and saved layout reload.

Existing tests cover input capture/cancellation, mode changes, layout validation,
draft isolation and viewport bounds. See [Development](development.md#tests) for
when new tests are justified.

Implementation: `src/inputSession.ts` owns input activation and mode switching; `src/mobileControls.ts` owns pointer capture and touch actions; `src/mobileControlsView.ts` shares the control markup and DOM layout with `src/mobileControlsEditor.ts`; `src/mobileControlLayout.ts` owns placement math, size limits, cloning and storage validation; `src/mobile.css` owns the mobile/editor styles. `src/settings.ts` persists input mode and layout, and `src/settingsMenu.ts` builds the input selector and editor entry point for all devices.

While piloting the Mecha, Helmet occupies the Grapple layout slot, Shield replaces
Hover, and Exit occupies the otherwise inactive Inspect slot. Exit closes the
helmet and runs voluntary shutdown; it is unavailable during boarding/startup.
Weapon cycles Rockets and Stomp, starting on Rockets after fresh boarding.
Hold Fire repeats the selected ready attack. Stomp freezes travel and leg
turning through the full animation while torso look and shield remain usable.
Its reload bar stays empty during the clip, then fills over five seconds.
Switching keeps both cooldowns; Exit waits for any committed attack to finish.
These mounted controls inherit existing saved slot placement/scale and remain
inactive in the layout editor. No stored-layout migration is required.

The Weapon cycle includes [Katana](katana.md). Hold Fire to charge and release
to swing; touch cancellation or leaving input cancels charge without attacking.
There is no automatic repeated melee attack while Fire is held.
