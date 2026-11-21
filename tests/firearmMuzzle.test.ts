import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FIREARM_MUZZLE_REACH, MINIGUN_RAMP_TIME, WEAPON_STATS } from '../src/config.ts';
import { FirstPersonReloadFrame } from '../src/firstPersonReload.ts';
import { disposeParticles } from '../src/particles.ts';
import { getPlayerAvatar } from '../src/playerAvatar.ts';
import { disposeProjectiles, resetProjectiles } from '../src/projectiles.ts';
import { resetPlayerState, state } from '../src/state.ts';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.ts';
import { createAkimboGuns, createPlayerMesh, disposePlayerVisuals, fireProjectile,
    prepareLocalPlayerAvatar, resetWeaponPresentation, updatePlayerAvatarPose } from '../src/weapons.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';

test('each fitted barrel supplies its flash, bullet or beam, first tracer vertex, and network origin', async () => {
    await loadCyborgTestAssets();
    const holder = new FirstPersonReloadFrame();
    const camera = new THREE.PerspectiveCamera(15, 16 / 9, .1, 1500);
    camera.position.set(6, 8, 3);
    camera.rotation.set(-.35, .9, 0, 'YXZ');
    state.scene = new THREE.Scene();
    state.camera = camera;
    state.controls = { getObject: () => camera } as typeof state.controls;
    resetPlayerState();
    state.isMultiplayer = true;
    const origin = new THREE.Vector3(), aim = new THREE.Vector3(), contact = new THREE.Vector3();
    let packets = 0;
    setWeaponNetworkPort({
        broadcastLocalFire(position, direction, end) {
            packets++; origin.copy(position); aim.copy(direction);
            if (end) contact.copy(end);
        },
        broadcastToAll() {}, flashPeerMesh() {},
    });
    try {
        createAkimboGuns(); createPlayerMesh(); prepareLocalPlayerAvatar();
        const avatar = getPlayerAvatar(state.playerMesh)!;
        const rig = avatar.rig;
        for (const weapon of ['PISTOL', 'SHOTGUN', 'AR', 'MINIGUN', 'SNIPER'] as const) {
            resetProjectiles();
            state.activeWeaponName = weapon;
            resetPlayerState(); resetWeaponPresentation();
            state.canJump = true;
            state.minigunRamp = MINIGUN_RAMP_TIME;
            for (let frame = 0; frame < 13; frame++) updatePlayerAvatarPose(.1);
            if (weapon === 'MINIGUN') {
                const gun = rig.props.MINIGUN;
                const body = gun.getObjectByName('Body')!;
                const bores = gun.getObjectByName('Rotor')!.children.filter(b => b.name.startsWith('Bore'));
                assert.equal(bores.length, 6);
                const winners = new Set<string>();
                for (let frame = 0; frame < 24; frame++) {
                    updatePlayerAvatarPose(.017);
                    const ranked = bores.map(bore => ({
                        bore, point:body.worldToLocal(bore.getWorldPosition(new THREE.Vector3())),
                    })).sort((a,b) => b.point.z - a.point.z);
                    const upper = ranked[0];
                    winners.add(upper.bore.name);
                    assert.ok(upper.point.distanceTo(rig.muzzle.position) < 1e-5);
                }
                assert.equal(winners.size, 6, 'every spinning bore can become the highest aperture');
            }
            const aperture = rig.muzzleFor(weapon).getWorldPosition(new THREE.Vector3());
            const visible = aperture.clone();
            state.isThirdPersonView = weapon === 'AR';
            if (!state.isThirdPersonView) {
                holder.begin(rig, camera, avatar.poseForView!, .016);
                rig.muzzle.getWorldPosition(visible).project(holder.camera).unproject(camera);
                holder.restore();
                assert.ok(aperture.distanceTo(visible) > .05, 'the scoped foreground uses its own projection');
            }
            const before = packets;
            fireProjectile();
            assert.equal(packets, before + 1, weapon);
            assert.ok(origin.distanceTo(aperture) < 1e-6, weapon);
            assert.ok(origin.distanceTo(camera.position) <= FIREARM_MUZZLE_REACH[weapon], weapon);
            assert.ok(aim.distanceTo(camera.getWorldDirection(new THREE.Vector3())) < 1e-6, weapon);
            const flash = state.rightGun!.userData.muzzleFlashEffect.frames.find((ring: THREE.Mesh) => ring.visible);
            assert.ok(flash && flash.getWorldPosition(new THREE.Vector3()).distanceTo(origin) < 1e-6, weapon);
            if (weapon === 'SNIPER') {
                const beam = state.activeParticles.find(p => p.kind === 'sniper-trail')!.mesh!;
                assert.ok(beam.position.clone().multiplyScalar(2).sub(contact).distanceTo(visible) < 1e-6);
            } else {
                const trails = state.scene.children.filter(object => object instanceof THREE.Line);
                assert.equal(trails.length, WEAPON_STATS[weapon].pellets ?? 1);
                assert.equal(state.projectiles.length, trails.length);
                for (const bullet of state.projectiles) {
                    assert.ok(bullet.position.distanceTo(visible) < 1e-6);
                    assert.ok(bullet.userData.shotOrigin.distanceTo(aperture) < 1e-6);
                }
                for (const trail of trails) {
                    const tail = new THREE.Vector3().fromBufferAttribute(trail.geometry.getAttribute('position'), 0);
                    assert.ok(tail.distanceTo(visible) < 1e-5);
                }
            }
        }
        // Place the eye just above ground with the fitted muzzle below it.
        camera.position.y = .25;
        camera.rotation.x = -1.35;
        const remaining = state.weaponHandling.rounds.SNIPER, before = packets;
        fireProjectile();
        assert.equal(packets, before, 'a muzzle across cover cannot fire');
        assert.equal(state.weaponHandling.rounds.SNIPER, remaining);
    } finally {
        holder.clear();
        disposeProjectiles(); disposeParticles(); disposePlayerVisuals();
        Object.assign(state, { camera: null, controls: null, scene: null, isMultiplayer: false });
    }
});
