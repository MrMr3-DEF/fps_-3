import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.ts';
import { rebuildEnvironmentWithSeed, disposeWorld } from '../src/world.ts';
import { checkLavaDamage } from '../src/lavaDamage.ts';
import { setDamageHandlers } from '../src/damage.ts';
import { LAVA_DAMAGE_TICK_MS } from '../src/config.ts';

test('paused multiplayer lava continues through one death per life; offline pause remains frozen', t => {
    const context = new Proxy({}, { get: () => () => {} });
    Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
    let now = 10_000, hits = 0; t.mock.method(performance, 'now', () => now);
    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera();
    state.controls = { isLocked: false, getObject: () => state.camera } as any;
    state.isPlaying = true; state.isMultiplayer = true;
    rebuildEnvironmentWithSeed(42); resetPlayerState(); state.playerHp = 2;
    const pool = state.lavaPools[0]; state.camera.position.set(pool.position.x, 2, pool.position.z);
    setDamageHandlers(() => {}, amount => { hits++; state.playerHp = Math.max(0, state.playerHp - amount); state.lastDamageTime = now; });
    try {
        checkLavaDamage(); assert.equal(state.playerHp, 1);
        checkLavaDamage(); assert.equal(hits, 1);
        now += LAVA_DAMAGE_TICK_MS; checkLavaDamage(); assert.equal(state.playerHp, 0);
        now += LAVA_DAMAGE_TICK_MS; checkLavaDamage(); assert.equal(hits, 2);
        resetPlayerState(); checkLavaDamage(); assert.equal(hits, 3);
        state.isMultiplayer = false; now += LAVA_DAMAGE_TICK_MS; checkLavaDamage(); assert.equal(hits, 3);
        (state.controls as any).isLocked = true; checkLavaDamage(); assert.equal(hits, 4);
    } finally { disposeWorld(); state.isMultiplayer = false; }
});
