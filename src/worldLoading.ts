let loadingGeneration = 0;
export let isWorldLoading = false;

/** Yield past a paint, including in background tabs where rAF may be suspended. */
export function yieldLoadingFrame(): Promise<void> {
    return new Promise(resolve => {
        const timeout = setTimeout(resolve, 60);
        requestAnimationFrame(() => setTimeout(() => { clearTimeout(timeout); resolve(); }, 0));
    });
}

export function cancelWorldLoading(): void {
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
        await checkpoint();
        await work(checkpoint);
    } finally {
        if (generation === loadingGeneration) {
            isWorldLoading = false;
            if (overlay) overlay.hidden = true;
        }
    }
}
