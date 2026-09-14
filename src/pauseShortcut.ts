interface PauseShortcutState {
    isPlaying: boolean;
    isAlive: boolean;
    isInputActive: boolean;
    isPauseMenuVisible: boolean;
}

export type EscapePauseAction = 'pause' | 'resume' | null;

/** Only toggle pause during a living game, outside unrelated overlays. */
export function getEscapePauseAction(code: string, state: PauseShortcutState): EscapePauseAction {
    if (code !== 'Escape' || !state.isPlaying || !state.isAlive) return null;
    if (state.isInputActive) return 'pause';
    return state.isPauseMenuVisible ? 'resume' : null;
}
