import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS, LAVA_POOL_HALF_SIZE, LAVA_DAMAGE_TICK_MS, LAVA_DAMAGE_PER_TICK } from './config.js';
import { queryLavaPoolsNear } from './world.js';
import { takePlayerDamage } from './damage.js';
const _lavaCandidates: THREE.Object3D[] = [];

export function touchesLava(position: Readonly<THREE.Vector3>): boolean {
    if (position.y - PLAYER_HEIGHT > 0.15) return false;
    const reach = LAVA_POOL_HALF_SIZE + PLAYER_RADIUS;
    const pools = queryLavaPoolsNear(position.x, position.z, reach, _lavaCandidates);
    return pools.some(pool => Math.abs(position.x - pool.position.x) < reach &&
        Math.abs(position.z - pool.position.z) < reach);
}

export function checkLavaDamage(delta: number): void {
    if (state.isMultiplayer || !state.isPlaying || state.playerHp <= 0 || !state.controls) return;
    state.lavaCooldownMs = Math.max(0, state.lavaCooldownMs - delta * 1000);
    if (state.lavaCooldownMs === 0 && touchesLava(state.controls.getObject().position)) {
        state.lavaCooldownMs = LAVA_DAMAGE_TICK_MS;
        takePlayerDamage(LAVA_DAMAGE_PER_TICK, 'Lava');
    }
}

