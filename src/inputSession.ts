import { state } from './state.js';

const startListeners = new Set<() => void>();
const endListeners = new Set<() => void>();
let boundControls: typeof state.controls = null;

function emitStarted(): void {
    for (const listener of startListeners) listener();
}

function emitEnded(): void {
    for (const listener of endListeners) listener();
}

function bindControls(): void {
    const controls = state.controls;
    if (!controls || controls === boundControls) return;
    boundControls = controls;
    controls.addEventListener('lock', () => {
        if (state.controls !== controls) return;
        emitStarted();
    });
    controls.addEventListener('unlock', () => {
        if (state.controls === controls && !touchPlaying) emitEnded();
    });
}

export function onInputStarted(callback: () => void): void {
    startListeners.add(callback);
    bindControls();
}
export function onInputEnded(callback: () => void): void {
    endListeners.add(callback);
    bindControls();
}

export let touchMode = false;
let touchPlaying = false;
export const touchMove = { x: 0, y: 0 };
export function enableTouchMode(): void { touchMode = true; }
export function isInputActive(): boolean {
    return touchPlaying || Boolean(state.controls?.isLocked);
}
export function beginInput(): void {
    bindControls();
    if (!touchMode) { state.controls?.lock(); return; }
    if (innerWidth <= innerHeight || touchPlaying) return;
    touchPlaying = true;
    emitStarted();
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
        emitEnded();
    } else state.controls?.unlock();
}
