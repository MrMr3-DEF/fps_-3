export const GOGGLES_BRICK_SCAN_MS = 30_000;
export const GOGGLES_TV_OFF_MS = 520;

export interface GogglesFailureState {
    bricked: boolean;
    scanDurationMs: number;
    shutdownUntil: number;
    needsRelease: boolean;
}

export function createGogglesFailureState(): GogglesFailureState {
    return {
        bricked: false,
        scanDurationMs: 0,
        shutdownUntil: 0,
        needsRelease: false,
    };
}

export function resetGogglesFailure(state: GogglesFailureState): void {
    state.bricked = false;
    state.scanDurationMs = 0;
    state.shutdownUntil = 0;
    state.needsRelease = false;
}

/** Returns true only on the frame that the continuous scan bricks the goggles. */
export function updateGogglesFailureScan(
    state: GogglesFailureState,
    anomalyDetected: boolean,
    elapsedMs: number,
    now: number,
): boolean {
    if (state.bricked) return false;
    if (!anomalyDetected || !Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        state.scanDurationMs = 0;
        return false;
    }

    state.scanDurationMs += elapsedMs;
    if (state.scanDurationMs < GOGGLES_BRICK_SCAN_MS) return false;

    state.bricked = true;
    state.scanDurationMs = 0;
    state.shutdownUntil = now + GOGGLES_TV_OFF_MS;
    return true;
}

/** Completes the one-shot CRT shutdown and requires the held input to release. */
export function finishGogglesShutdown(state: GogglesFailureState, now: number): boolean {
    if (state.shutdownUntil <= 0 || now < state.shutdownUntil) return false;
    state.shutdownUntil = 0;
    state.needsRelease = true;
    return true;
}

/** Resolve held aim input while preserving shutdown and post-failure release latching. */
export function resolveGogglesScopeAttempt(state: GogglesFailureState, attempted: boolean): boolean {
    if (state.shutdownUntil > 0) return true;
    if (state.needsRelease) {
        if (!attempted) state.needsRelease = false;
        return false;
    }
    return attempted;
}
