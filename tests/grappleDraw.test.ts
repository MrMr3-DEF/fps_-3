import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GRAPPLE_DRAW_TIME, HEAVY_HANDOFF_TIME, PLAYER_HEIGHT } from '../src/config.ts';
import { toggleGrapplingHook, updateHook } from '../src/grapple.ts';
import { WeaponHandling } from '../src/weaponHandling.ts';
import { getPlayerAvatar, PlayerAvatarController } from '../src/playerAvatar.ts';
import { resetPlayerState, state } from '../src/state.ts';
import { createAkimboGuns, createPlayerMesh, disposePlayerVisuals, prepareLocalPlayerAvatar,
    updatePlayerAvatarPose } from '../src/weapons.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';

test('a fired rifle releases the grapple only after the actual left-hand launcher is raised and visible', async () => {
    await loadCyborgTestAssets();
    resetPlayerState();
    const camera = new THREE.PerspectiveCamera(75, 16/9, .1, 1500);
    camera.position.y = PLAYER_HEIGHT;
    state.camera = camera;
    state.controls = {getObject: () => camera} as typeof state.controls;
    state.scene = new THREE.Scene();
    state.hookMesh = new THREE.Mesh();
    state.canJump = true;
    state.activeWeaponName = state.desiredWeaponName = 'AR';
    state.weaponHandling.reset('AR');
    try {
        createAkimboGuns();
        createPlayerMesh();
        prepareLocalPlayerAvatar();
        const rig = getPlayerAvatar(state.playerMesh)!.rig;
        const carry = rig.root.getObjectByName('GrappleCarry')!;
        const park = rig.root.getObjectByName('GrapplePark')!;
        const flash = state.leftGun!.userData.muzzleFlashEffect;
        const flashing = () => flash.frames.some((ring: THREE.Mesh) => ring.visible);
        assert.ok(state.weaponHandling.spendShot('AR', 0));
        toggleGrapplingHook();
        const releasedAt = new THREE.Vector3();
        const at = (time: number, frameTime: number) => {
            state.weaponTime = time;
            state.weaponHandling.advance(time);
            updateHook(frameTime, undefined, () => {
                updatePlayerAvatarPose();
                rig.grappleMuzzle.getWorldPosition(releasedAt);
            });
            updatePlayerAvatarPose(frameTime);
        };
        at(.02, .02);
        assert.ok(park.scale.x > .99 && carry.scale.x < .01);
        assert.equal(state.hookState, 'IDLE');
        assert.equal(flashing(), false);

        at(GRAPPLE_DRAW_TIME, .05);
        assert.equal(state.hookState, 'IDLE', 'recent heavy fire extends the draw beyond an ordinary one');
        at(HEAVY_HANDOFF_TIME - .035, .05);
        assert.ok(park.scale.x < .01 && carry.scale.x > .99);
        camera.updateMatrixWorld(true);
        const glove = rig.leftGrip.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(glove.x) < .95 && Math.abs(glove.y) < .95, 'the gripping hand can be seen before the shot');
        const raised = rig.grappleMuzzle.getWorldPosition(new THREE.Vector3());
        assert.equal(state.hookState, 'IDLE');
        assert.equal(flashing(), false);

        at(HEAVY_HANDOFF_TIME, .035);
        assert.equal(state.hookState, 'FIRING');
        assert.equal(flashing(), true);
        assert.ok(raised.distanceTo(releasedAt) < .015, 'the raised muzzle is already aligned before recoil');
        assert.ok(state.hookPosition.distanceTo(releasedAt) < 1e-6, 'flight starts at the fitted muzzle without borrowing time from the draw');
    } finally {
        state.hookMesh.removeFromParent();
        state.hookMesh.geometry.dispose();
        (state.hookMesh.material as THREE.Material).dispose();
        state.hookMesh = null;
        disposePlayerVisuals();
        state.camera = state.controls = state.scene = null;
        resetPlayerState();
    }
});

test('a late observer retains the outgoing light primary until the grapple is seated', async () => {
    await loadCyborgTestAssets();
    const avatar = new PlayerAvatarController(new THREE.Group(), 0xffffff);
    const owner = new WeaponHandling('SHOTGUN'), observer = new WeaponHandling();
    owner.equip('SNIPER', 0, 'SHOTGUN');
    try {
        for (const t of [.20, .29, .30, .51, .53]) {
            const snapshot = owner.snapshot(t);
            observer.restore(snapshot, t);
            // The logical primary has already changed before this observer joins.
            avatar.update(.016, {weapon:'SNIPER', grounded:true, velocity:new THREE.Vector3(),
                yaw:0, pitch:0, hover:false, hook:'IDLE', alive:true, lifeId:1, handling:{
                    hand:observer.hand, handWeapon:observer.handWeapon, outgoingLight:observer.outgoingLight,
                    handProgress:t / HEAVY_HANDOFF_TIME, chargeStage:4}});
            const carried = avatar.rig.root.getObjectByName('GrappleCarry')!.scale.x > .5;
            assert.equal(avatar.rig.props.SHOTGUN.visible, carried);
            assert.equal(avatar.rig.props.SNIPER.visible, !carried);
            assert.equal(owner.canFire('SNIPER', t), t >= HEAVY_HANDOFF_TIME);
        }
    } finally { avatar.dispose(); }
});
