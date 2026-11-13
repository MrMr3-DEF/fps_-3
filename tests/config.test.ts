import test from 'node:test';
import assert from 'node:assert/strict';
import { BULLET_TRAVEL_DISTANCE, PROJECTILE_LIFETIME, PROJECTILE_SPEED, WEAPON_STATS } from '../src/config.ts';

test('all weapons define positive core firing stats', () => {
    for (const [weaponName, stats] of Object.entries(WEAPON_STATS)) {
        assert.ok(stats.fireRate > 0, `${weaponName} fireRate`);
        assert.ok(stats.damage > 0, `${weaponName} damage`);
    }
});

test('projectiles remain alive long enough to reach their configured range', () => {
    assert.ok(PROJECTILE_SPEED * PROJECTILE_LIFETIME >= BULLET_TRAVEL_DISTANCE);
});
