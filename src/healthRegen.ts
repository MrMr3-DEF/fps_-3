import { state } from './state.js';
import { REGEN_DELAY_MS } from './config.js';
import { updateHealthBar } from './hud.js';

/** Multiplayer healing follows real time; offline healing follows unpaused simulation time. */
export function updateHealthRegen(delta: number, now = performance.now()): boolean {
    const elapsed = state.isMultiplayer
        ? Math.max(0, now - Math.max(state.regenUpdatedAt, state.lastDamageTime + REGEN_DELAY_MS)) / 1000
        : Math.max(0, delta);
    state.regenUpdatedAt = now;
    if (!state.isPlaying || state.playerHp <= 0 || state.playerHp >= state.playerMaxHp ||
        now < state.lastDamageTime + REGEN_DELAY_MS) {
        state.regenTimer = 0;
        return false;
    }
    state.regenTimer += elapsed;
    const recovered = Math.floor(state.regenTimer);
    if (recovered === 0) return false;
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + recovered);
    state.regenTimer -= recovered;
    updateHealthBar(state.playerHp / state.playerMaxHp * 100);
    return true;
}
