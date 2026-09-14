interface PauseShortcutState {
    isPlaying: boolean;
    isAlive: boolean;
    isInputActive: boolean;
    isPauseMenuVisible: boolean;
}

export type EscapePauseAction = 'pause' | 'resume' | null;

/** Use an explicit unlock so a later Escape can re-enter pointer lock. */
export function getEscapePauseAction(code: string, state: PauseShortcutState): EscapePauseAction {
    if (code !== 'Escape' || !state.isPlaying || !state.isAlive) return null;
    if (state.isInputActive) return 'pause';
    return state.isPauseMenuVisible ? 'resume' : null;
}
