import { TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from './config.js';
import { state } from './state.js';

/** One automatic activation per match, past the outer face of the castle walls. */
export function updatePowerJumpOnCastleExit(position: { x: number; z: number }): void {
    if (!state.isPlaying || state.playerHp <= 0 || state.powerJumpAutoActivated) return;
    const edge = TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2;
    if (Math.abs(position.x) <= edge && Math.abs(position.z) <= edge) return;
    state.powerJumpEnabled = true;
    state.powerJumpAutoActivated = true;
}
