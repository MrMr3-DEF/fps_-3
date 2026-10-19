import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SpatialHash } from '../src/spatialHash.ts';

test('endpoint rounding regressions terminate in both directions and axes', () => {
    // A child deadline keeps a future traversal regression from hanging the suite.
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `
        import { SpatialHash } from './src/spatialHash.ts';
        const hash = new SpatialHash(32);
        for (const [x, z, ex, ez] of [[3.2, 6.4, -32, 32], [-32, 32, 3.2, 6.4],
            [6.4, 3.2, 32, -32], [32, -32, 6.4, 3.2]]) hash.querySegment(x, z, ex, ez);
    `], { cwd: new URL('..', import.meta.url), timeout: 2000, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
});

test('segment broad phase covers an independent seeded segment/box reference', () => {
    let seed = 0x12345678;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    const hash = new SpatialHash<number>(10);
    const boxes = Array.from({ length: 100 }, (_, id) => {
        const box = { x: random() * 200 - 100, z: random() * 200 - 100, r: random() * 8 };
        hash.insert(box.x, box.z, box.r, id);
        return box;
    });
    for (let i = 0; i < 500; i++) {
        const x = random() * 220 - 110, z = random() * 220 - 110;
        const ex = i % 7 === 0 ? x : random() * 220 - 110;
        const ez = i % 11 === 0 ? z : random() * 220 - 110;
        const padding = i % 3 === 0 ? random() * 15 : 0;
        const candidates = new Set(hash.querySegment(x, z, ex, ez, [], padding));
        boxes.forEach((box, id) => {
            // Independent slab clipping against the collider's padded square.
            let enter = 0, exit = 1;
            for (const [a, b, center] of [[x, ex, box.x], [z, ez, box.z]]) {
                const lo = center - box.r - padding, hi = center + box.r + padding;
                if (a === b) { if (a < lo || a > hi) exit = -1; }
                else {
                    const t1 = (lo - a) / (b - a), t2 = (hi - a) / (b - a);
                    enter = Math.max(enter, Math.min(t1, t2));
                    exit = Math.min(exit, Math.max(t1, t2));
                }
            }
            if (enter <= exit) assert.ok(candidates.has(id), `query ${i} missed collider ${id}`);
        });
    }
});

test('invalid segment coordinates and cell sizes fail explicitly', () => {
    for (const size of [0, -1, NaN, Infinity]) assert.throws(() => new SpatialHash(size), RangeError);
    const hash = new SpatialHash(10);
    for (const invalid of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
        assert.throws(() => hash.querySegment(invalid, 0, 0, 0), RangeError);
        assert.throws(() => hash.query(0, 0, invalid), RangeError);
        assert.throws(() => hash.insert(invalid, 0, 1, 'invalid'), RangeError);
    }
    assert.throws(() => hash.querySegment(Number.MAX_SAFE_INTEGER * 10, 0, 0, 0, [], 20), RangeError);
    assert.throws(() => hash.querySegment(0, 0, 1, 1, [], -1), RangeError);
    assert.deepEqual(hash.querySegment(-10, -10, -10, -10), []);
});

test('padded segment finds colliders across a cell edge without duplicates', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(10.1, 5, 0.05, 'edge'); hash.insert(25, 5, 0.05, 'far');
    assert.deepEqual(hash.querySegment(9.9, 0, 9.9, 9), []);
    assert.deepEqual(hash.querySegment(9.9, 0, 9.9, 9, [], 0.3), ['edge']);
});

test('SpatialHash returns nearby inserted values once', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(0, 0, 12, 'pillar');

    const results = hash.query(4, 4, 10);

    assert.deepEqual(results, ['pillar']);
});

test('SpatialHash reuses and clears caller-provided output arrays', () => {
    const hash = new SpatialHash<string>(10);
    const out = ['stale'];

    hash.insert(25, 0, 2, 'lava');
    const results = hash.query(0, 0, 3, out);

    assert.equal(results, out);
    assert.deepEqual(results, []);
});

test('SpatialHash clear removes all buckets', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(0, 0, 4, 'target');
    hash.clear();

    assert.deepEqual(hash.query(0, 0, 10), []);
});

test('SpatialHash querySegment returns only values in traversed cells', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(5, 5, 0, 'start');
    hash.insert(25, 5, 0, 'middle');
    hash.insert(45, 5, 0, 'end');
    hash.insert(25, 35, 0, 'off-path');

    assert.deepEqual(hash.querySegment(0, 5, 50, 5), ['start', 'middle', 'end']);
});

test('SpatialHash querySegment deduplicates values spanning multiple cells', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(20, 0, 15, 'wide');

    const out = ['stale'];
    const results = hash.querySegment(0, 0, 40, 0, out);

    assert.equal(results, out);
    assert.deepEqual(results, ['wide']);
});

test('SpatialHash querySegment traverses negative coordinates', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(-15, -15, 0, 'negative');
    hash.insert(15, -15, 0, 'not-crossed');

    assert.deepEqual(hash.querySegment(5, 5, -25, -25), ['negative']);
});

test('SpatialHash querySegment includes both neighboring cells at a grid corner', () => {
    const hash = new SpatialHash<string>(10);
    hash.insert(15, 5, 0, 'x-neighbor');
    hash.insert(5, 15, 0, 'z-neighbor');

    assert.deepEqual(hash.querySegment(5, 5, 15, 15).sort(), ['x-neighbor', 'z-neighbor']);
});
