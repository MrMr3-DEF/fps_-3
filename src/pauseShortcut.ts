interface PauseShortcutState {
    isPlaying: boolean;
    isAlive: boolean;
    isInputActive: boolean;
    isPauseMenuVisible: boolean;
}

interface SimulationPauseState {
    isPlaying: boolean;
    isMultiplayer: boolean;
    isInputActive: boolean;
    isConversationOpen: boolean;
}

export type EscapePauseAction = 'pause' | 'resume' | null;

/** Only toggle pause during a living game, outside unrelated overlays. */
export function getEscapePauseAction(code: string, state: PauseShortcutState): EscapePauseAction {
    if (code !== 'Escape' || !state.isPlaying || !state.isAlive) return null;
    if (state.isInputActive) return 'pause';
    return state.isPauseMenuVisible ? 'resume' : null;
}

/** Offline play stops completely while its pause/death UI owns input. */
export function shouldPauseOfflineSimulation(state: SimulationPauseState): boolean {
    return state.isPlaying &&
        !state.isMultiplayer &&
        !state.isInputActive &&
        !state.isConversationOpen;
}
