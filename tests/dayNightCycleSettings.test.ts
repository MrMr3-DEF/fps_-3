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
