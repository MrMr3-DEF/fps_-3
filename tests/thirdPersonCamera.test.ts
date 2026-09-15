import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    resolveThirdPersonAimTarget,
    resolveThirdPersonCameraPosition,
    shouldUseThirdPersonView,
} from '../src/thirdPersonCamera.ts';
import { state } from '../src/state.ts';
import { setThirdPerson, syncThirdPersonPresentation } from '../src/weapons.ts';

test('third-person mode uses a shoulder camera until C is held', () => {
    assert.equal(shouldUseThirdPersonView(false, false), false);
    assert.equal(shouldUseThirdPersonView(true, false), true);
    assert.equal(shouldUseThirdPersonView(true, true), false);
});

test('third-person camera frames the avatar over the right shoulder', () => {
    const resolved = resolveThirdPersonCameraPosition(
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion(),
        [],
        new THREE.Vector3(),
    );

    assert.deepEqual(resolved.toArray(), [1.5, 3.2, 5.5]);
    assert.deepEqual(resolveThirdPersonAimTarget(
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(),
    ).toArray(), [0, 2, -25]);
});

test('third-person camera boom stays level at the vertical pitch limits', () => {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'YXZ'));
    const resolved = resolveThirdPersonCameraPosition(
        new THREE.Vector3(0, 2, 0),
        quaternion,
        [],
        new THREE.Vector3(),
    );

    assert.ok(Math.abs(resolved.y - 3.2) < 1e-12);
    assert.ok(Math.abs(Math.hypot(resolved.x, resolved.z) - Math.hypot(1.5, 5.5)) < 1e-12);
});

test('third-person camera pulls in before a wall instead of clipping through it', () => {
    const wall = new THREE.Object3D();
    wall.position.set(0, 2, 3);
    Object.assign(wall.userData, {
        height: 4,
        halfW: 10,
        halfD: 0.25,
        halfH: 2,
    });

    const resolved = resolveThirdPersonCameraPosition(
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion(),
        [wall],
        new THREE.Vector3(),
    );

    assert.ok(resolved.z < 2.5, `camera stopped at z=${resolved.z}`);
    assert.ok(resolved.z > 0, 'camera still moves toward its shoulder position');
});

test('holding C swaps the avatar weapons into first person and restores the saved mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const player = new THREE.Group();
    const leftGun = new THREE.Group();
    const rightGun = new THREE.Group();

    state.camera = camera;
    state.playerMesh = player;
    state.leftGun = leftGun;
    state.rightGunContainer = rightGun;
    state.playerHp = 10;
    state.keyCActive = false;

    setThirdPerson(true);
    assert.equal(state.isThirdPerson, true);
    assert.equal(state.isThirdPersonView, true);
    assert.equal(player.visible, true);
    assert.equal(leftGun.parent, player);
    assert.equal(rightGun.parent, player);

    state.keyCActive = true;
    syncThirdPersonPresentation();
    assert.equal(state.isThirdPerson, true, 'C does not discard the saved camera mode');
    assert.equal(state.isThirdPersonView, false);
    assert.equal(player.visible, false);
    assert.equal(leftGun.parent, camera);
    assert.equal(rightGun.parent, camera);

    state.keyCActive = false;
    syncThirdPersonPresentation();
    assert.equal(state.isThirdPersonView, true);
    assert.equal(leftGun.parent, player);
    assert.equal(rightGun.parent, player);

    setThirdPerson(false);
    state.camera = null;
    state.playerMesh = null;
    state.leftGun = null;
    state.rightGunContainer = null;
});
