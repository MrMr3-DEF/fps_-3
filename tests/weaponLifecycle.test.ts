import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.ts';
import { createAkimboGuns, createPlayerMesh, prepareLocalPlayerAvatar, disposePlayerVisuals, updateWeapons, setThirdPerson, resetWeaponPresentation, updatePlayerAvatarPose } from '../src/weapons.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';
import { getPlayerAvatar } from '../src/playerAvatar.ts';
import { PLAYER_BODY_CAMERA_OFFSET } from '../src/playerHitbox.ts';
import { advanceWeaponState, initialWeaponState } from '../src/shotAuthority.ts';
import { SWITCH_DURATION, NETWORK_TICK_MS } from '../src/config.ts';
import { selectedWeaponIcon } from '../src/weaponIndicator.ts';

Object.assign(globalThis, { document: { getElementById: () => null } });
function setup() {
    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera();
    state.controls = { getObject: () => state.camera, isLocked: true } as any;
    state.isThirdPerson = state.isThirdPersonView = state.keyCActive = false;
    state.activeWeaponName = state.desiredWeaponName = 'PISTOL';
    createAkimboGuns(); createPlayerMesh();
}
test('HUD selection follows the committed visual swap rather than queued weapon input', () => {
    setup(); resetPlayerState(); resetWeaponPresentation();
    try {
        state.desiredWeaponName = 'SHOTGUN'; updateWeapons(0);
        assert.equal(state.switchState, 'WITHDRAWING');
        assert.equal(selectedWeaponIcon(state.activeWeaponName, false), 'PISTOL');
        updateWeapons(SWITCH_DURATION / 2);
        assert.equal(selectedWeaponIcon(state.activeWeaponName, false), 'PISTOL');
        updateWeapons(SWITCH_DURATION / 2 + 0.001);
        assert.equal(state.switchState, 'BRINGING_IN');
        assert.equal(selectedWeaponIcon(state.activeWeaponName, false), 'SHOTGUN');
        assert.equal(selectedWeaponIcon(state.activeWeaponName, true), 'ROCKET');
    } finally { disposePlayerVisuals(); resetPlayerState(); resetWeaponPresentation(); }
});
test('an authored inspection moves the visible gun while both logical anchors stay fixed', async () => {
    await loadCyborgTestAssets();
    setup(); resetPlayerState(); prepareLocalPlayerAvatar();
    try {
        state.canJump = true;
        updatePlayerAvatarPose(1);
        const visual = getPlayerAvatar(state.playerMesh)!.rig.muzzleFor('PISTOL');
        const ready = visual.getWorldPosition(new THREE.Vector3());
        const logical = state.rightGun!.getWorldPosition(new THREE.Vector3());
        const grapple = state.leftGun!.getWorldPosition(new THREE.Vector3());
        state.inspectState = 'INSPECTING';
        updateWeapons(.8); updatePlayerAvatarPose(.8);
        assert.ok(visual.getWorldPosition(new THREE.Vector3()).distanceTo(ready) > .05);
        assert.ok(state.rightGun!.getWorldPosition(new THREE.Vector3()).equals(logical));
        assert.ok(state.leftGun!.getWorldPosition(new THREE.Vector3()).equals(grapple));
        setThirdPerson(true);
        assert.equal(state.inspectState, 'IDLE');
        assert.equal(state.rightGunContainer!.parent, state.camera);
    } finally { disposePlayerVisuals(); }
});
test('a per-life reset retains equipped weapons and match state but clears both switch phases and held input', () => {
    setup();
    try {
        state.score = 7; state.dayNightElapsedSeconds = 50; state.gogglesFailure.bricked = true;
        for (const phase of ['WITHDRAWING', 'BRINGING_IN'] as const) {
            state.activeWeaponName = phase === 'WITHDRAWING' ? 'PISTOL' : 'SNIPER';
            const equipped = state.activeWeaponName;
            state.nextWeaponName = state.desiredWeaponName = 'SNIPER'; state.switchState = phase; state.switchTimer = 0.1;
            state.isMouseDown = state.isHovering = state.isShiftDown = true;
            resetPlayerState(); resetWeaponPresentation();
            assert.equal(state.activeWeaponName, equipped); assert.equal(state.desiredWeaponName, equipped);
            assert.equal(state.nextWeaponName, null); assert.equal(state.switchState, 'IDLE'); assert.equal(state.switchTimer, 0);
            assert.equal(state.isMouseDown || state.isHovering || state.isShiftDown, false);
            assert.equal(state.sniperMesh!.visible, equipped === 'SNIPER');
            assert.equal(state.score, 7); assert.equal(state.dayNightElapsedSeconds, 50); assert.equal(state.gogglesFailure.bricked, true);
        }
    } finally { disposePlayerVisuals(); }
});
test('avatar presentation takes the final movement/hook pose without moving weapon simulation later', () => {
    setup();
    try {
        state.camera!.position.set(1, 5, 3); updatePlayerAvatarPose(); updateWeapons(0.01);
        state.camera!.position.set(10, 12, 14); state.camera!.rotation.y = 0.4;
        updatePlayerAvatarPose();
        assert.deepEqual(state.playerMesh!.position.toArray(), [10, 12 - PLAYER_BODY_CAMERA_OFFSET, 14]);
        assert.ok(Math.abs(state.playerMesh!.rotation.y - 0.4) < 1e-9);
    } finally { disposePlayerVisuals(); }
});

test('a switch begun after a long frame still publishes two host-verifiable animation phases', () => {
    for (const firstDelta of [1 / 240, 1 / 60, 0.05]) {
        setup();
        try {
            Object.assign(state, { switchState: 'IDLE', switchTimer: 0, nextWeaponName: null, desiredWeaponName: 'SNIPER' });
            let accepted = initialWeaponState('PISTOL'), now = 1000;
            const packet = () => ({ activeWeapon: state.activeWeaponName, switchState: state.switchState,
                nextWeapon: state.switchState === 'IDLE' ? null : state.nextWeaponName } as any);
            updateWeapons(firstDelta); now += firstDelta * 1000;
            accepted = advanceWeaponState(accepted, packet(), now)!;
            const intentAt = now;
            for (let step = 0; state.switchState !== 'IDLE' && step < 100; step++) {
                const phase = state.switchState;
                updateWeapons(1 / 120); now += 1000 / 120;
                if (phase === state.switchState) continue;
                const next = advanceWeaponState(accepted, packet(), now);
                assert.ok(next, `first-frame delta ${firstDelta} must not shorten the received ${phase} phase`);
                accepted = next;
            }
            assert.equal(state.switchState, 'IDLE');
            assert.ok(now - intentAt >= 2 * SWITCH_DURATION * 1000 - NETWORK_TICK_MS);
            assert.equal(accepted.activeWeapon, 'SNIPER'); assert.equal(accepted.switchState, 'IDLE');
        } finally { disposePlayerVisuals(); }
    }
});
