let loadingGeneration = 0;
export let isWorldLoading = false;

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
    const overlay = document.getElementById('world-loading');
    if (overlay) overlay.hidden = true;
}

export async function withWorldLoading(work: (checkpoint: () => Promise<void>) => Promise<void>): Promise<void> {
    const generation = ++loadingGeneration;
    const overlay = document.getElementById('world-loading');
    isWorldLoading = true;
    if (overlay) overlay.hidden = false;
    const checkpoint = async () => {
        await yieldLoadingFrame();
        if (generation !== loadingGeneration) throw new DOMException('Loading cancelled', 'AbortError');
    };
    try {
        // Callers also checkpoint between long generation stages; synchronous
        // work inside a stage cannot be interrupted mid-stage.
        await checkpoint();
        await work(checkpoint);
    } finally {
        if (generation === loadingGeneration) {
            isWorldLoading = false;
            if (overlay) overlay.hidden = true;
        }
    }
}
