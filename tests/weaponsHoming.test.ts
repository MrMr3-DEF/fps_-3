import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { createAkimboGuns, disposePlayerVisuals, fireProjectile } from '../src/weapons.ts';
import { projectileData } from '../src/userDataTypes.ts';
import { resetProjectiles } from '../src/projectiles.ts';
import { setProjectileHomingTarget } from '../src/projectileHoming.ts';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.ts';
import type { HomingTargetPacket } from '../src/networkTypes.ts';
import { MINIGUN_RAMP_TIME } from '../src/config.ts';

test('scoped bullets capture the scan target and one-third-distance threshold, while sniper does not', () => {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.camera.position.set(0, 2, 0);
    state.camera.lookAt(0, 2, -40);
    state.isScoped = true;
    state.isMultiplayer = false;
    state.projectiles = [];
    state.projectilePool = [];
    state.peers = {};
    createAkimboGuns();

    const target = new THREE.Group();
    target.position.set(4, 2, -40);
    target.userData = { index: 0, hp: 3, scale: 1, eliminationRevision: 5 };
    state.targets = [target];
    setProjectileHomingTarget({
        kind: 'npc', object: target, targetIndex: 0, targetRevision: 5,
    });

    state.activeWeaponName = 'PISTOL';
    state.rightGun = state.pistolMesh;
    state.scene.updateMatrixWorld(true);
    fireProjectile();
    assert.equal(state.projectiles.length, 1);
    const projectile = projectileData(state.projectiles[0]);
    assert.equal(projectile.homingTarget?.kind, 'npc');
    assert.ok((projectile.homingStartDistance ?? 0) > 12.5);
    assert.ok((projectile.homingStartDistance ?? Infinity) < 14.5);

    resetProjectiles();
    let transmittedHomingTarget: HomingTargetPacket | undefined;
    setWeaponNetworkPort({
        broadcastLocalFire: (_barrel, _direction, _hit, _shot, _seed, homingTarget) => {
            transmittedHomingTarget = homingTarget;
        },
        broadcastToAll: () => {},
        flashPeerMesh: () => {},
    });
    state.isMultiplayer = true;
    state.activeWeaponName = 'SNIPER';
    state.rightGun = state.sniperMesh;
    fireProjectile();
    assert.equal(transmittedHomingTarget, undefined);
    assert.equal(state.projectiles.length, 0, 'sniper remains hitscan and creates no homing bullet');

    setProjectileHomingTarget(null);
    setWeaponNetworkPort({ broadcastLocalFire: () => {}, broadcastToAll: () => {}, flashPeerMesh: () => {} });
    disposePlayerVisuals();
    state.targets = [];
    state.peers = {};
    state.isMultiplayer = false;
    state.isScoped = false;
    state.scene = null;
    state.camera = null;
});

test('a full-speed minigun refreshes its homing distance once per ten bullets', () => {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.camera.position.set(0, 2, 0);
    state.camera.lookAt(0, 2, -40);
    state.isScoped = true;
    state.isMultiplayer = false;
    state.projectiles = [];
    state.projectilePool = [];
    state.peers = {};
    createAkimboGuns();

    const target = new THREE.Group();
    target.position.set(0, 2, -40);
    target.userData = { index: 0, hp: 3, scale: 1, eliminationRevision: 1 };
    state.targets = [target];
    setProjectileHomingTarget({
        kind: 'npc', object: target, targetIndex: 0, targetRevision: 1,
    });
    state.activeWeaponName = 'MINIGUN';
    state.rightGun = state.minigunMesh;
    state.minigunRamp = MINIGUN_RAMP_TIME;
    state.scene.updateMatrixWorld(true);

    fireProjectile();
    const firstSample = projectileData(state.projectiles[0]).homingStartDistance!;
    target.position.z = -80;
    for (let bullet = 2; bullet <= 10; bullet++) fireProjectile();
    assert.equal(state.projectiles.length, 10);
    for (const projectile of state.projectiles) {
        assert.equal(projectileData(projectile).homingStartDistance, firstSample);
    }

    fireProjectile();
    const refreshedSample = projectileData(state.projectiles[10]).homingStartDistance!;
    assert.ok(refreshedSample > firstSample * 1.8, 'bullet 11 samples the moved target again');

    const replacementTarget = new THREE.Group();
    replacementTarget.position.set(0, 2, -120);
    replacementTarget.userData = { index: 1, hp: 3, scale: 1, eliminationRevision: 1 };
    state.targets.push(replacementTarget);
    setProjectileHomingTarget({
        kind: 'npc', object: replacementTarget, targetIndex: 1, targetRevision: 1,
    });
    fireProjectile();
    assert.ok(
        projectileData(state.projectiles[11]).homingStartDistance! > refreshedSample * 1.4,
        'changing targets refreshes immediately instead of waiting for the batch boundary',
    );

    setProjectileHomingTarget(null);
    resetProjectiles();
    disposePlayerVisuals();
    state.targets = [];
    state.peers = {};
    state.isScoped = false;
    state.minigunRamp = 0;
    state.scene = null;
    state.camera = null;
});
