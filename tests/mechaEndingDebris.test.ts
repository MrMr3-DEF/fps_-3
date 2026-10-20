import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENDING_DEBRIS, pillarImpactRoll, prepareEndingDebris, sampleEndingStone, sweepPillar, type EndingStone, type EndingPillar } from '../src/mechaEndingDebris.ts';
import { avoidEndingPillars } from '../src/mechaEndingCamera.ts';

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

test('per-impact hash is stable, bounded and distributes breakups at twenty percent', () => {
    let broken = 0;
    for (let i = 0; i < 10000; i++) {
        const n = pillarImpactRoll(42, i, 13, 0);
        assert.equal(n, pillarImpactRoll(42, i, 13, 0)); assert.ok(n >= 0 && n < 1);
        if (n < .2) broken++;
    }
    assert.ok(broken > 1850 && broken < 2150, String(broken));
    assert.notEqual(pillarImpactRoll(42, 1, 13, 0), pillarImpactRoll(42, 1, 13, 1));
});
test('swept bounds catch fast fragments without tunneling and ignore existing overlap', () => {
    const target = pillar();
    const hit = sweepPillar(new THREE.Vector3(-100, 5, 0), new THREE.Vector3(100, 5, 0), target.bounds, .5)!;
    assert.ok(hit.fraction > 0 && hit.fraction < .5); assert.deepEqual(hit.normal.toArray(), [-1, 0, 0]);
    assert.equal(sweepPillar(new THREE.Vector3(-100, 15, 0), new THREE.Vector3(100, 15, 0), target.bounds, .5), null);
    assert.equal(sweepPillar(new THREE.Vector3(0, 5, 0), new THREE.Vector3(5, 5, 0), target.bounds, .5), null);
});
test('a surviving pillar deflects and slows rubble, with no repeated roll while separating', async () => {
    const target = pillar(), fragment = stone();
    const seed = seedFor(seed => pillarImpactRoll(seed, 0, 0, 0) >= .2);
    const paths = await prepareEndingDebris([fragment], [target], .5, seed, checkpoint);
    assert.equal(paths.bounces, 1); assert.equal(paths.shatters, 0); assert.equal(paths.contacts.length, 1);
    assert.equal(target.destroyedAt, Infinity);
    const point = new THREE.Vector3(); sampleEndingStone(fragment, .5, point);
    assert.ok(point.x < paths.contacts[0].point.x); assert.ok(fragment.segments![1].velocity.x < 0);
    assert.ok(Math.abs(fragment.segments![1].velocity.x) < 40);
});
test('each new impact rerolls: a pillar can survive its first bounce then shatter on the next', async () => {
    const target = pillar(0, 0, 10, 4), fragment = stone(0, new THREE.Vector3(0, 15, 0), new THREE.Vector3(0, -5, 0));
    const seed = seedFor(seed => pillarImpactRoll(seed, 0, 0, 0) >= .2 && pillarImpactRoll(seed, 0, 0, 1) < .2);
    const paths = await prepareEndingDebris([fragment], [target], 2, seed, checkpoint);
    assert.deepEqual(paths.contacts.filter(c => c.stoneId === 0).map(c => [c.ordinal, c.shattered]), [[0, false], [1, true]]);
    assert.equal(paths.shatters, 1); assert.equal(paths.secondary.length, 4);
    assert.ok(Number.isFinite(target.destroyedAt));
    assert.ok(paths.secondary.every(s => s.sourcePillar === 0 && s.birth === target.destroyedAt));
    assert.ok(paths.contacts.every(c => c.pillarId !== 0 || c.at <= target.destroyedAt));
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
test('secondary pillar chunks use the same collision rules and cannot shatter their own source', async () => {
    const targets = [pillar(0, 0, 16, 4), pillar(1, 7, 16, 4)], fragment = stone(0, new THREE.Vector3(-8, 8, 0), new THREE.Vector3(45, 0, 0));
    const seed = seedFor(seed => pillarImpactRoll(seed, 0, 0, 0) < .2);
    const paths = await prepareEndingDebris([fragment], targets, 3, seed, checkpoint);
    assert.ok(paths.contacts.some(c => c.stoneId > 0 && c.pillarId === 1));
    assert.ok(paths.secondary.length <= targets.length * 4);
    for (const contact of paths.contacts) {
        const source = paths.secondary.find(s => s.id === contact.stoneId)?.sourcePillar;
        assert.notEqual(source, contact.pillarId);
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
test('camera stays at the approved pose when clear, and makes only bounded deterministic adjustments around pillars', () => {
    const target = new THREE.Vector3(0, 12, 0), robot = new THREE.Vector3(), contact = target.clone();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 1000); camera.position.set(0, 22, 110); camera.lookAt(target); camera.updateMatrixWorld(true);
    const original = camera.position.clone();
    assert.deepEqual(avoidEndingPillars(camera, target, robot, contact, [], []), { yaw: 0, height: 0, distanceScale: 1, blocked: 0 });
    assert.deepEqual(camera.position.toArray(), original.toArray());
    const blocking = pillar(0, 0, 32, 4); blocking.position.z = 50; blocking.bounds.setFromCenterAndSize(blocking.position, blocking.size);
    const adjustment = avoidEndingPillars(camera, target, robot, contact, [], [blocking]);
    assert.ok(Math.abs(adjustment.yaw) <= 15); assert.ok(adjustment.height >= 0 && adjustment.height <= 10);
    assert.ok(adjustment.distanceScale <= 1.1 + 1e-9); assert.equal(adjustment.blocked, 0);
    const chosen = camera.position.clone(); camera.position.copy(original); camera.lookAt(target); camera.updateMatrixWorld(true);
    assert.deepEqual(avoidEndingPillars(camera, target, robot, contact, [], [blocking]), adjustment);
    assert.ok(camera.position.distanceTo(chosen) < 1e-9);
});
