import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DayNightCycle } from '../src/dayNightCycle.ts';

test('day/night shadow settings can be applied without recreating the scene', () => {
    const cycle = new DayNightCycle(new THREE.Scene(), { shadows: true, shadowMapSize: 1024 });

    assert.equal(cycle.sunLight.castShadow, true);
    assert.deepEqual(cycle.sunLight.shadow.mapSize.toArray(), [1024, 1024]);

    cycle.applySettings({ shadows: false, shadowMapSize: 2048 });

    assert.equal(cycle.sunLight.castShadow, false);
    assert.deepEqual(cycle.sunLight.shadow.mapSize.toArray(), [2048, 2048]);
    assert.equal(cycle.sunLight.shadow.needsUpdate, false);

    cycle.applySettings({ shadows: true, shadowMapSize: 2048 });

    assert.equal(cycle.sunLight.castShadow, true);
    assert.equal(cycle.sunLight.shadow.needsUpdate, true);
});

test('sun shadows follow the observer and cover nearby ground and tall casters', () => {
    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: true, shadowMapSize: 1024 });
    for (const elapsed of [22, 75, 150, 225, 278]) {
        const observer = new THREE.Vector3(870, 2, -820);
        cycle.synchronizeElapsedSeconds(elapsed, true);
        cycle.update(0, observer);
        scene.updateMatrixWorld(true);
        cycle.sunLight.shadow.updateMatrices(cycle.sunLight);
        for (const point of [observer, new THREE.Vector3(870, 0, -820), new THREE.Vector3(870, 225, -820)]) {
            const projected = point.clone().applyMatrix4(cycle.sunLight.shadow.matrix);
            assert.ok(projected.x > 0 && projected.x < 1, `X coverage at ${elapsed}s`);
            assert.ok(projected.y > 0 && projected.y < 1, `Y coverage at ${elapsed}s`);
            assert.ok(projected.z > 0 && projected.z < 1, `depth coverage at ${elapsed}s`);
        }
    }
    assert.ok(cycle.sunLight.shadow.camera.right - cycle.sunLight.shadow.camera.left <= 512);
    const target = cycle.sunLight.target;
    cycle.dispose();
    assert.ok(!scene.children.includes(target));
});

test('sub-texel camera movement preserves the sun shadow grid', () => {
    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: true, shadowMapSize: 1024 });
    cycle.synchronizeElapsedSeconds(150, true);
    cycle.update(0, new THREE.Vector3(0, 2, 0));
    const firstTarget = cycle.sunLight.target.position.clone();
    cycle.update(0, new THREE.Vector3(0.01, 2, 0));
    assert.ok(firstTarget.distanceTo(cycle.sunLight.target.position) < 1e-8);
    cycle.dispose();
});
