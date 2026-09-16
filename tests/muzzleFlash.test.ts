import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachGrappleMuzzleShockwave, attachMuzzleShockwave, MUZZLE_SHOCKWAVE_RADII, triggerMuzzleFlash, updateMuzzleFlash } from '../src/muzzleFlash.ts';
import { userSettings } from '../src/settings.ts';
import { buildAR, buildGun, buildMinigun, buildShotgun, buildSniper, WEAPON_MUZZLE_POINTS } from '../src/weapons.ts';

test('muzzle shockwaves use compact small, medium and large tiers and alternate flat frames', () => {
    assert.ok(MUZZLE_SHOCKWAVE_RADII.small < MUZZLE_SHOCKWAVE_RADII.medium);
    assert.ok(MUZZLE_SHOCKWAVE_RADII.medium < MUZZLE_SHOCKWAVE_RADII.large);
    assert.equal(MUZZLE_SHOCKWAVE_RADII.large, 0.28);

    const sniper = new THREE.Group();
    const grapple = new THREE.Group();
    attachMuzzleShockwave(sniper, [0, 0, -1.47], 0xffff00, 'large');
    attachGrappleMuzzleShockwave(grapple, [0, 0, -0.19], 0x00aaff);
    assert.equal(sniper.userData.muzzleFlashEffect.maxRadius, grapple.userData.muzzleFlashEffect.maxRadius);

    const weapon = new THREE.Group();
    attachMuzzleShockwave(weapon, [0, 0, -0.5], 0xff0055, 'small');
    const frames = weapon.children as THREE.Mesh[];
    triggerMuzzleFlash(weapon);
    assert.equal(frames[0].visible, true);
    assert.equal(frames[1].visible, false);
    triggerMuzzleFlash(weapon);
    assert.equal(frames[0].visible, false);
    assert.equal(frames[1].visible, true);
    updateMuzzleFlash(weapon, 1);
    assert.equal(frames[1].visible, false);
});

test('muzzle flash setting disables standard and grapple shockwaves', () => {
    const previous = userSettings.muzzleFlashes;
    const weapon = new THREE.Group();
    const grapple = new THREE.Group();
    attachMuzzleShockwave(weapon, [0, 0, -0.5], 0xff0055, 'small');
    attachGrappleMuzzleShockwave(grapple, [0, 0, -0.19], 0x00aaff);
    try {
        userSettings.muzzleFlashes = false;
        triggerMuzzleFlash(weapon);
        triggerMuzzleFlash(grapple);
        assert.ok(weapon.children.every(child => !child.visible));
        assert.ok(grapple.children.every(child => !child.visible));
    } finally {
        userSettings.muzzleFlashes = previous;
    }
});

test('muzzle shockwaves use the configured opacity throughout their fade', () => {
    const previousEnabled = userSettings.muzzleFlashes;
    const previousOpacity = userSettings.muzzleFlashOpacity;
    const weapon = new THREE.Group();
    attachMuzzleShockwave(weapon, [0, 0, -0.5], 0xff0055, 'small');
    try {
        userSettings.muzzleFlashes = true;
        userSettings.muzzleFlashOpacity = 0.4;
        triggerMuzzleFlash(weapon);
        const frame = weapon.children[0] as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
        assert.equal(frame.material.opacity, 0.4);
        updateMuzzleFlash(weapon, 0.045);
        assert.ok(Math.abs(frame.material.opacity - 0.2) < 0.0001);
    } finally {
        userSettings.muzzleFlashes = previousEnabled;
        userSettings.muzzleFlashOpacity = previousOpacity;
    }
});

test('every shockwave is centered on its modeled muzzle plane', () => {
    assert.deepEqual(WEAPON_MUZZLE_POINTS.PISTOL, [0, 0, -0.19]);
    assert.deepEqual(WEAPON_MUZZLE_POINTS.SHOTGUN, [0, 0.02, -0.575]);
    assert.deepEqual(WEAPON_MUZZLE_POINTS.AR, [0, 0.02, -0.7250000000000001]);
    assert.deepEqual(WEAPON_MUZZLE_POINTS.SNIPER, [0, 0, -1.47]);
    assert.deepEqual(WEAPON_MUZZLE_POINTS.MINIGUN, [0, 0.010000000000000009, -0.73]);

    const weapons = [buildGun(0xff0055), buildShotgun(), buildAR(), buildSniper()];
    const names = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER'] as const;
    names.forEach((name, index) => {
        const flash = weapons[index].getObjectByName('muzzle-shockwave');
        assert.deepEqual(flash?.position.toArray(), [...WEAPON_MUZZLE_POINTS[name]], `${name} flash origin`);
    });
});

test('minigun shockwave stays at the fixed top point of the barrel circle', () => {
    const minigun = buildMinigun();
    const barrels = minigun.userData.barrels as THREE.Group;
    const flash = minigun.getObjectByName('muzzle-shockwave');
    const initialPosition = flash?.position.clone();
    barrels.rotation.z = 0.37;
    assert.deepEqual(flash?.position.toArray(), initialPosition?.toArray());
    assert.deepEqual(flash?.position.toArray(), [...WEAPON_MUZZLE_POINTS.MINIGUN]);
});
