import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENDING_DEBRIS, pillarImpactRoll, prepareEndingDebris, sampleEndingStone, sweepPillar, type EndingStone, type EndingPillar } from '../src/mechaEndingDebris.ts';

const checkpoint = async () => {};
function pillar(id = 0, x = 0, height = 10, width = 2): EndingPillar {
    const position = new THREE.Vector3(x, height / 2, 0), size = new THREE.Vector3(width, height, width);
    return { id, position, size, bounds: new THREE.Box3().setFromCenterAndSize(position, size), destroyedAt: Infinity };
}
function stone(id = 0, position = new THREE.Vector3(-10, 5, 0), velocity = new THREE.Vector3(40, 0, 0)): EndingStone {
    return { id, position, velocity, size: new THREE.Vector3(.5, .5, .5), spin: new THREE.Vector3(1, 2, 3), birth: 0, landing: Infinity };
}
const seedFor = (predicate: (seed: number) => boolean) => {
    for (let seed = 0; seed < 100000; seed++) if (predicate(seed)) return seed;
    throw new Error('No fixture seed');
};

test('swept bounds catch fast fragments without tunneling and ignore existing overlap', () => {
    const target = pillar();
    const hit = sweepPillar(new THREE.Vector3(-100, 5, 0), new THREE.Vector3(100, 5, 0), target.bounds, .5)!;
    assert.ok(hit.fraction > 0 && hit.fraction < .5); assert.deepEqual(hit.normal.toArray(), [-1, 0, 0]);
    assert.equal(sweepPillar(new THREE.Vector3(-100, 15, 0), new THREE.Vector3(100, 15, 0), target.bounds, .5), null);
    assert.equal(sweepPillar(new THREE.Vector3(0, 5, 0), new THREE.Vector3(5, 5, 0), target.bounds, .5), null);
});

test('chronological contacts beat input order, and simultaneous contacts use stable fragment IDs', async () => {
    for (const simultaneous of [false, true]) {
        const target = pillar();
        const early = stone(5, new THREE.Vector3(-2, 5, 0), new THREE.Vector3(500, 0, 0));
        const later = stone(2, new THREE.Vector3(simultaneous ? -2 : -4, 5, 0), new THREE.Vector3(500, 0, 0));
        const winner = simultaneous ? 2 : 5;
        const seed = seedFor(seed => pillarImpactRoll(seed, winner, 0, 0) < .2);
        const paths = await prepareEndingDebris([later, early], [target], .02, seed, checkpoint);
        assert.equal(paths.contacts.length, 1); assert.equal(paths.contacts[0].stoneId, winner);
        assert.equal(paths.shatters, 1); assert.equal(paths.secondary.length, 4);
    }
});

test('contact cap prevents resting-contact cascades and absolute paths support arbitrary seek order', async () => {
    const target = pillar(0, 0, 10, 4), fragment = stone(0, new THREE.Vector3(0, 15, 0), new THREE.Vector3(0, -5, 0));
    const seed = seedFor(seed => Array.from({ length: ENDING_DEBRIS.contacts }, (_, n) => pillarImpactRoll(seed, 0, 0, n) >= .2).every(Boolean));
    const paths = await prepareEndingDebris([fragment], [target], 5, seed, checkpoint);
    assert.equal(paths.contacts.length, ENDING_DEBRIS.contacts); assert.equal(target.destroyedAt, Infinity);
    const point = new THREE.Vector3(); sampleEndingStone(fragment, 4, point); const final = point.toArray();
    for (const time of [0, 2, -1, .5, 5, 1, 4]) sampleEndingStone(fragment, time, point);
    assert.deepEqual(point.toArray(), final); assert.ok(final.every(Number.isFinite));
    await assert.rejects(prepareEndingDebris([stone()], [pillar()], 5, 42, async () => { throw new Error('cancelled'); }), /cancelled/);
});
