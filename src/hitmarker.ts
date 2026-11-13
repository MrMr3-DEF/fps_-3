import { hitmarkerSvg, type CrosshairSettings } from './controlSettings.js';
import { userSettings } from './settings.js';

let pulse: Animation | null = null;
let killUntil = -Infinity;
let killTimer: ReturnType<typeof setTimeout> | null = null;

function markerElement(): HTMLElement | null {
    return document.getElementById('hitmarker');
}

export function applyHitmarkerSettings(settings: CrosshairSettings = userSettings.crosshair): void {
    pulse?.cancel(); pulse = null; killUntil = -Infinity;
    if (killTimer !== null) clearTimeout(killTimer);
    killTimer = null;
    const marker = markerElement();
    if (!marker) return;
    marker.classList.remove('is-kill');
    marker.innerHTML = hitmarkerSvg(settings);
    marker.style.setProperty('--hitmarker-duration', `${settings.hitmarkerDuration}ms`);
}

/** Retrigger the short HUD flash; confirmed eliminations replace white with red. */
export function flashHitmarker(kill = false): void {
    if (!userSettings.crosshair.hitmarker) return;
    const marker = markerElement();
    if (!marker) return;
    const now = performance.now(), duration = userSettings.crosshair.hitmarkerDuration;
    // A later white confirmation must not downgrade a still-live elimination.
    if (kill) {
        killUntil = now + duration;
        if (killTimer !== null) clearTimeout(killTimer);
        killTimer = setTimeout(() => { marker.classList.remove('is-kill'); killTimer = null; }, duration);
    }
    marker.classList.toggle('is-kill', kill || now < killUntil);
    pulse?.cancel();
    pulse = marker.animate([
        { opacity: 1, offset: 0 }, { opacity: 1, offset: .45, easing: 'ease-out' }, { opacity: 0, offset: 1 },
    ], { duration });
}
