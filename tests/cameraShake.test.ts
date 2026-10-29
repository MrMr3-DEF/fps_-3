import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraShake } from '../src/cameraShake.ts';
import { sampleEndingShake } from '../src/mechaEndingCamera.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('absolute sampling preserves the stomp pattern and does not advance gameplay pulses', () => {
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    shake.trigger(.065, .85); shake.update(.2);
    const amplitude = .065 * (1 - .2 / .85) ** 2;
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.sin(.2 * 91) * amplitude, Math.sin(.2 * 113 + 1) * amplitude * .6, Math.sin(.2 * 79) * amplitude * .4));
    shake.apply(camera); assert.deepEqual(camera.quaternion.toArray(), expected.toArray());
    camera.quaternion.identity(); shake.applyAt(camera, .2, amplitude);
    assert.deepEqual(camera.quaternion.toArray(), expected.toArray());
    shake.applyAt(camera, 100, .11);
    camera.quaternion.identity(); shake.apply(camera);
    assert.deepEqual(camera.quaternion.toArray(), expected.toArray());
    shake.update(.65); camera.quaternion.identity(); shake.apply(camera);
    near(camera.quaternion.angleTo(new THREE.Quaternion()), 0);
});

test('ending shake covers fire lifetimes, accents detonation, caps overlaps and smoothly settles', () => {
    const blasts = [{ birth: 0, power: 1 }, { birth: .3, power: 1.15 }, { birth: .65, power: 1.15 },
        ...Array.from({ length: 4 }, () => ({ birth: .85, power: 2.5 }))];
    const end = 4.53;
    assert.equal(sampleEndingShake(-.001, blasts, end), 0);
    near(sampleEndingShake(0, blasts, end), .065);
    assert.ok(sampleEndingShake(.85, blasts, end) > sampleEndingShake(.849, blasts, end));
    near(sampleEndingShake(.85, blasts, end), .11);
    for (let t = 0; t < end; t += .01) {
        const amplitude = sampleEndingShake(t, blasts, end);
        assert.ok(amplitude > 0 && amplitude <= .11);
    }
    near(sampleEndingShake(end - .6, blasts, end), .05);
    near(sampleEndingShake(end - .3, blasts, end), .025);
    assert.ok(sampleEndingShake(end - .001, blasts, end) < .000001);
    assert.equal(sampleEndingShake(end, blasts, end), 0);
    assert.equal(sampleEndingShake(8, blasts, end), 0);
    assert.equal(sampleEndingShake(0, [], 0), 0);
});
