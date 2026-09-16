import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    PROJECTILE_HOMING_MAX_TURN_RATE,
    PROJECTILE_HOMING_START_FRACTION,
    isWithinHomingAimEnvelope,
    steerHomingDirection,
} from '../src/projectileHoming.ts';
import { state } from '../src/state.ts';
import { updateProjectiles, resetProjectiles } from '../src/projectiles.ts';
import { rebuildTargetHash } from '../src/world.ts';
import { setDamageHandlers } from '../src/damage.ts';

test('homing steering is strong but finite rather than a guaranteed snap', () => {
    const current = new THREE.Vector3(0, 0, -1);
    const desired = new THREE.Vector3(1, 0, -1).normalize();
    const before = current.angleTo(desired);
    const steered = steerHomingDirection(current, desired, 1 / 60);
    const after = steered.angleTo(desired);
    const turn = current.angleTo(steered);
    assert.ok(after < before * 0.75, `expected strong correction, got ${before} -> ${after}`);
    assert.ok(after > 0.01, 'one frame must not guarantee an exact target direction');
    assert.ok(
        turn <= PROJECTILE_HOMING_MAX_TURN_RATE / 60 + 1e-9,
        'one frame respects the angular turn-rate cap',
    );
});

test('authority aiming envelope accepts scan-box aim and rejects side or rear locks', () => {
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);
    assert.equal(isWithinHomingAimEnvelope(
        origin, direction, new THREE.Vector3(1.5, 0, -50), 1, 700,
    ), true);
    assert.equal(isWithinHomingAimEnvelope(
        origin, direction, new THREE.Vector3(8, 0, -50), 1, 700,
    ), false);
    assert.equal(isWithinHomingAimEnvelope(
        origin, direction, new THREE.Vector3(0, 0, 10), 1, 700,
    ), false);
});

test('projectile flies straight for one third of the firing distance before homing begins', () => {
    state.scene = new THREE.Scene();
    state.isMultiplayer = false;
    state.peerIds = [];
    state.peers = {};
    state.obstacles = [];
    state.projectilePool = [];

    const target = new THREE.Group();
    target.position.set(4, 2, -40);
    target.userData = { index: 0, scale: 1, hp: 10, eliminationRevision: 0 };
    state.targets = [target];
    rebuildTargetHash();
    setDamageHandlers(() => {}, () => {});

    const bullet = new THREE.Object3D();
    bullet.position.set(0, 2, 0);
    bullet.userData = {
        dx: 0, dy: 0, dz: -1, age: 0, distanceTraveled: 0,
        visualOnly: false, damage: 1, shotId: 1, pelletIndex: 0,
        homingTarget: { kind: 'npc', object: target, targetIndex: 0, targetRevision: 0 },
        homingStartDistance: target.position.distanceTo(bullet.position) * PROJECTILE_HOMING_START_FRACTION,
    };
    state.projectiles = [bullet];

    updateProjectiles(0.01, 'Pilot');
    assert.equal(bullet.userData.dx, 0, 'the first nine units stay completely unguided');
    updateProjectiles(0.01, 'Pilot');
    assert.ok(bullet.userData.dx > 0, 'steering begins as the bullet crosses one third of the initial distance');

    resetProjectiles();
    state.targets = [];
    state.scene = null;
    rebuildTargetHash();
});
