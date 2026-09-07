import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.js';
import { placePlayerAtTownSpawn, resetPlayerAtTownSpawn } from '../src/playerSpawn.js';
import { updatePowerJumpOnCastleExit } from '../src/powerJump.js';
import { TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from '../src/config.js';

const edge = TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2;
function fresh() { resetPlayerState(); state.isPlaying = true; }

test('power jump starts off and activates only beyond each outer castle wall', () => {
    for (const axis of ['x', 'z'] as const) for (const side of [-1, 1]) {
        fresh();
        const p = { x: 0, z: 0 };
        assert.equal(state.powerJumpEnabled, false);
        for (const distance of [0, TOWN_HALF_SIZE - 1, TOWN_HALF_SIZE, edge]) {
            p[axis] = side * distance;
            updatePowerJumpOnCastleExit(p);
            assert.equal(state.powerJumpEnabled, false, 'courtyard, gate and rampart remain inside');
            assert.equal(state.powerJumpAutoActivated, false);
        }
        p[axis] = side * (edge + .01);
        updatePowerJumpOnCastleExit(p);
        assert.equal(state.powerJumpEnabled, true);
        assert.equal(state.powerJumpAutoActivated, true);
    }
});

test('after first exit, reentry and subsequent exits preserve manual toggle choices', () => {
    fresh();
    updatePowerJumpOnCastleExit({ x: edge + 1, z: 0 });
    updatePowerJumpOnCastleExit({ x: 0, z: 0 });
    assert.equal(state.powerJumpEnabled, true, 'returning inside does not turn it off');
    state.powerJumpEnabled = false;
    for (const x of [edge + 1, 0, -edge - 1, 0, edge + 1]) {
        updatePowerJumpOnCastleExit({ x, z: 0 });
        assert.equal(state.powerJumpEnabled, false, 'automatic activation is consumed until a new match');
    }
    state.powerJumpEnabled = true;
    updatePowerJumpOnCastleExit({ x: 0, z: 0 });
    assert.equal(state.powerJumpEnabled, true);
});

test('new matches and multiplayer house placement rearm automatic activation', () => {
    state.camera = new THREE.PerspectiveCamera();
    state.controls = { getObject: () => state.camera } as any;
    for (const spawn of [() => resetPlayerAtTownSpawn(42, 'house'), () => placePlayerAtTownSpawn(42, 'house', 1)]) {
        fresh();
        updatePowerJumpOnCastleExit({ x: edge + 1, z: 0 });
        spawn();
        assert.equal(state.powerJumpEnabled, false);
        assert.equal(state.powerJumpAutoActivated, false);
        updatePowerJumpOnCastleExit(state.camera.position);
        assert.equal(state.powerJumpEnabled, false);
        updatePowerJumpOnCastleExit({ x: 0, z: -edge - 1 });
        assert.equal(state.powerJumpEnabled, true);
    }
});

test('menus and dead players cannot consume the first-exit activation', () => {
    fresh();
    state.isPlaying = false;
    updatePowerJumpOnCastleExit({ x: edge + 1, z: 0 });
    assert.equal(state.powerJumpAutoActivated, false);
    state.isPlaying = true;
    state.playerHp = 0;
    updatePowerJumpOnCastleExit({ x: edge + 1, z: 0 });
    assert.equal(state.powerJumpAutoActivated, false);
    assert.equal(state.powerJumpEnabled, false);
});


test('church respawns preserve on/off choice and first-exit activation history', () => {
    state.camera = new THREE.PerspectiveCamera();
    state.controls = { getObject: () => state.camera } as any;
    for (const enabled of [false, true]) for (const activated of [false, true]) {
        fresh();
        state.powerJumpEnabled = enabled;
        state.powerJumpAutoActivated = activated;
        state.playerHp = 0;
        resetPlayerAtTownSpawn(42, 'church');
        assert.equal(state.powerJumpEnabled, enabled);
        assert.equal(state.powerJumpAutoActivated, activated);
        assert.equal(state.playerHp, state.playerMaxHp);
        updatePowerJumpOnCastleExit({ x: edge + 1, z: 0 });
        assert.equal(state.powerJumpEnabled, activated ? enabled : true);
    }
});
