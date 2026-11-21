import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    resolveThirdPersonAimTarget,
    resolveThirdPersonCameraPosition,
    shouldUseThirdPersonView,
} from '../src/thirdPersonCamera.ts';
import { CyborgAvatar } from '../src/cyborgAvatar.ts';
import { CYBORG_SCALE } from '../src/playerAvatar.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';
import { DEFAULT_FOV, PLAYER_HEIGHT } from '../src/config.ts';
import { state } from '../src/state.ts';
import { createAkimboGuns, createPlayerMesh, prepareLocalPlayerAvatar, disposePlayerVisuals, setThirdPerson, syncThirdPersonPresentation } from '../src/weapons.ts';

test('third-person mode uses a shoulder camera until C is held', () => {
    assert.equal(shouldUseThirdPersonView(false, false), false);
    assert.equal(shouldUseThirdPersonView(true, false), true);
    assert.equal(shouldUseThirdPersonView(true, true), false);
});

test('third-person camera frames the running avatar over the right shoulder', async () => {
    const eye = new THREE.Vector3(0, PLAYER_HEIGHT, 0), forward = new THREE.Quaternion();
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 9);
    resolveThirdPersonCameraPosition(eye, forward, [], camera.position);
    const target = resolveThirdPersonAimTarget(eye, forward, new THREE.Vector3());
    camera.lookAt(target);
    camera.updateMatrixWorld(true);

    const visor = eye.clone().project(camera), feet = new THREE.Vector3().project(camera);
    assert.ok(visor.x < 0 && visor.x > -1, 'avatar leaves the crosshair clear');
    assert.ok(feet.y > -1 && visor.y < 1, 'head and feet fit when looking level');
    assert.ok((visor.y - feet.y) / 2 > .38, 'on-foot avatar occupies a substantial part of the view');
    assert.ok(target.z < 0 && target.y === eye.y && target.x === eye.x);

    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0xffffff);
    avatar.root.scale.setScalar(CYBORG_SCALE);
    avatar.root.rotation.y = Math.PI;
    const ankles = ['footL', 'footR'].map(name => avatar.root.getObjectByName(name)!);
    const point = new THREE.Vector3();
    try {
        for (const direction of ['Forward', 'Backward', 'Left', 'Right']) {
            for (let frame = 0; frame < 60; frame += 3) {
                avatar.pose({body:'Run.' + direction, bodyTime:frame/120, weapon:'AR'});
                for (const ankle of ankles) {
                    assert.ok(ankle.getWorldPosition(point).project(camera).y > -.92,
                        'the trailing ankle leaves room for the boot at the bottom of the view');
                }
            }
        }
    } finally { avatar.dispose(); }
});

test('third-person camera boom stays level at the vertical pitch limits', () => {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'YXZ'));
    const resolved = resolveThirdPersonCameraPosition(
        new THREE.Vector3(0, 2, 0),
        quaternion,
        [],
        new THREE.Vector3(),
    );

    const level = resolveThirdPersonCameraPosition(new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), [], new THREE.Vector3());
    assert.ok(resolved.distanceTo(level) < 1e-10);
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

test('holding C switches between the fitted arms and full suit while logical firing anchors stay put', async () => {
    await loadCyborgTestAssets();
    state.camera = new THREE.PerspectiveCamera();
    state.scene = new THREE.Scene();
    state.playerHp = 10;
    state.keyCActive = false;
    createAkimboGuns(); createPlayerMesh(); prepareLocalPlayerAvatar();
    try {
        const shell = state.playerMesh!;
        let visor: THREE.SkinnedMesh | undefined;
        shell.traverse(node => {
            if (node instanceof THREE.SkinnedMesh && node.material.name === 'Visor_Smoked_Glass') visor = node;
        });
        assert.ok(visor);
        const left = state.leftGun!, right = state.rightGunContainer!;
        const fixed = right.getWorldPosition(new THREE.Vector3());
        setThirdPerson(true);
        assert.equal(visor!.visible, true);
        state.keyCActive = true;
        syncThirdPersonPresentation();
        assert.equal(state.isThirdPerson, true);
        assert.equal(state.isThirdPersonView, false);
        assert.equal(shell.visible, true);
        assert.equal(visor!.visible, false);
        state.keyCActive = false;
        syncThirdPersonPresentation();
        assert.equal(state.isThirdPersonView, true);
        assert.equal(visor!.visible, true);
        assert.equal(left.parent, state.camera);
        assert.equal(right.parent, state.camera);
        assert.ok(right.getWorldPosition(new THREE.Vector3()).equals(fixed));
    } finally { disposePlayerVisuals(); setThirdPerson(false); state.scene = null; state.camera = null; }
});
