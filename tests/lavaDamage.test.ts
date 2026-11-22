import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.ts';
import { rebuildEnvironmentWithSeed, disposeWorld, isInLavaAt, getTerrainHeightAt } from '../src/world.ts';
import { checkLavaDamage } from '../src/lavaDamage.ts';
import { setDamageHandlers } from '../src/damage.ts';
import { updatePlayerPhysics } from '../src/physics.ts';
import { LAVA_DAMAGE_TICK_MS, LAVA_SPEED_MULTIPLIER, PLAYER_HEIGHT } from '../src/config.ts';
import { getLavaPoolDescriptor, getLavaPitFloorY } from '../src/lavaPools.ts';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });

function setupWorld() {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.controls = { isLocked: true, getObject: () => state.camera } as any;
    state.isPlaying = true; state.isMultiplayer = false;
    rebuildEnvironmentWithSeed(42); resetPlayerState();
    state.scene.updateMatrixWorld(true);
}

test('offline lava uses an independent simulation clock and never harms dead lives', () => {
    setupWorld();
    state.playerHp = 2;
    const pool = state.lavaPools[0]; state.camera.position.set(pool.position.x, 2, pool.position.z);
    setDamageHandlers(() => ({ accepted: false, killed: false }), amount => {
        state.playerHp = Math.max(0, state.playerHp - amount); state.regenDelayMs = 4000;
    });
    try {
        checkLavaDamage(0); assert.equal(state.playerHp, 1);
        checkLavaDamage(0); assert.equal(state.playerHp, 1);
        checkLavaDamage(LAVA_DAMAGE_TICK_MS / 1000); assert.equal(state.playerHp, 0);
        checkLavaDamage(LAVA_DAMAGE_TICK_MS / 1000); assert.equal(state.playerHp, 0);
        resetPlayerState(); checkLavaDamage(0); assert.equal(state.playerHp, state.playerMaxHp - 1);
        state.isMultiplayer = true; checkLavaDamage(1); assert.equal(state.playerHp, state.playerMaxHp - 1);
    } finally { disposeWorld(); state.isMultiplayer = false; }
});

test('organic lava pits slow grounded movement to 0.7x and are walkable in and out without jumping', () => {
    setupWorld();
    try {
        const pool = state.lavaPools[0];
        const descriptor = getLavaPoolDescriptor(pool)!;
        assert.ok(descriptor);
        const floorY = getLavaPitFloorY(descriptor.x, descriptor.z, [pool]);
        assert.ok(floorY < -0.7 && floorY >= -0.8, 'pit center approaches the authored 0.8-unit depth');
        assert.ok(isInLavaAt(descriptor.x, descriptor.z, -0.8, 0.2), 'pit center is molten at the floor');
        assert.equal(isInLavaAt(descriptor.x + descriptor.boundRadius + 3, descriptor.z, 0, 0.2), false,
            'dry bank outside the rim');
        assert.equal(getTerrainHeightAt(descriptor.x, descriptor.z), floorY);
        assert.equal(getTerrainHeightAt(descriptor.x + descriptor.boundRadius + 3, descriptor.z), 0);

        state.camera.quaternion.identity();
        state.camera.position.set(descriptor.x, PLAYER_HEIGHT + floorY, descriptor.z);
        state.canJump = true;
        state.moveForward = true;
        for (let frame = 0; frame < 15; frame++) updatePlayerPhysics(1 / 60);
        const lavaSpeed = Math.hypot(state.velocity.x, state.velocity.z);

        // Repeat on the dry bank beyond the conservative bound radius. Both runs
        // share acceleration and friction, so only the 0.7x cap differs.
        state.moveForward = false; state.moveBackward = false;
        state.velocity.set(0, 0, 0);
        state.camera.position.set(descriptor.x, PLAYER_HEIGHT, descriptor.z + descriptor.boundRadius + 3);
        state.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        state.canJump = true;
        state.moveForward = true;
        for (let frame = 0; frame < 15; frame++) updatePlayerPhysics(1 / 60);
        const drySpeed = Math.hypot(state.velocity.x, state.velocity.z);
        assert.ok(lavaSpeed > 0 && drySpeed > 0);
        assert.ok(Math.abs(lavaSpeed / drySpeed - LAVA_SPEED_MULTIPLIER) < 0.005,
            `lava speed ratio ${lavaSpeed / drySpeed} is ${LAVA_SPEED_MULTIPLIER}`);

        // Walk out of the basin and back in from its center. No jump input is
        // ever set; the gentle banks and descent snap must carry the player.
        resetPlayerState();
        state.camera.quaternion.identity();
        state.camera.position.set(descriptor.x, PLAYER_HEIGHT + floorY, descriptor.z);
        state.canJump = true;
        state.moveForward = true;
        let lowestY = state.camera.position.y;
        let highestUpwardVelocity = 0;
        for (let frame = 0; frame < 400; frame++) {
            updatePlayerPhysics(1 / 60);
            lowestY = Math.min(lowestY, state.camera.position.y);
            highestUpwardVelocity = Math.max(highestUpwardVelocity, state.velocity.y);
            if (Math.hypot(state.camera.position.x - descriptor.x, state.camera.position.z - descriptor.z) >
                descriptor.boundRadius + 2) break;
        }
        assert.ok(lowestY > PLAYER_HEIGHT - 0.85, 'stays on the authored 0.8-unit floor');
        assert.equal(state.canJump, true);
        assert.equal(state.velocity.y, 0);
        assert.equal(state.camera.position.y, PLAYER_HEIGHT, 'walks back up to grade');

        state.moveForward = false;
        state.moveBackward = true;
        for (let frame = 0; frame < 400; frame++) {
            updatePlayerPhysics(1 / 60);
            lowestY = Math.min(lowestY, state.camera.position.y);
            highestUpwardVelocity = Math.max(highestUpwardVelocity, state.velocity.y);
            if (Math.hypot(state.camera.position.x - descriptor.x, state.camera.position.z - descriptor.z) < 1) break;
        }
        assert.ok(lowestY < PLAYER_HEIGHT - 0.5, 'descends into the recessed pit');
        assert.ok(highestUpwardVelocity <= 1e-9, 'neither direction requires a jump');
        assert.equal(state.canJump, true);
    } finally { disposeWorld(); }
});
