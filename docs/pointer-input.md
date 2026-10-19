# Desktop pointer input

Mice and trackpads share the same sensitivity and adaptive resampling path.
Each accepted movement sample is distributed over one observed input interval,
capped at 16.7 ms. A delivered 1,000 Hz event stream uses about a 1 ms window; 60 Hz input is
distributed across the intervening frames of a 120 Hz display. The initial
unknown interval is 8.3 ms. After a 100 ms input gap the estimate restarts.
There is no prediction, angular speed cap or infinite inertial tail. All accepted
movement is consumed once, including fractional deltas and ordinary first samples.

`pointerLockControls.ts` collects samples without moving the camera ahead of the
visible crosshair. The frame loop publishes the resampled camera direction after
FOV easing and immediately before goggles acquisition and drawing. Actions earlier
in that frame and between frames use the previously published camera and its
homing lock. There is no separate smoothed render orientation: weapons, sniper
rays, grappling and goggles share the published aim. Third-person grappling keeps
its existing rendered center ray. Mounted input still routes through `lookInput.ts`
to the pilot controller; touch input retains its own input path.

Sensitivity remains linear in movement units (`0.002 × sensitivity` radians at
normal FOV). During zoom, gain uses `tan(currentFov / 2) / tan(normalFov / 2)` to
preserve center-screen aiming speed throughout the FOV transition.

Gameplay settings expose two independent options, both off by default, including
when loading settings saved before these options existed:

- **Raw mouse input** bypasses system acceleration. It can be useful for an
  external mouse; system-adjusted input remains available for either device.
  Raw input falls back only when explicitly unsupported. Legacy void-returning
  requests, duplicate requests and permission failures retain their handling.
- **Mouse spike protection** retains the historical Windows workaround for
  isolated extreme erroneous deltas. Enable it only if those jumps occur: it can
  discard a genuine extreme flick or delay two comparable fast samples until
  confirmation. Ordinary input does not use this lossy heuristic by default.

An extreme first lock-entry delta over 256 units is still rejected as a cursor
warp. This is a heuristic and can reject an equally large genuine first flick;
ordinary first motion is preserved. Unlock, lock errors, disposal, player reset,
settings application, loading/editor frames and mounting transitions clear pending input so motion cannot
replay into another view or life.

Focused checks in `pointerLockControls.test.ts` replay 60–8,000 Hz input against
60–240 Hz rendering in both raw/system modes, verify distance preservation,
pitch limits, zoom projection, cancellation and pilot routing.
`pointerAimIntegration.test.ts` uses the actual goggles, weapons and grappling
code to check completed-lock firing, pending turns, lock loss/reacquisition,
captured guidance and sniper exclusion. These deterministic checks do not establish
the subjective feel of a physical device or browser-specific input precision.

19 October validation: `npm run check` passed both TypeScript projects and all
422 tests; `npm run build` regenerated tracked production output. Native Chrome
checked sensitivity 3 with system-adjusted and raw input, movement, grappling,
scope, third-person switching and pause/resume without console errors. Native Zen
checked raw pointer lock, movement, grapple/scope input and pause at sensitivity 3.
Physical mouse/trackpad feel and live multiplayer browser play remain manual
acceptance; the homing/crosshair agreement above was checked with real modules in
deterministic integration tests.
