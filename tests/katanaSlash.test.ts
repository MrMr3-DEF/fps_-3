import test from 'node:test';
import assert from 'node:assert/strict';
import { createKatanaSlash, katanaSlashDistance } from '../src/katanaSlash.ts';
import { KATANA } from '../src/config.ts';

test('solid crescent translates without growing and stays inside the charged attack', () => {
    const slash = createKatanaSlash();
    try {
        const positions = slash.geometry.getAttribute('position');
        assert.equal(slash.material.color.getHex(), 0xffffff);
        assert.ok(slash.material.opacity > 0.9);
        for (let step = 0; step <= 30; step++) {
            const distance = katanaSlashDistance(step / 30);
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i) - distance;
                assert.ok(z <= 0);
                assert.ok(Math.hypot(x, z) <= KATANA.chargedRadius + 1e-6);
                assert.ok(Math.abs(y) <= 0.121);
            }
        }
        assert.equal(katanaSlashDistance(1) + KATANA.chargedRadius / 4, 10);
    } finally { slash.geometry.dispose(); slash.material.dispose(); }
});
