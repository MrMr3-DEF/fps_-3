import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS, LAVA_DAMAGE_TICK_MS, LAVA_DAMAGE_PER_TICK } from './config.js';
import { isInLavaAt } from './world.js';
import { takePlayerDamage } from './damage.js';

export function touchesLava(position: Readonly<THREE.Vector3>): boolean {
    return isInLavaAt(position.x, position.z, position.y - PLAYER_HEIGHT, PLAYER_RADIUS);
}

export function checkLavaDamage(delta: number): void {
    if (state.isMultiplayer || !state.isPlaying || state.playerHp <= 0 || !state.controls) return;
    state.lavaCooldownMs = Math.max(0, state.lavaCooldownMs - delta * 1000);
    if (state.lavaCooldownMs === 0 && touchesLava(state.controls.getObject().position)) {
        state.lavaCooldownMs = LAVA_DAMAGE_TICK_MS;
        takePlayerDamage(LAVA_DAMAGE_PER_TICK, 'Lava');
    }
}

