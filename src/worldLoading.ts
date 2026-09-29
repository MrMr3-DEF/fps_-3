let loadingGeneration = 0;
export let isWorldLoading = false;
export let isWorldReveal = false;
export type WorldLoadingMode = 'world' | 'boot';

const BOOT_FAKE_PROGRESS_CAP = 0.93;
const BOOT_FAKE_PROGRESS_TIME_MS = 1800;
// These waits match the CSS timings so cancellation and cleanup never cut a phase short.
const BOOT_FINISH_MS = 380;
const BOOT_FLASH_MS = 360;
const BOOT_CONTENT_FADE_MS = 220;
const BOOT_SCREEN_FADE_MS = 500;

function hideLoadingOverlay(overlay: HTMLElement | null): void {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove('boot-content-out', 'boot-screen-out');
    delete overlay.dataset.loadingMode;
    const fill = overlay.querySelector<HTMLElement>('.world-loading-boot-fill');
    if (fill) {
        fill.classList.remove('boot-flashing');
        fill.style.transition = 'none';
        fill.style.transform = 'scaleX(0)';
    }
}

/** Let the overlay paint before expensive work; the timeout also advances hidden tabs. */
export function yieldLoadingFrame(): Promise<void> {
    return new Promise(resolve => {
        const timeout = setTimeout(resolve, 60);
        requestAnimationFrame(() => setTimeout(() => { clearTimeout(timeout); resolve(); }, 0));
    });
}

export function cancelWorldLoading(): void {
    // Invalidating the generation prevents an old checkpoint/finally block from
    // resuming work or hiding a newer match's overlay.
    loadingGeneration++;
    isWorldLoading = false;
    isWorldReveal = false;
    hideLoadingOverlay(document.getElementById('world-loading'));
}

export async function withWorldLoading(
    work: (checkpoint: () => Promise<void>) => Promise<void>,
    mode: WorldLoadingMode = 'world',
): Promise<void> {
    const generation = ++loadingGeneration;
    const overlay = document.getElementById('world-loading');
    const bootFill = mode === 'boot' ? overlay?.querySelector<HTMLElement>('.world-loading-boot-fill') : null;
    let progressRunning = false;
    isWorldLoading = true;
    isWorldReveal = false;
    if (overlay) {
        overlay.classList.remove('boot-content-out', 'boot-screen-out');
        overlay.dataset.loadingMode = mode;
        overlay.hidden = false;
    }
    if (bootFill) {
        bootFill.classList.remove('boot-flashing');
        const startedAt = performance.now();
        bootFill.style.transition = 'none';
        bootFill.style.transform = 'scaleX(0)';
        progressRunning = true;
        const advanceBootProgress = () => {
            if (!progressRunning || generation !== loadingGeneration) return;
            // Ease toward a ceiling so the display never claims completion before
            // world generation and renderer preparation have really finished.
            const elapsed = Math.max(0, performance.now() - startedAt);
            const progress = BOOT_FAKE_PROGRESS_CAP * (1 - Math.exp(-elapsed / BOOT_FAKE_PROGRESS_TIME_MS));
            bootFill.style.transform = `scaleX(${progress})`;
            requestAnimationFrame(advanceBootProgress);
        };
        requestAnimationFrame(advanceBootProgress);
    }
    const ensureCurrent = () => {
        if (generation !== loadingGeneration) throw new DOMException('Loading cancelled', 'AbortError');
    };
    const checkpoint = async () => { await yieldLoadingFrame(); ensureCurrent(); };
    const waitForPhase = async (duration: number) => {
        await new Promise(resolve => setTimeout(resolve, duration));
        ensureCurrent();
    };
    try {
        // Callers also checkpoint between long generation stages; synchronous
        // work inside a stage cannot be interrupted mid-stage.
        await checkpoint();
        await work(checkpoint);
        if (bootFill) {
            progressRunning = false;
            bootFill.style.transition = `transform ${BOOT_FINISH_MS}ms ease-out`;
            bootFill.style.transform = 'scaleX(1)';
            // Keep the overlay up until the real work is done and the last fill
            // animation has visibly reached its end.
            await waitForPhase(BOOT_FINISH_MS + 50);
            bootFill.classList.add('boot-flashing');
            await waitForPhase(BOOT_FLASH_MS);
            overlay?.classList.add('boot-content-out');
            await waitForPhase(BOOT_CONTENT_FADE_MS);
            // The frame loop can now draw the prepared world behind the opaque
            // black overlay, without advancing simulation before startup ends.
            isWorldReveal = true;
            await checkpoint();
            overlay?.classList.add('boot-screen-out');
            await waitForPhase(BOOT_SCREEN_FADE_MS);
        }
    } finally {
        progressRunning = false;
        if (generation === loadingGeneration) {
            isWorldLoading = false;
            isWorldReveal = false;
            hideLoadingOverlay(overlay);
        }
    }
}
