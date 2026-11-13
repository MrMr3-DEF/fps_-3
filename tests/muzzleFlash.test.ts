import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachGrappleMuzzleShockwave, attachMuzzleShockwave, triggerMuzzleFlash } from '../src/muzzleFlash.ts';
import { userSettings } from '../src/settings.ts';

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
