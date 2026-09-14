import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BULLET_TRAVEL_DISTANCE,
    MAX_PROJECTILES,
    PROJECTILE_LIFETIME,
    PROJECTILE_SPEED,
    WEAPON_STATS
} from '../src/config.ts';

test('all weapons define positive core firing stats', () => {
    for (const [weaponName, stats] of Object.entries(WEAPON_STATS)) {
        assert.ok(stats.fireRate > 0, `${weaponName} fireRate`);
        assert.ok(stats.damage > 0, `${weaponName} damage`);
        assert.ok(Number.isFinite(stats.bulletColor), `${weaponName} bulletColor`);
    }
});

test('projectile budget can cover the preallocated pool', () => {
    assert.ok(MAX_PROJECTILES >= 128);
});

test('bullet range matches the sniper and remains shorter than the safety timeout', () => {
    assert.equal(BULLET_TRAVEL_DISTANCE, 700);
    assert.equal(PROJECTILE_LIFETIME, 2.5);
    assert.ok(PROJECTILE_SPEED * PROJECTILE_LIFETIME > BULLET_TRAVEL_DISTANCE);
});
