import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PROJECTILES, WEAPON_STATS } from '../src/config.ts';

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
