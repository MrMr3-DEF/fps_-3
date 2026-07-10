import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../src/spatialHash.ts';

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
