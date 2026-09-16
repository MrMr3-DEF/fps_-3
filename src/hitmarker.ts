import { hitmarkerSvg, type CrosshairSettings } from './controlSettings.js';
import { userSettings } from './settings.js';

function markerElement(): HTMLElement | null {
    return document.getElementById('hitmarker');
}

export function applyHitmarkerSettings(settings: CrosshairSettings = userSettings.crosshair): void {
    const marker = markerElement();
    if (!marker) return;
    marker.innerHTML = hitmarkerSvg(settings);
    marker.style.setProperty('--hitmarker-duration', `${settings.hitmarkerDuration}ms`);
}

/** Retrigger the short HUD flash; confirmed eliminations replace white with red. */
export function flashHitmarker(kill = false): void {
    if (!userSettings.crosshair.hitmarker) return;
    const marker = markerElement();
    if (!marker) return;
    marker.classList.remove('is-flashing', 'is-kill');
    // Reading layout restarts the CSS animation for rapid fire and shotgun pellets.
    void marker.offsetWidth;
    marker.classList.toggle('is-kill', kill);
    marker.classList.add('is-flashing');
}
