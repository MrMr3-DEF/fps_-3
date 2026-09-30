# Mobile controls

Devices whose primary pointer is coarse default to touch controls; other devices default to keyboard controls. Settings on every device include a **Touch / Keyboard** input selector: **Touch** names the category **Controls**, while **Keyboard** names it **Keybinds** and exposes the existing keyboard bindings. **Apply** saves and activates the selected input method; **Back** discards that draft change. Saved choices take precedence over device detection. Touch input also works on computers whose primary pointer is a mouse, so hybrid touchscreen devices can select it explicitly. Both modes use the same gameplay, physics and multiplayer paths.

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
| Weapon | Cycle through all five weapons |
| Inspect / View | Inspect the weapon / toggle third person |
| Power jump | Toggle power jump |
| Pause | Show Resume and Leave Game/Lobby |

Weapons use their existing automatic cooldown system, so there is no separate reload action. Buttons and the joystick have translucent backgrounds. Each touch owns its control until release, cancellation or lost capture, allowing movement, looking and firing together. Pausing, death, host disconnection, app backgrounding, fullscreen exit and rotation to portrait release held inputs.

The Fire joystick uses the same relative drag aiming, sensitivity and scoped slowdown as open screen space. Shooting starts on contact; moving that finger aims while the movement joystick retains its independent touch. Pressing away from the Fire joystick's center does not turn the camera. Pointer capture permits aiming beyond the visible control; its knob is visually bounded and recenters on release. The Button variant keeps the existing hold-to-fire behavior without aiming from that control.

Touch gameplay is landscape-only. Starting or resuming requests fullscreen and a landscape orientation lock where supported. Browsers that reject these APIs remain playable in landscape and show a blocking rotate-device screen in portrait. Returning to landscape after rotation leaves the game paused until Resume is tapped. Menus scroll on short screens, and gameplay controls respect display safe areas. Switching the input method releases the old input session and leaves the game paused; resuming Keyboard mode requests pointer lock.

The mobile HUD keeps equal-sized health and reload bars stacked horizontally, with the vertical hover bar beside them. Each horizontal bar is 124 × 19px including borders, with a 6px gap. The stack is 44px tall, matching the default Power jump toggle; the hover bar shares that height and bottom anchor. Desktop bar dimensions are unchanged.

## Editing the layout

In **Controls**, **Edit controls** opens a blank sky preview from either the main menu or offline pause settings. Drag any button or the movement joystick to reposition it. Selecting a control highlights it and opens a **50–250%** size slider above it (below it when the top edge leaves insufficient room). Tap the sky to deselect. Controls retain their size proportions and are clamped inside display safe areas. Saved centers are relative to the safe viewport so the same layout adapts to landscape size and browser chrome changes.

Selecting Fire also exposes **Joystick / Button** options beside its size controls. Joystick is the default for new and older settings. Switching shape retains the Fire control's center and scale, subject to safe-area bounds; it does not move other controls. Both shapes remain inactive in the editor.

**Save** immediately stores the layout and Fire type in `testfps-settings-v1` and returns to settings. Other settings still use **Apply**. **Exit** and Escape ask **“Are you sure you want to leave without saving?”**, with **Go back** and **Leave**. Leaving discards the editor draft; reopening restores the saved layout and type. Global settings reset stages the default layout, Fire joystick and device-appropriate input mode along with other defaults.

The preview reuses the actual gameplay control markup and layout geometry, but has no gameplay event handlers, pointer lock, renderer, or world generation. A paused match stays paused. The editor cancels drags on rotation, focus loss, and app backgrounding, removes its listeners on close, and restores focus to Edit controls. In portrait it shows a rotate notice with Exit still available.

## Validation

- September 30, 2026, native Chrome at an emulated 821 × 400 mobile viewport: verified desktop Keybinds, mobile Touch defaults, keyboard/touch category changes and applied mode persistence across reload, blank sky editor, drag/selection, the 50% and 250% slider endpoints, tapping the sky to deselect, Save persistence across reload, Go back preserving edits, Leave discarding edits, and the preview Pause button remaining nonfunctional. Started an offline touch match with the saved layout and opened/saved the editor from pause settings; returning to Pause did not resume the match. Restored the default Touch mode and layout after testing.
- Fire/HUD follow-up on the same Chrome viewport: verified the Fire selection's Joystick/Button options, saved Button persistence across reload, switching back to Joystick, and drag aiming during an offline match with the knob recentering after release. Visually checked the equal-sized health/reload bars and the full stack's top/bottom alignment with hover and the default Power jump toggle.
- Regression coverage includes stored input/layout migration and validation, cloned draft isolation, safe-area/viewport placement at both size limits, proportion-preserving viewport fitting, and input-mode changes releasing the previous session without resuming.
- Fire joystick regression coverage exercises the real pointer handlers with simultaneous movement/fire owners, drag aiming, scoped sensitivity, off-center presses, foreign pointers, cancellation, app blur, mode changes while held, and the Button variant not turning the camera. Storage checks cover joystick defaults, invalid-value fallback and saved Button mode.
- Client and Worker TypeScript checks and production build pass.
- The then-current automated suite passed, including touch-session start/stop, portrait rejection, fullscreen rejection fallback, partial joystick speed, diagonal speed capping and paused movement suppression. For the current suite, run `npm run check`.
- Native Chrome device emulation at 821 × 400 and 400 × 821: verified the portrait gate, landscape menu/HUD, camera dragging, weapon switching, pause/resume and fullscreen-exit pause; exercised joystick, fire and jump gestures.
- Physical iOS/Android testing is still needed for simultaneous multi-finger input, actual orientation/fullscreen support, safe areas, sustained performance and mobile-to-desktop multiplayer. Desktop emulation does not establish these results.

Implementation: `src/inputSession.ts` owns input activation and mode switching; `src/mobileControls.ts` owns pointer capture and touch actions; `src/mobileControlsView.ts` shares the control markup and DOM layout with `src/mobileControlsEditor.ts`; `src/mobileControlLayout.ts` owns placement math, size limits, cloning and storage validation; `src/mobile.css` owns the mobile/editor styles. `src/settings.ts` persists input mode and layout, and `src/settingsMenu.ts` builds the input selector and editor entry point for all devices.
