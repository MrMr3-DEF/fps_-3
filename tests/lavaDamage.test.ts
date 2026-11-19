import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.ts';
import { rebuildEnvironmentWithSeed, disposeWorld } from '../src/world.ts';
import { checkLavaDamage } from '../src/lavaDamage.ts';
import { setDamageHandlers } from '../src/damage.ts';
import { LAVA_DAMAGE_TICK_MS } from '../src/config.ts';

test('offline lava uses an independent simulation clock and never harms dead lives', () => {
    const context = new Proxy({}, { get: () => () => {} });
    Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
    let hits = 0;
    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera();
    state.controls = { isLocked: false, getObject: () => state.camera } as any;
    state.isPlaying = true; state.isMultiplayer = false;
    rebuildEnvironmentWithSeed(42); resetPlayerState(); state.playerHp = 2;
    const pool = state.lavaPools[0]; state.camera.position.set(pool.position.x, 2, pool.position.z);
    setDamageHandlers(() => ({ accepted: false, killed: false }), amount => { hits++; state.playerHp = Math.max(0, state.playerHp - amount); state.regenDelayMs = 4000; });
    try {
        checkLavaDamage(0); assert.equal(state.playerHp, 1);
        checkLavaDamage(0); assert.equal(hits, 1);
        checkLavaDamage(LAVA_DAMAGE_TICK_MS / 1000); assert.equal(state.playerHp, 0);
        checkLavaDamage(LAVA_DAMAGE_TICK_MS / 1000); assert.equal(hits, 2);
        resetPlayerState(); checkLavaDamage(0); assert.equal(hits, 3);
        state.isMultiplayer = true; checkLavaDamage(1); assert.equal(hits, 3);
    } finally { disposeWorld(); state.isMultiplayer = false; }
});
