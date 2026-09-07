import { PLAYER_HEIGHT } from './config.js';
import { state, resetPlayerState } from './state.js';
import { getTownSpawn } from './town.js';

/** Use the synchronized seed after world creation, before play begins. */
export function placePlayerAtTownSpawn(seed: number, kind: 'house' | 'church', houseSlot = 0): void {
    const spawn = getTownSpawn(seed, kind, houseSlot);
    const player = state.controls?.getObject();
    if (!player) return;
    player.position.set(spawn.x, PLAYER_HEIGHT, spawn.z);
    player.rotation.set(0, spawn.yaw, 0, 'YXZ');
}

export function resetPlayerAtTownSpawn(seed: number, kind: 'house' | 'church', houseSlot = 0): void {
    resetPlayerState();
    placePlayerAtTownSpawn(seed, kind, houseSlot);
}
