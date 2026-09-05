import { state } from './state.js';

const startListeners = new Set<() => void>();
const endListeners = new Set<() => void>();
export function onInputStarted(callback: () => void): void {
    startListeners.add(callback);
    state.controls?.addEventListener('lock', callback);
}
export function onInputEnded(callback: () => void): void {
    endListeners.add(callback);
    state.controls?.addEventListener('unlock', callback);
}

export let touchMode = false;
let touchPlaying = false;
export const touchMove = { x: 0, y: 0 };
export function enableTouchMode(): void { touchMode = true; }
export function isInputActive(): boolean {
    return touchPlaying || Boolean(state.controls?.isLocked);
}
export function beginInput(): void {
    if (!touchMode) { state.controls?.lock(); return; }
    if (innerWidth <= innerHeight || touchPlaying) return;
    touchPlaying = true;
    for (const listener of startListeners) listener();
    // Request from the initiating gesture; unsupported browsers retain the rotate gate.
    void (async () => {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
            if (!touchPlaying) return;
            const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
            await orientation?.lock?.('landscape');
        } catch { /* Landscape gate remains available without fullscreen support. */ }
    })();
}
export function endInput(): void {
    touchMove.x = touchMove.y = 0;
    if (touchPlaying) {
        touchPlaying = false;
        for (const listener of endListeners) listener();
    } else state.controls?.unlock();
}
