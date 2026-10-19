import * as THREE from 'three';
import { state } from './state.js';
import { isInputActive } from './inputSession.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS, LAVA_POOL_HALF_SIZE, LAVA_DAMAGE_TICK_MS, LAVA_DAMAGE_PER_TICK } from './config.js';
import { queryLavaPoolsNear } from './world.js';
import { takePlayerDamage } from './damage.js';
const _lavaCandidates: THREE.Object3D[] = [];

export function checkLavaDamage(): void {
    // Multiplayer hazards continue while local input is paused. Dead lives
    // are always excluded so one lava tick cannot repeatedly report a death.
    if (!state.isPlaying || state.playerHp <= 0 || !state.controls || (!state.isMultiplayer && !isInputActive())) return;

    const playerObj = state.controls.getObject();
    const feetY = playerObj.position.y - PLAYER_HEIGHT;

    if (feetY <= 0.15) {
        let standingOnLava = false;
        const pools = queryLavaPoolsNear(playerObj.position.x, playerObj.position.z, LAVA_POOL_HALF_SIZE + PLAYER_RADIUS, _lavaCandidates);
        const len = pools.length;
        for (let i = 0; i < len; i++) {
            const pool = pools[i];
            const dx = Math.abs(playerObj.position.x - pool.position.x);
            const dz = Math.abs(playerObj.position.z - pool.position.z);
            if (dx < LAVA_POOL_HALF_SIZE + PLAYER_RADIUS && dz < LAVA_POOL_HALF_SIZE + PLAYER_RADIUS) {
                standingOnLava = true;
                break;
            }
        }

        if (standingOnLava) {
            const now = performance.now();
            if (now - state.lastDamageTime >= LAVA_DAMAGE_TICK_MS) {
                takePlayerDamage(LAVA_DAMAGE_PER_TICK, 'Lava');
            }
        }
    }
}

