import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BULLET_TRAVEL_DISTANCE,
    MAX_PROJECTILES,
    PROJECTILE_LIFETIME,
    PROJECTILE_SPEED,
    HOOK_SPEED,
    WEAPON_STATS
} from '../src/config.ts';

test('all weapons define positive core firing stats', () => {
    for (const [weaponName, stats] of Object.entries(WEAPON_STATS)) {
        assert.ok(stats.fireRate > 0, `${weaponName} fireRate`);
        assert.ok(stats.damage > 0, `${weaponName} damage`);
        assert.ok(Number.isFinite(stats.bulletColor), `${weaponName} bulletColor`);
        assert.ok(stats.caliberMm > 0, `${weaponName} caliber`);
        assert.ok(['small', 'medium', 'large'].includes(stats.muzzleFlashSize), `${weaponName} muzzleFlashSize`);
    }
});

test('projectile budget can cover the preallocated pool', () => {
    assert.ok(MAX_PROJECTILES >= 128);
});

test('bullet range matches the sniper and fits within the projectile lifetime', () => {
    assert.equal(BULLET_TRAVEL_DISTANCE, 700);
    assert.equal(PROJECTILE_LIFETIME, 1.1);
    assert.ok(PROJECTILE_SPEED * PROJECTILE_LIFETIME >= BULLET_TRAVEL_DISTANCE);
});

test('grappling hook projectile travels at 500 units per second', () => {
    assert.equal(HOOK_SPEED, 500);
});

test('weapon muzzle shockwaves use the requested size tiers', () => {
    assert.equal(WEAPON_STATS.PISTOL.muzzleFlashSize, 'small');
    assert.equal(WEAPON_STATS.AR.muzzleFlashSize, 'small');
    assert.equal(WEAPON_STATS.MINIGUN.muzzleFlashSize, 'small');
    assert.equal(WEAPON_STATS.SHOTGUN.muzzleFlashSize, 'medium');
    assert.equal(WEAPON_STATS.SNIPER.muzzleFlashSize, 'large');
});
