import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FRAME_DELTA } from '../src/config.ts';
import { clampFrameDelta, segmentAabbHitT, segmentSphereHitT } from '../src/gameplayMath.ts';

test('clampFrameDelta rejects invalid and stalled frame durations', () => {
    assert.equal(clampFrameDelta(-1, MAX_FRAME_DELTA), 0);
    assert.equal(clampFrameDelta(Number.NaN, MAX_FRAME_DELTA), 0);
    assert.equal(clampFrameDelta(MAX_FRAME_DELTA / 2, MAX_FRAME_DELTA), MAX_FRAME_DELTA / 2);
    assert.equal(clampFrameDelta(MAX_FRAME_DELTA * 20, MAX_FRAME_DELTA), MAX_FRAME_DELTA);
});

test('swept segment collision catches a target between frame endpoints', () => {
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 10, y: 0, z: 0 };

    assert.equal(segmentSphereHitT(start, end, { x: 5, y: 0, z: 0 }, 1), 0.4);
    assert.equal(segmentSphereHitT(start, end, { x: 5, y: 3, z: 0 }, 1), null);
});

test('swept segment collision stops at an expanded obstacle AABB', () => {
    const hit = segmentAabbHitT(
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 4, y: -1, z: -1 },
        { x: 6, y: 1, z: 1 }
    );

    assert.equal(hit, 0.4);
    assert.equal(segmentAabbHitT(
        { x: 0, y: 3, z: 0 },
        { x: 10, y: 3, z: 0 },
        { x: 4, y: -1, z: -1 },
        { x: 6, y: 1, z: 1 }
    ), null);
});
