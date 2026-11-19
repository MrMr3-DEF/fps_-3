import { state } from './state.js';
import { updateHealthBar } from './hud.js';

/** Only unpaused offline simulation advances this clock. Multiplayer uses the host life record. */
export function updateHealthRegen(delta: number): boolean {
    if (state.isMultiplayer || !state.isPlaying || state.playerHp <= 0 || state.playerHp >= state.playerMaxHp) return false;
    const elapsed = Math.max(0, delta);
    const waiting = Math.min(state.regenDelayMs / 1000, elapsed);
    state.regenDelayMs = Math.max(0, state.regenDelayMs - elapsed * 1000);
    state.regenTimer += elapsed - waiting;
    const recovered = Math.floor(state.regenTimer);
    if (recovered === 0) return false;
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + recovered);
    state.regenTimer -= recovered;
    updateHealthBar(state.playerHp / state.playerMaxHp * 100);
    return true;
}
