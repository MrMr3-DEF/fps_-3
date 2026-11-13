import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraShake } from '../src/cameraShake.ts';

test('render-only shake sampling cannot advance gameplay pulses or move the camera', () => {
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    const position = camera.position.clone();
    shake.trigger(0.05, 1); shake.update(0.2); shake.apply(camera);
    const expected = camera.quaternion.clone();
    assert.ok(expected.angleTo(new THREE.Quaternion()) > 0);
    shake.applyAt(camera, 100, 0.1);
    camera.quaternion.identity(); shake.apply(camera);
    assert.deepEqual(camera.quaternion.toArray(), expected.toArray());
    assert.deepEqual(camera.position, position);
    shake.update(1); camera.quaternion.identity(); shake.apply(camera);
    assert.ok(camera.quaternion.angleTo(new THREE.Quaternion()) < 1e-7);
});
