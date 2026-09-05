# Mobile controls

Touch controls activate on devices whose primary pointer is coarse. Desktop mouse and keyboard controls keep their existing behavior. Both modes use the same gameplay, physics and multiplayer paths.

| Control | Action |
| --- | --- |
| Left joystick | Analog movement with a dead zone and capped diagonal speed |
| Drag open screen space | Look around; uses the Aim Sensitivity setting and slows while aiming |
| Hold Fire | Repeat shots at the weapon's normal fire cadence; minigun retains its spin-up |
| Hold Aim | Aim through goggles |
| Jump | Jump or detach from a pulling grapple |
| Hold Hover | Use hover thrusters in the air |
| Grapple | Fire or release the grappling hook |
| Weapon | Cycle through all five weapons |
| Inspect / View | Inspect the weapon / toggle third person |
| Pause | Show Resume and Leave Game/Lobby |

Weapons use their existing automatic cooldown system, so there is no separate reload action. Buttons and the joystick have translucent backgrounds. Each touch owns its control until release, cancellation or lost capture, allowing movement, looking and firing together. Pausing, death, host disconnection, app backgrounding, fullscreen exit and rotation to portrait release held inputs.

Gameplay is landscape-only. Starting or resuming requests fullscreen and a landscape orientation lock where supported. Browsers that reject these APIs remain playable in landscape and show a blocking rotate-device screen in portrait. Returning to landscape after rotation leaves the game paused until Resume is tapped. Menus scroll on short screens, and gameplay controls respect display safe areas.

## Validation

- Client and Worker TypeScript checks and production build pass.
- 44 automated tests pass, including touch-session start/stop, portrait rejection, fullscreen rejection fallback, partial joystick speed, diagonal speed capping and paused movement suppression.
- Native Chrome device emulation at 821 × 400 and 400 × 821: verified the portrait gate, landscape menu/HUD, camera dragging, weapon switching, pause/resume and fullscreen-exit pause; exercised joystick, fire and jump gestures.
- Physical iOS/Android testing is still needed for simultaneous multi-finger input, actual orientation/fullscreen support, safe areas, sustained performance and mobile-to-desktop multiplayer. Desktop emulation does not establish these results.

Implementation: `src/inputSession.ts` owns input activation; `src/mobileControls.ts` owns pointer capture and touch actions; `src/mobile.css` owns the layout.
