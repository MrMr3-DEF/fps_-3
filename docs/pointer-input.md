# Desktop pointer input

The Windows report contained a first locked delta of (835, 442), followed by isolated (702, -3) and (298, 478) events with 2 ms gaps. Other reported movement was about 1–10 units per axis. At sensitivity 1, the old direct camera mapping applied about 96 degrees of yaw for dx=835.

`pointerLockControls.ts` requests unadjusted mouse input, falling back only when raw input is explicitly unsupported. It supports legacy void-returning requests, avoids concurrent requests, and sets lock state before notifying the menu/HUD. `mouseMovement.ts` filters camera movement independently of touch controls and the menu model viewer.

The first sample after each lock transition is ignored. Subsequent events over 256 units, arriving within 16 ms and exceeding both 128 units/ms and 16 times the recent peak speed, await the next sample. A comparable, similarly directed sample confirms sustained fast movement and applies both deltas. Otherwise the suspect sample is discarded. Ordinary movement is neither smoothed nor angle-capped. This is a heuristic: a genuine isolated extreme flick can be discarded, and two comparable erroneous spikes could pass. The first real movement sample is also intentionally lost after locking.

Validation: 53 tests and both TypeScript checks pass; deployment output rebuilt. Tests replay the reported spikes through the filter and actual camera controls, preserve ordinary/low-polling/sustained fast motion, and check raw-input success, unsupported fallback, legacy APIs and permission failures. Retesting on the affected Windows browser and mouse is required to confirm the user-visible fix; the browser/device cause of the anomalous deltas is not established.
