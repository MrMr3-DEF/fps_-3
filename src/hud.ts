import { state } from './state.js';

const uiCache: Record<string, HTMLElement | null> = {};

function getUI<T extends HTMLElement>(id: string): T | null {
    return (uiCache[id] || (uiCache[id] = document.getElementById(id))) as T | null;
}

let lastReloadProgress = -1;
let lastHoverFuel = -1;
let lastFpsText = '';

export function updateHealthBar(hpRatio: number, flashColor: string | null = null): void {
    const healthBar = getUI<HTMLElement>('health-bar');
    if (!healthBar) return;
    healthBar.style.width = `${hpRatio}%`;
    if (flashColor) {
        healthBar.style.backgroundColor = flashColor;
        setTimeout(() => {
            const currentBar = getUI<HTMLElement>('health-bar');
            if (state.playerHp > 0 && currentBar && currentBar.style.backgroundColor === flashColor) {
                currentBar.style.backgroundColor = '#2ed573';
            }
        }, 100);
    } else {
        healthBar.style.backgroundColor = '#2ed573';
    }
}

export function updateHoverBar(fuelRatio: number): void {
    const hoverBar = getUI<HTMLElement>('hover-bar');
    if (!hoverBar) return;
    if (fuelRatio !== lastHoverFuel) {
        hoverBar.style.height = `${fuelRatio * 100}%`;
        lastHoverFuel = fuelRatio;
    }
}

export function updateReloadBar(progress: number): void {
    const reloadBar = getUI<HTMLElement>('reload-bar');
    if (!reloadBar) return;
    if (progress !== lastReloadProgress) {
        reloadBar.style.width = `${progress * 100}%`;
        lastReloadProgress = progress;
    }
}

export function setFpsVisible(visible: boolean): void {
    const fpsCounter = getUI<HTMLElement>('fps-counter');
    if (fpsCounter) fpsCounter.style.display = visible ? 'block' : 'none';
}

export function setFpsText(text: string): void {
    const fpsCounter = getUI<HTMLElement>('fps-counter');
    if (!fpsCounter || text === lastFpsText) return;
    fpsCounter.textContent = text;
    lastFpsText = text;
}
